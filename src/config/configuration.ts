/**
 * Tập trung đọc biến môi trường về object có kiểu rõ ràng.
 * Inject qua ConfigService<AppConfig> ở mọi nơi.
 */
export interface AppConfig {
  app: {
    env: string;
    port: number;
    apiPrefix: string;
    apiVersion: string;
    corsOrigins: string[];
    frontendUrl: string;
  };
  jwt: {
    accessSecret: string;
    accessExpires: string;
    refreshSecret: string;
    refreshExpires: string;
    mailSecret: string;
  };
  device: { maxPerUser: number };
  mail: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    fromName: string;
    fromAddress: string;
  };
  google: { clientId: string; clientSecret: string };
  s3: {
    endpoint: string;
    region: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    forcePathStyle: boolean;
    publicUrl: string;
    presignExpires: number;
  };
  bunny: {
    libraryId: string;
    apiKey: string;
    cdnHostname: string;
    tokenAuthKey: string;
    urlExpires: number;
  };
  sepay: {
    apiKey: string;
    webhookApiKey: string;
    bankAccount: string;
    bankName: string;
    accountHolder: string;
  };
  ga: { measurementId: string; propertyId: string; credentials: string };
  throttle: { ttl: number; limit: number };
}

export default (): AppConfig => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3001', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api',
    apiVersion: process.env.API_VERSION ?? 'v1',
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'access_secret',
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'refresh_secret',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '7d',
    mailSecret: process.env.JWT_MAIL_SECRET ?? 'mail_secret',
  },
  device: { maxPerUser: parseInt(process.env.MAX_DEVICES_PER_USER ?? '2', 10) },
  mail: {
    host: process.env.MAIL_HOST ?? '',
    port: parseInt(process.env.MAIL_PORT ?? '587', 10),
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER ?? '',
    password: process.env.MAIL_PASSWORD ?? '',
    fromName: process.env.MAIL_FROM_NAME ?? 'LMS',
    fromAddress: process.env.MAIL_FROM_ADDRESS ?? 'no-reply@example.com',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT ?? '',
    region: process.env.S3_REGION ?? 'us-east-1',
    accessKey: process.env.S3_ACCESS_KEY ?? '',
    secretKey: process.env.S3_SECRET_KEY ?? '',
    bucket: process.env.S3_BUCKET ?? 'lms-media',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    publicUrl: process.env.S3_PUBLIC_URL ?? '',
    presignExpires: parseInt(process.env.S3_PRESIGN_EXPIRES ?? '900', 10),
  },
  bunny: {
    libraryId: process.env.BUNNY_STREAM_LIBRARY_ID ?? '',
    apiKey: process.env.BUNNY_STREAM_API_KEY ?? '',
    cdnHostname: process.env.BUNNY_STREAM_CDN_HOSTNAME ?? '',
    tokenAuthKey: process.env.BUNNY_TOKEN_AUTH_KEY ?? '',
    urlExpires: parseInt(process.env.BUNNY_URL_EXPIRES ?? '10800', 10),
  },
  sepay: {
    apiKey: process.env.SEPAY_API_KEY ?? '',
    webhookApiKey: process.env.SEPAY_WEBHOOK_API_KEY ?? '',
    bankAccount: process.env.SEPAY_BANK_ACCOUNT ?? '',
    bankName: process.env.SEPAY_BANK_NAME ?? '',
    accountHolder: process.env.SEPAY_ACCOUNT_HOLDER ?? '',
  },
  ga: {
    measurementId: process.env.GA_MEASUREMENT_ID ?? '',
    propertyId: process.env.GA_PROPERTY_ID ?? '',
    credentials: process.env.GA_API_CREDENTIALS ?? '',
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
  },
});
