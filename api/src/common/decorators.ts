import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { AppRole, AuthUser } from './types';

export const IS_PUBLIC_KEY = 'isPublic';
/** Skip bearer-token authentication for this route. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Restrict a route to users holding at least one of the given roles. */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);

/** Inject the authenticated user resolved by AuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest();
  return req.user as AuthUser;
});
