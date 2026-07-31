import { Controller, Get } from '@nestjs/common';
import { SchoolService } from './school.service';

@Controller('school')
export class SchoolController {
  constructor(private readonly schoolService: SchoolService) {}

  @Get()
  findAll() {
    return this.schoolService.findAll();
  }
}
