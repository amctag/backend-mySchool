import { Controller, Get } from '@nestjs/common';
import { AgendaService } from './agenda.service';

@Controller('agenda')
export class AgendaController {
  constructor(private readonly agendaService: AgendaService) {}

  @Get()
  findAll() {
    return this.agendaService.findAll();
  }
}
