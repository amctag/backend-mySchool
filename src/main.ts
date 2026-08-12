import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cors from 'cors';
import { AppModule } from './app.module';
import { createCorsDelegate } from './config/cors';
import { createValidationPipe } from './config/validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  app.getHttpAdapter().getInstance().use(
    cors(
      createCorsDelegate({
        allowedOrigins: configService.get<string[]>('cors.origins') ?? [],
        allowLocalhost: configService.get<boolean>('cors.allowLocalhost') ?? true,
        allowSameHost: configService.get<boolean>('cors.allowSameHost') ?? true,
      }),
    ),
  );

  app.useGlobalPipes(createValidationPipe());
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('My School API')
    .setDescription('School management system API v1')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Parent Auth v1', 'Login, refresh, logout, and forgot password')
    .addTag('Parent Profile v1', 'Parent profile, children, and change password')
    .addTag('Parent Schedule v1', 'Weekly schedule')
    .addTag('Parent Announcements v1', 'Announcements for parents')
    .addTag('Parent Activities v1', 'School activities and events for parents')
    .addTag('Parent Attendance v1', 'Student absence days for parents')
    .addTag('Parent Notices v1', 'Notices for parent children')
    .addTag('Teacher v1', 'Teacher endpoints')
    .addTag('School v1', 'School information and details')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('app.port') ?? 3000;

  await app.listen(port);
}
bootstrap();
