import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SupabaseService } from '../supabase/supabase.service';
import { CurrentUser, Roles } from '../common/decorators';
import { APP_ROLES, AppRole, AuthUser } from '../common/types';
import { escapeFilter, toColumns, unwrap, unwrapOne } from '../common/db';

export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  purok?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  address?: string;
}

export class AdminUpdateUserDto extends UpdateMyProfileDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetUserRoleDto {
  @IsIn(APP_ROLES)
  role!: AppRole;
}

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async updateMe(userId: string, dto: UpdateMyProfileDto) {
    const patch = toColumns(dto, {
      fullName: 'full_name',
      phone: 'phone',
      purok: 'purok',
      address: 'address',
    });
    if (Object.keys(patch).length === 0) {
      return unwrapOne(
        await this.supabase.admin.from('profiles').select('*').eq('id', userId).single(),
        'Profile',
      );
    }
    return unwrapOne(
      await this.supabase.admin.from('profiles').update(patch).eq('id', userId).select('*').single(),
      'Profile',
    );
  }

  async listAll(query: { role?: string; search?: string }) {
    let builder = this.supabase.admin
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (query.search && query.search.trim()) {
      const s = escapeFilter(query.search);
      builder = builder.or(`full_name.ilike.%${s}%,email.ilike.%${s}%,purok.ilike.%${s}%`);
    }

    const profiles = unwrap(await builder, 'Failed to list users') ?? [];
    const roleRows =
      unwrap(await this.supabase.admin.from('user_roles').select('user_id, role')) ?? [];

    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of roleRows as { user_id: string; role: AppRole }[]) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role);
      rolesByUser.set(r.user_id, list);
    }

    const merged = profiles.map((p: Record<string, unknown> & { id: string }) => ({
      ...p,
      roles: rolesByUser.get(p.id) ?? (['resident'] as AppRole[]),
    }));

    if (query.role && APP_ROLES.includes(query.role as AppRole)) {
      return merged.filter((u: { roles: AppRole[] }) => u.roles.includes(query.role as AppRole));
    }
    return merged;
  }

  async adminUpdateUser(id: string, dto: AdminUpdateUserDto) {
    const patch = toColumns(dto, {
      fullName: 'full_name',
      phone: 'phone',
      purok: 'purok',
      address: 'address',
      isActive: 'is_active',
    });
    const profile = unwrapOne(
      await this.supabase.admin.from('profiles').update(patch).eq('id', id).select('*').single(),
      'User',
    );
    const roleRows =
      unwrap(await this.supabase.admin.from('user_roles').select('role').eq('user_id', id)) ?? [];
    return {
      ...profile,
      roles: roleRows.map((r: { role: AppRole }) => r.role),
    };
  }

  async setUserRole(actorId: string, userId: string, role: AppRole) {
    if (actorId === userId && role !== 'admin') {
      throw new BadRequestException('Administrators cannot remove their own admin role');
    }
    const profile = unwrapOne(
      await this.supabase.admin.from('profiles').select('*').eq('id', userId).single(),
      'User',
    );

    await this.supabase.admin.from('user_roles').delete().eq('user_id', userId);
    unwrap(
      await this.supabase.admin.from('user_roles').insert({ user_id: userId, role }),
      'Failed to assign role',
    );

    return {
      ...profile,
      roles: [role],
    };
  }

  async listResponders() {
    const roleRows =
      unwrap(
        await this.supabase.admin
          .from('user_roles')
          .select('user_id')
          .in('role', ['responder', 'admin']),
      ) ?? [];
    const ids = Array.from(new Set(roleRows.map((r: { user_id: string }) => r.user_id)));
    if (ids.length === 0) return [];
    return unwrap(
      await this.supabase.admin
        .from('profiles')
        .select('id, full_name, email, phone, purok')
        .in('id', ids)
        .eq('is_active', true)
        .order('full_name'),
    );
  }
}

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMyProfileDto) {
    return this.users.updateMe(user.id, dto);
  }

  @Roles('admin', 'responder')
  @Get('responders')
  responders() {
    return this.users.listResponders();
  }

  @Roles('admin')
  @Get()
  list(@Query('role') role?: string, @Query('search') search?: string) {
    return this.users.listAll({ role, search });
  }

  @Roles('admin')
  @Patch(':id')
  adminUpdate(@Param('id') id: string, @Body() dto: AdminUpdateUserDto) {
    return this.users.adminUpdateUser(id, dto);
  }

  @Roles('admin')
  @Put(':id/role')
  setRole(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SetUserRoleDto) {
    return this.users.setUserRole(user.id, id, dto.role);
  }
}

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
