import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Teacher v1')
@Controller({ path: 'teacher', version: '1' })
export class TeacherController {}
