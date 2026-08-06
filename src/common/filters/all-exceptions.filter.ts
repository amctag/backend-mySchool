import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ method?: string; url?: string }>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : exceptionResponse &&
            typeof exceptionResponse === 'object' &&
            'message' in exceptionResponse
          ? exceptionResponse.message
          : 'Internal server error';

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error(
        `Prisma ${exception.code} on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );

      if (process.env.NODE_ENV !== 'production') {
        message = `Database error (${exception.code}): ${exception.message}`;
      }
    } else if (!(exception instanceof HttpException)) {
      const errorMessage =
        exception instanceof Error ? exception.message : String(exception);
      const stack = exception instanceof Error ? exception.stack : undefined;

      this.logger.error(
        `${errorMessage} on ${request.method} ${request.url}`,
        stack,
      );

      if (process.env.NODE_ENV !== 'production') {
        message = errorMessage;
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
