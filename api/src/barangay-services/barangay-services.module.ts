import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SupabaseService } from '../supabase/supabase.service';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser } from '../common/types';
import { escapeFilter, toColumns, unwrap, unwrapOne } from '../common/db';

export class CreateServiceDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  procedureSteps?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fee?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  processingTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  office?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  officeHours?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  contactNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactEmail?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requirements?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  procedureSteps?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fee?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  processingTime?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  office?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  officeHours?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  contactNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactEmail?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Injectable()
export class BarangayServicesService {
  constructor(private readonly supabase: SupabaseService) {}

  async listActive(search?: string) {
    let builder = this.supabase.admin
      .from('barangay_services')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (search && search.trim()) {
      const s = escapeFilter(search);
      builder = builder.or(`name.ilike.%${s}%,description.ilike.%${s}%,category.ilike.%${s}%`);
    }
    return unwrap(await builder, 'Failed to load barangay services');
  }

  async listManage() {
    return unwrap(
      await this.supabase.admin
        .from('barangay_services')
        .select('*')
        .order('name', { ascending: true }),
      'Failed to load barangay services',
    );
  }

  async getOne(id: string) {
    return unwrapOne(
      await this.supabase.admin.from('barangay_services').select('*').eq('id', id).single(),
      'Barangay service',
    );
  }

  async create(user: AuthUser, dto: CreateServiceDto) {
    return unwrap(
      await this.supabase.admin
        .from('barangay_services')
        .insert({
          name: dto.name.trim(),
          category: dto.category?.trim() || 'certificate',
          description: dto.description.trim(),
          requirements: (dto.requirements ?? []).map((s) => s.trim()).filter(Boolean),
          procedure_steps: (dto.procedureSteps ?? []).map((s) => s.trim()).filter(Boolean),
          fee: dto.fee?.trim() || null,
          processing_time: dto.processingTime?.trim() || null,
          office: dto.office?.trim() || null,
          office_hours: dto.officeHours?.trim() || null,
          contact_number: dto.contactNumber?.trim() || null,
          contact_email: dto.contactEmail?.trim() || null,
          is_active: dto.isActive !== undefined ? dto.isActive : true,
          created_by: user.id,
        })
        .select('*')
        .single(),
      'Failed to create barangay service',
    );
  }

  async update(id: string, dto: UpdateServiceDto) {
    const patch = toColumns(dto, {
      name: 'name',
      category: 'category',
      description: 'description',
      requirements: 'requirements',
      procedureSteps: 'procedure_steps',
      fee: 'fee',
      processingTime: 'processing_time',
      office: 'office',
      officeHours: 'office_hours',
      contactNumber: 'contact_number',
      contactEmail: 'contact_email',
      isActive: 'is_active',
    });
    return unwrapOne(
      await this.supabase.admin
        .from('barangay_services')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single(),
      'Barangay service',
    );
  }

  async remove(id: string) {
    unwrap(
      await this.supabase.admin.from('barangay_services').delete().eq('id', id),
      'Failed to delete barangay service',
    );
    return { success: true };
  }
}

@Controller('services')
export class BarangayServicesController {
  constructor(private readonly services: BarangayServicesService) {}

  @Get()
  list(@Query('search') search?: string) {
    return this.services.listActive(search);
  }

  @Roles('admin')
  @Get('manage')
  listManage() {
    return this.services.listManage();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.services.getOne(id);
  }

  @Roles('admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateServiceDto) {
    return this.services.create(user, dto);
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.services.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.services.remove(id);
  }
}

@Module({
  controllers: [BarangayServicesController],
  providers: [BarangayServicesService],
  exports: [BarangayServicesService],
})
export class BarangayServicesModule {}
