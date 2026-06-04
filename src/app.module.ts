import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './integrations/mail/mail.module';
import { StorageModule } from './integrations/storage/storage.module';
import { BunnyModule } from './integrations/bunny/bunny.module';
// feature modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AdminsModule } from './modules/admins/admins.module';
import { DevicesModule } from './modules/devices/devices.module';
import { CoursesModule } from './modules/courses/courses.module';
import { ProgressModule } from './modules/progress/progress.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { StatsModule } from './modules/stats/stats.module';
import { MediaModule } from './modules/media/media.module';
import { AccessLogsModule } from './modules/access-logs/access-logs.module';
import { ContentModule } from './modules/content/content.module';
import { MenusModule } from './modules/menus/menus.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CommunityModule } from './modules/community/community.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ActivityModule } from './modules/activity/activity.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        autoLogging: true,
        redact: ['req.headers.authorization', 'req.body.password'],
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: (parseInt(process.env.THROTTLE_TTL ?? '60', 10)) * 1000,
        limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
      },
    ]),
    ScheduleModule.forRoot(),
    // global infra
    PrismaModule,
    MailModule,
    StorageModule,
    BunnyModule,
    // features
    AuthModule,
    UsersModule,
    AdminsModule,
    DevicesModule,
    CoursesModule,
    ProgressModule,
    OrdersModule,
    PaymentsModule,
    StatsModule,
    MediaModule,
    AccessLogsModule,
    ContentModule,
    MenusModule,
    DocumentsModule,
    NotificationsModule,
    CommunityModule,
    SettingsModule,
    ActivityModule,
  ],
  providers: [
    // JWT toàn cục (route @Public bỏ qua), kế đến RolesGuard, rồi Throttler
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
