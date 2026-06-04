import { Global, Module } from '@nestjs/common';
import { BunnyService } from './bunny.service';

@Global()
@Module({
  providers: [BunnyService],
  exports: [BunnyService],
})
export class BunnyModule {}
