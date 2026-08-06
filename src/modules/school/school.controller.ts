import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('School v1')
@Controller({ path: 'school', version: '1' })
export class SchoolController {}
