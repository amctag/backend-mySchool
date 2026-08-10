import { ServiceUnavailableException } from '@nestjs/common';

export class MailSendFailedException extends ServiceUnavailableException {
  constructor(message = 'Unable to send verification email. Please try again later.') {
    super(message);
  }
}
