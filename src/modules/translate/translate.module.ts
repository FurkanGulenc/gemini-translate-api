// src/modules/translate/translate.module.ts
import { Module } from '@nestjs/common';
import { TranslateController } from './translate.controller';
import { TranslateService } from './translate.service';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [GeminiModule],
  controllers: [TranslateController],
  providers: [TranslateService],
})
export class TranslateModule {}
