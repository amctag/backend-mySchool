import {
  BadRequestException,
  ValidationPipe,
  ValidationPipeOptions,
} from '@nestjs/common';
import type { ValidationError } from 'class-validator';

type FieldErrorMap = Record<string, string>;

function collectFieldErrors(
  errors: ValidationError[],
  messages: string[],
  fieldErrors: FieldErrorMap,
  parentPath = '',
): void {
  for (const error of errors) {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      const constraintMessages = Object.values(error.constraints);
      messages.push(...constraintMessages);
      if (constraintMessages.length > 0 && !fieldErrors[path]) {
        fieldErrors[path] = constraintMessages[0];
      }
    }

    if (error.children?.length) {
      collectFieldErrors(error.children, messages, fieldErrors, path);
    }
  }
}

/**
 * Builds a 400 response that keeps the usual `message` field for existing
 * clients and adds a `fieldErrors` map so forms can render each error under the
 * matching input instead of showing one generic banner.
 */
export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  const messages: string[] = [];
  const fieldErrors: FieldErrorMap = {};

  collectFieldErrors(errors, messages, fieldErrors);

  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: messages.length > 0 ? messages : ['Validation failed'],
    fieldErrors,
  });
}

export const validationPipeOptions: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
  exceptionFactory: validationExceptionFactory,
};

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe(validationPipeOptions);
}
