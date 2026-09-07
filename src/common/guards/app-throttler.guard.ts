import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { resolveThrottleTracker } from './throttle-tracker';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      path?: string;
      url?: string;
      originalUrl?: string;
    }>();
    const url = `${request.originalUrl ?? ''} ${request.url ?? ''} ${request.path ?? ''}`;

    if (
      url.includes('/docs') ||
      url.includes('/dashboard') ||
      url.includes('/parent') ||
      url.includes('/school/login') ||
      url.includes('/school/refresh')
    ) {
      return true;
    }

    return super.shouldSkip(context);
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    return resolveThrottleTracker(req);
  }
}
