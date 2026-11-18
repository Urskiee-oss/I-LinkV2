import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Injectable,
  Module,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { createHash, randomBytes } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { RealtimeGateway } from '../websockets/websockets.module';
import { NotificationsService } from '../notifications/notifications.module';
import { Public, Roles } from '../common/decorators';
import { FLOOD_TIERS, FloodTier } from '../common/types';
import { unwrap, unwrapOne } from '../common/db';

export class IngestReadingDto {
  @Type(() => Number)
  @IsNumber()
  @Min(2)
  @Max(2000)
  distanceCm!: number;

  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}

export class CreateSensorDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(250)
  locationText!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(50)
  @Max(2000)
  sensorHeightCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(5)
  advisoryCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(10)
  warningCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(15)
  dangerCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  criticalCm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.2)
  rapidRiseCmMin?: number;
}

export function sha256Hex(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function computeFloodTier(params: {
  depthCm: number;
  riseCmMin: number | null;
  advisoryCm: number;
  warningCm: number;
  dangerCm: number;
  criticalCm: number;
  rapidRiseCmMin: number;
}): FloodTier {
  const { depthCm, riseCmMin, advisoryCm, warningCm, dangerCm, criticalCm, rapidRiseCmMin } =
    params;

  let tierIndex = 0; // 0=normal, 1=advisory, 2=warning, 3=danger, 4=critical
  if (depthCm >= criticalCm) tierIndex = 4;
  else if (depthCm >= dangerCm) tierIndex = 3;
  else if (depthCm >= warningCm) tierIndex = 2;
  else if (depthCm >= advisoryCm) tierIndex = 1;

  // Rapid rise velocity escalates one tier when water depth has at least reached 50% of advisory
  if (
    riseCmMin !== null &&
    riseCmMin >= rapidRiseCmMin &&
    depthCm >= advisoryCm * 0.5 &&
    tierIndex < 4
  ) {
    tierIndex += 1;
  }

  return FLOOD_TIERS[tierIndex];
}

function sanitizeSensor(row: Record<string, unknown>) {
  const rest = { ...row };
  delete rest.device_key_hash;
  return {
    ...rest,
    sensor_height_cm: Number(row.sensor_height_cm),
    advisory_cm: Number(row.advisory_cm),
    warning_cm: Number(row.warning_cm),
    danger_cm: Number(row.danger_cm),
    critical_cm: Number(row.critical_cm),
    rapid_rise_cm_min: Number(row.rapid_rise_cm_min),
    last_depth_cm: row.last_depth_cm !== null && row.last_depth_cm !== undefined ? Number(row.last_depth_cm) : null,
    last_rise_cm_min:
      row.last_rise_cm_min !== null && row.last_rise_cm_min !== undefined
        ? Number(row.last_rise_cm_min)
        : null,
  };
}

@Injectable()
export class FloodService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly realtime: RealtimeGateway,
    private readonly notifications: NotificationsService,
  ) {}

  async listSensors() {
    const rows =
      unwrap(
        await this.supabase.admin
          .from('flood_sensors')
          .select('*')
          .order('name', { ascending: true }),
      ) ?? [];
    return rows.map(sanitizeSensor);
  }

  async listReadings(sensorId: string, limit = 100) {
    const cap = Math.min(Math.max(limit, 1), 500);
    const rows =
      unwrap(
        await this.supabase.admin
          .from('sensor_readings')
          .select('*')
          .eq('sensor_id', sensorId)
          .order('recorded_at', { ascending: false })
          .limit(cap),
      ) ?? [];
    return rows.map((r: Record<string, unknown>) => ({
      ...r,
      distance_cm: Number(r.distance_cm),
      depth_cm: Number(r.depth_cm),
      rise_cm_min: r.rise_cm_min !== null && r.rise_cm_min !== undefined ? Number(r.rise_cm_min) : null,
    }));
  }

  async listAlerts(limit = 30) {
    const cap = Math.min(Math.max(limit, 1), 200);
    const rows =
      unwrap(
        await this.supabase.admin
          .from('flood_alerts')
          .select('*, sensor:flood_sensors(id, name, location_text)')
          .order('created_at', { ascending: false })
          .limit(cap),
      ) ?? [];
    return rows.map((a: Record<string, unknown>) => ({
      ...a,
      depth_cm: Number(a.depth_cm),
      rise_cm_min: a.rise_cm_min !== null && a.rise_cm_min !== undefined ? Number(a.rise_cm_min) : null,
    }));
  }

  async createSensor(dto: CreateSensorDto) {
    const sensorHeight = dto.sensorHeightCm ?? 400;
    const advisory = dto.advisoryCm ?? 50;
    const warning = dto.warningCm ?? 100;
    const danger = dto.dangerCm ?? 150;
    const critical = dto.criticalCm ?? 200;

    if (!(advisory < warning && warning < danger && danger < critical)) {
      throw new BadRequestException(
        'Thresholds must be strictly increasing: advisory < warning < danger < critical',
      );
    }

    const rawDeviceKey = `ilink_sensor_${randomBytes(18).toString('hex')}`;
    const deviceKeyHash = sha256Hex(rawDeviceKey);

    const created = unwrap(
      await this.supabase.admin
        .from('flood_sensors')
        .insert({
          name: dto.name.trim(),
          location_text: dto.locationText.trim(),
          latitude: dto.latitude,
          longitude: dto.longitude,
          device_key_hash: deviceKeyHash,
          sensor_height_cm: sensorHeight,
          advisory_cm: advisory,
          warning_cm: warning,
          danger_cm: danger,
          critical_cm: critical,
          rapid_rise_cm_min: dto.rapidRiseCmMin ?? 2,
          current_tier: 'normal',
        })
        .select('*')
        .single(),
      'Failed to register flood sensor',
    );

    return {
      sensor: sanitizeSensor(created),
      device_key: rawDeviceKey,
    };
  }

  async ingestReading(deviceKey: string | undefined, dto: IngestReadingDto) {
    if (!deviceKey || deviceKey.trim().length < 8) {
      throw new UnauthorizedException('Valid x-device-key header is required');
    }
    const hash = sha256Hex(deviceKey.trim());
    const sensor = unwrapOne(
      await this.supabase.admin
        .from('flood_sensors')
        .select('*')
        .eq('device_key_hash', hash)
        .eq('is_active', true)
        .single(),
      'Flood sensor',
    );

    const sensorHeight = Number(sensor.sensor_height_cm);
    if (dto.distanceCm <= 0 || dto.distanceCm > sensorHeight + 100) {
      throw new BadRequestException(
        `Discarded ultrasonic out-of-range reading (${dto.distanceCm} cm vs sensor height ${sensorHeight} cm)`,
      );
    }

    const depthCm = Number(Math.max(0, sensorHeight - dto.distanceCm).toFixed(2));
    const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : new Date();

    let riseCmMin: number | null = null;
    if (sensor.last_reading_at && sensor.last_depth_cm !== null) {
      const elapsedMin =
        (recordedAt.getTime() - new Date(sensor.last_reading_at).getTime()) / 60000;
      if (elapsedMin > 0.02 && elapsedMin <= 60) {
        riseCmMin = Number(((depthCm - Number(sensor.last_depth_cm)) / elapsedMin).toFixed(2));
      }
    }

    const tier = computeFloodTier({
      depthCm,
      riseCmMin,
      advisoryCm: Number(sensor.advisory_cm),
      warningCm: Number(sensor.warning_cm),
      dangerCm: Number(sensor.danger_cm),
      criticalCm: Number(sensor.critical_cm),
      rapidRiseCmMin: Number(sensor.rapid_rise_cm_min),
    });

    const reading = unwrap(
      await this.supabase.admin
        .from('sensor_readings')
        .insert({
          sensor_id: sensor.id,
          distance_cm: dto.distanceCm,
          depth_cm: depthCm,
          rise_cm_min: riseCmMin,
          tier,
          recorded_at: recordedAt.toISOString(),
        })
        .select('*')
        .single(),
      'Failed to store sensor reading',
    );

    const updatedSensorRow = unwrapOne(
      await this.supabase.admin
        .from('flood_sensors')
        .update({
          current_tier: tier,
          last_depth_cm: depthCm,
          last_rise_cm_min: riseCmMin,
          last_reading_at: recordedAt.toISOString(),
        })
        .eq('id', sensor.id)
        .select('*')
        .single(),
    );

    const sanitizedSensor = sanitizeSensor(updatedSensorRow);
    const normalizedReading = {
      ...reading,
      distance_cm: Number(reading.distance_cm),
      depth_cm: Number(reading.depth_cm),
      rise_cm_min: reading.rise_cm_min !== null ? Number(reading.rise_cm_min) : null,
    };

    this.realtime.emitToAll('flood:reading', {
      sensor: sanitizedSensor,
      reading: normalizedReading,
    });

    let alertRow: Record<string, unknown> | undefined;
    const prevTier: FloodTier = sensor.current_tier;
    if (tier !== prevTier) {
      const tierMsg: Record<FloodTier, string> = {
        normal: `Water level at ${sensor.name} (${sensor.location_text}) returned to NORMAL (${depthCm} cm).`,
        advisory: `[YELLOW ADVISORY] ${sensor.name} water depth reached ${depthCm} cm (rise: ${riseCmMin ?? 0} cm/min). Monitor updates closely.`,
        warning: `[ORANGE WARNING] ${sensor.name} water depth reached ${depthCm} cm (rise: ${riseCmMin ?? 0} cm/min). Prepare go-bags and vulnerable household members.`,
        danger: `[RED DANGER] ${sensor.name} water depth at ${depthCm} cm (rise: ${riseCmMin ?? 0} cm/min). Pre-emptive evacuation recommended for low-lying zones.`,
        critical: `[CRITICAL FLOOD ALERT] ${sensor.name} water depth at ${depthCm} cm (rise: ${riseCmMin ?? 0} cm/min). Immediate evacuation to nearest designated center.`,
      };

      const createdAlert = unwrap(
        await this.supabase.admin
          .from('flood_alerts')
          .insert({
            sensor_id: sensor.id,
            tier,
            previous_tier: prevTier,
            depth_cm: depthCm,
            rise_cm_min: riseCmMin,
            message: tierMsg[tier],
          })
          .select('*, sensor:flood_sensors(id, name, location_text)')
          .single(),
        'Failed to create flood alert',
      );

      alertRow = {
        ...createdAlert,
        depth_cm: Number(createdAlert.depth_cm),
        rise_cm_min: createdAlert.rise_cm_min !== null ? Number(createdAlert.rise_cm_min) : null,
      };

      this.realtime.emitToAll('flood:alert', alertRow);
      this.realtime.notifyDashboardRefresh('flood:alert');

      if (tier !== 'normal') {
        await this.notifications.notifyAllActiveUsers({
          type: 'flood_alert',
          title: `Flood ${tier.toUpperCase()}: ${sensor.name}`,
          body: tierMsg[tier],
          link: '/app/flood',
          data: { sensorId: sensor.id, tier, depthCm, riseCmMin },
        });
      }
    }

    return {
      reading: normalizedReading,
      sensor: sanitizedSensor,
      ...(alertRow ? { alert: alertRow } : {}),
    };
  }
}

@Controller('flood')
export class FloodController {
  constructor(private readonly flood: FloodService) {}

  @Get('sensors')
  listSensors() {
    return this.flood.listSensors();
  }

  @Get('sensors/:id/readings')
  listReadings(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.flood.listReadings(id, limit ? Number(limit) : 100);
  }

  @Get('alerts')
  listAlerts(@Query('limit') limit?: string) {
    return this.flood.listAlerts(limit ? Number(limit) : 30);
  }

  @Roles('admin')
  @Post('sensors')
  createSensor(@Body() dto: CreateSensorDto) {
    return this.flood.createSensor(dto);
  }
}

@Controller('iot')
export class IotController {
  constructor(private readonly flood: FloodService) {}

  @Public()
  @Post('readings')
  ingest(@Headers('x-device-key') deviceKey: string | undefined, @Body() dto: IngestReadingDto) {
    return this.flood.ingestReading(deviceKey, dto);
  }
}

@Module({
  controllers: [FloodController, IotController],
  providers: [FloodService],
  exports: [FloodService],
})
export class FloodModule {}
