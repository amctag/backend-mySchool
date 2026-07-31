import { Controller, Get } from '@nestjs/common';
import { NoticesService } from './notices.service';

@Controller('notices')
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Get()
  findAll() {
    return this.noticesService.findAll();
  }
}
