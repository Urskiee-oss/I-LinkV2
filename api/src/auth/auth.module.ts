import {
  BadRequestException,
  CanActivate,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  Global,
  Injectable,
  Module,
  ServiceUnavailableException,
  UnauthorizedException,
  Controller,
  Get,
  Post,
  Body,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { SupabaseService } from '../supabase/supabase.service';
import { AppRole, AuthUser, primaryRoleOf } from '../common/types';
import { CurrentUser, IS_PUBLIC_KEY, Public, ROLES_KEY } from '../common/decorators';
import { unwrap } from '../common/db';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  purok?: string;
}

@Injectable()
export class AuthService {
  constructor(private readonly supabase: SupabaseService) {}

  private ensureConfigured() {
    if (!this.supabase.configured) {
      throw new ServiceUnavailableException(
        'Supabase is not configured on the API server. Set SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in api/.env',
      );
    }
  }

  /** Validate a Supabase access token and hydrate profile + roles. */
  async resolveToken(token: string): Promise<AuthUser> {
    this.ensureConfigured();
    if (!token) throw new UnauthorizedException('Missing access token');
    const { data, error } = await this.supabase.auth.auth.getUser(token);
    if (error || !data?.user) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const userId = data.user.id;
    const email = data.user.email ?? '';

    const [{ data: profile }, { data: roleRows }] = await Promise.all([
      this.supabase.admin.from('profiles').select('*').eq('id', userId).maybeSingle(),
      this.supabase.admin.from('user_roles').select('role').eq('user_id', userId),
    ]);

    if (profile && profile.is_active === false) {
      throw new ForbiddenException('Your account has been deactivated by a barangay administrator');
    }

    const roles: AppRole[] =
      roleRows && roleRows.length > 0
        ? (roleRows.map((r: { role: AppRole }) => r.role) as AppRole[])
        : ['resident'];

    // Self-heal profile if auth trigger has not yet fired
    if (!profile) {
      const fullName =
        (data.user.user_metadata?.full_name as string | undefined) || email.split('@')[0] || 'Resident';
      await this.supabase.admin
        .from('profiles')
        .upsert({ id: userId, full_name: fullName, email }, { onConflict: 'id' });
      await this.supabase.admin
        .from('user_roles')
        .upsert({ user_id: userId, role: 'resident' }, { onConflict: 'user_id,role' });
    }

    return {
      id: userId,
      email,
      roles,
      primaryRole: primaryRoleOf(roles),
      fullName: profile?.full_name ?? email,
    };
  }

  async register(dto: RegisterDto) {
    this.ensureConfigured();
    const email = dto.email.trim().toLowerCase();
    const { data, error } = await this.supabase.admin.auth.admin.createUser({
      email,
      password: dto.password,
      email_confirm: true,
      user_metadata: {
        full_name: dto.fullName.trim(),
        phone: dto.phone?.trim() || null,
        purok: dto.purok?.trim() || null,
      },
    });

    if (error) {
      if (/already|exists|registered/i.test(error.message)) {
        throw new ConflictException('An account with this email already exists');
      }
      throw new BadRequestException(error.message);
    }

    const userId = data.user.id;
    // Guarantee profile & resident role exist immediately
    await this.supabase.admin.from('profiles').upsert(
      {
        id: userId,
        full_name: dto.fullName.trim(),
        email,
        phone: dto.phone?.trim() || null,
        purok: dto.purok?.trim() || null,
      },
      { onConflict: 'id' },
    );
    await this.supabase.admin
      .from('user_roles')
      .upsert({ user_id: userId, role: 'resident' }, { onConflict: 'user_id,role' });

    return { id: userId, email };
  }

  async getMe(user: AuthUser) {
    const profile = unwrap(
      await this.supabase.admin.from('profiles').select('*').eq('id', user.id).single(),
      'Failed to load profile',
    );
    return {
      id: user.id,
      email: user.email,
      roles: user.roles,
      primary_role: user.primaryRole,
      profile,
    };
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.authorization;
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Authorization Bearer token required');
    }
    const token = header.slice(7).trim();
    req.user = await this.auth.resolveToken(token);
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    if (!user) throw new UnauthorizedException();

    const allowed = required.some((role) => user.roles.includes(role));
    if (!allowed) {
      throw new ForbiddenException(`Requires role: ${required.join(' or ')}`);
    }
    return true;
  }
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.getMe(user);
  }
}

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RolesGuard],
  exports: [AuthService, AuthGuard, RolesGuard],
})
export class AuthModule {}
