import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const SHA256_HEX = /^[a-f0-9]{64}$/i;

@ValidatorConstraint({ name: 'isRawFcmDeviceToken', async: false })
class IsRawFcmDeviceTokenConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    const token = value.trim();
    if (token.length < 32 || token.length > 4096) {
      return false;
    }

    return !SHA256_HEX.test(token);
  }

  defaultMessage(): string {
    return 'Send the raw Firebase FCM device token. Do not hash it with SHA-256.';
  }
}

export function IsRawFcmDeviceToken(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isRawFcmDeviceToken',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsRawFcmDeviceTokenConstraint,
    });
  };
}
