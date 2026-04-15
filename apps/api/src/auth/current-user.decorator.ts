import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';

import type { AuthenticatedUser } from './jwt.strategy';

/**
 * Pulls the authenticated user out of the request.
 * Must be used on routes guarded by `JwtAuthGuard`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.user as AuthenticatedUser;
  },
);
