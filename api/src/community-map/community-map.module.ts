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
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SupabaseService } from '../supabase/supabase.service';
import { CurrentUser, Roles } from '../common/decorators';
import { AuthUser, isStaff, LOCATION_CATEGORIES } from '../common/types';
import { toColumns, unwrap, unwrapOne } from '../common/db';

export class CreateLocationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsIn(LOCATION_CATEGORIES)
  category!: (typeof LOCATION_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;

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
  @IsString()
  @MaxLength(40)
  contactNumber?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  isAccessible?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsIn(LOCATION_CATEGORIES)
  category?: (typeof LOCATION_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactNumber?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacity?: number | null;

  @IsOptional()
  @IsBoolean()
  isAccessible?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

@Injectable()
export class CommunityMapService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(user: AuthUser, category?: string) {
    let builder = this.supabase.admin
      .from('community_locations')
      .select('*')
      .order('name', { ascending: true });

    if (!isStaff(user)) {
      builder = builder.eq('is_public', true);
    }
    if (category && (LOCATION_CATEGORIES as readonly string[]).includes(category)) {
      builder = builder.eq('category', category);
    }

    return unwrap(await builder, 'Failed to load community locations');
  }

  async create(user: AuthUser, dto: CreateLocationDto) {
    return unwrap(
      await this.supabase.admin
        .from('community_locations')
        .insert({
          name: dto.name.trim(),
          category: dto.category,
          description: dto.description?.trim() || null,
          address: dto.address?.trim() || null,
          latitude: dto.latitude,
          longitude: dto.longitude,
          contact_number: dto.contactNumber?.trim() || null,
          capacity: dto.capacity ?? null,
          is_accessible: Boolean(dto.isAccessible),
          is_public: dto.isPublic !== undefined ? dto.isPublic : true,
          created_by: user.id,
        })
        .select('*')
        .single(),
      'Failed to create community location',
    );
  }

  async update(id: string, dto: UpdateLocationDto) {
    const patch = toColumns(dto, {
      name: 'name',
      category: 'category',
      description: 'description',
      address: 'address',
      latitude: 'latitude',
      longitude: 'longitude',
      contactNumber: 'contact_number',
      capacity: 'capacity',
      isAccessible: 'is_accessible',
      isPublic: 'is_public',
    });
    return unwrapOne(
      await this.supabase.admin
        .from('community_locations')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single(),
      'Community location',
    );
  }

  async remove(id: string) {
    unwrap(
      await this.supabase.admin.from('community_locations').delete().eq('id', id),
      'Failed to delete community location',
    );
    return { success: true };
  }
}

@Controller('locations')
export class CommunityMapController {
  constructor(private readonly locations: CommunityMapService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('category') category?: string) {
    return this.locations.list(user, category);
  }

  @Roles('admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateLocationDto) {
    return this.locations.create(user, dto);
  }

  @Roles('admin')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locations.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.locations.remove(id);
  }
}

@Module({
  controllers: [CommunityMapController],
  providers: [CommunityMapService],
  exports: [CommunityMapService],
})
export class CommunityMapModule {}
