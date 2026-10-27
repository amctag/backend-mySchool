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
import {
  readPrismaFieldName,
  REGISTER_ID_RANGE_MESSAGE,
} from '../constants/database-limits';

type ErrorBody = {
  statusCode: number;
  message: string | string[];
  error?: string;
  fieldErrors?: Record<string, string>;
  timestamp: string;
};

function prismaOutOfRangeDetails(meta: unknown): {
  message: string;
  fieldErrors?: Record<string, string>;
} {
  const fieldName = readPrismaFieldName(meta);

  if (fieldName.includes('register')) {
    return {
      message: REGISTER_ID_RANGE_MESSAGE,
      fieldErrors: { registerId: REGISTER_ID_RANGE_MESSAGE },
    };
  }

  return {
    message:
      'A numeric value is outside the range supported by this field. Check the value and try again.',
  };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ method?: string; url?: string }>();

    let status =
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
          ? (exceptionResponse.message as string | string[])
          : 'Internal server error';

    const body: ErrorBody = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    };

    if (
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      'fieldErrors' in exceptionResponse
    ) {
      body.fieldErrors = exceptionResponse.fieldErrors as Record<
        string,
        string
      >;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error(
        `Prisma ${exception.code} on ${request.method} ${request.url}: ${exception.message}`,
        exception.stack,
      );

      if (exception.code === 'P2020') {
        // Out-of-range value for a numeric column. This is a client input
        // problem, not a server failure, so answer with a clear 400.
        const details = prismaOutOfRangeDetails(exception.meta);
        status = HttpStatus.BAD_REQUEST;
        body.statusCode = status;
        body.message = details.message;
        if (details.fieldErrors) {
          body.fieldErrors = details.fieldErrors;
        }
      } else if (process.env.NODE_ENV !== 'production') {
        message = `Database error (${exception.code}): ${exception.message}`;
        body.message = message;
      } else {
        body.message = 'Internal server error';
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
        body.message = message;
      }
    }

    response.status(status).json(body);
  }
}
