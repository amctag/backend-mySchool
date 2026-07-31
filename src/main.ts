import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { createValidationPipe } from './config/validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(createValidationPipe());
  app.setGlobalPrefix('api');

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 3000;

  await app.listen(port);
}
bootstrap();
