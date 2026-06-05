import { Module } from '@nestjs/common';
import { LandingCoursesController } from './landing-courses.controller';
import { LandingCoursesService } from './landing-courses.service';

@Module({
  controllers: [LandingCoursesController],
  providers: [LandingCoursesService],
  exports: [LandingCoursesService],
})
export class LandingCoursesModule {}
