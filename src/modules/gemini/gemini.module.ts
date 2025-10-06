// src/modules/gemini/gemini.module.ts
import { Module } from '@nestjs/common';
import { GeminiService } from './gemini.service';

@Module({
  providers: [GeminiService],
  exports: [GeminiService], // dış modüller de kullanabilsin
})
export class GeminiModule {}
