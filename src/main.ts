import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService<AppConfig, true>);
  const appCfg = config.get('app', { infer: true });

  // /api/v1
  app.setGlobalPrefix(appCfg.apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: appCfg.apiVersion.replace(/^v/, ''),
    prefix: 'v',
  });

  app.enableCors({
    origin: appCfg.corsOrigins.length ? appCfg.corsOrigins : true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.get(Reflector); // ensure reflector available

  // Swagger docs tại /api/docs
  const swaggerCfg = new DocumentBuilder()
    .setTitle('LMS Dashboard API')
    .setDescription('API cho hệ thống LMS (Admin & Học viên).')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerCfg);
  SwaggerModule.setup(`${appCfg.apiPrefix}/docs`, app, document);

  await app.listen(appCfg.port);
  // eslint-disable-next-line no-console
  console.log(
    `🚀 LMS API chạy tại http://localhost:${appCfg.port}/${appCfg.apiPrefix}/${appCfg.apiVersion}`,
  );
}
void bootstrap();
