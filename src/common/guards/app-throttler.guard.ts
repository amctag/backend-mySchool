import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (process.env.THROTTLE_DISABLED === 'true') {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ path?: string }>();

    if (request.path?.startsWith('/api/docs')) {
      return true;
    }

    return super.shouldSkip(context);
  }
}
