import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { TranslateDto } from './dto/translate.dto';
import { Lang } from './dto/lang.enum';

@Injectable()
export class TranslateService {
  private readonly logger = new Logger(TranslateService.name);
  private readonly provider: string;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
    private readonly config: ConfigService,
  ) {
    this.provider = this.config.get<string>('TRANSLATION_PROVIDER', 'Gemini');
    this.model = this.config.get<string>('GEMINI_MODEL', 'gemini-1.5-flash');
  }

  async translate(dto: TranslateDto) {
    const { text, targetLang, sourceLang, autoLangDetection } = dto;

    if (!autoLangDetection && !sourceLang) {
      throw new BadRequestException(
        'sourceLang is required when autoLangDetection is false',
      );
    }

    this.logger.log('🚀 translate() called');

    let translatedText = '';
    let status: 'SUCCESS' | 'FAILED' = 'FAILED';

    try {
      // 1️⃣ Check DB cache first
      const cached = await this.checkCache(sourceLang, targetLang, text);
      if (cached) {
        this.logger.log('♻️ Cache hit - returning existing translation');
        return { translatedText: cached.translated_text, fromCache: true };
      }

      // 2️⃣ Build the translation prompt
      const prompt = autoLangDetection
        ? `
You are a professional translator.
Your task is to detect the source language of the text below and translate it precisely into **${targetLang}**.

Return **only the translated text**, without explanations, comments, or additional formatting.

Text:
"${text}"
        `.trim()
        : `
You are a professional translator.
Your task is to translate the text below from **${sourceLang}** to **${targetLang}**.

Do not attempt to detect or guess any other language.
Return **only the translated text**, without explanations, comments, or formatting.

Text:
"${text}"
        `.trim();

      // 3️⃣ Call Gemini API
      translatedText = await this.gemini.generateContent(prompt);
      status = 'SUCCESS';
      this.logger.log('✅ Gemini API response received successfully');
    } catch (error) {
      this.logger.error('❌ Gemini API call failed', error);
      translatedText = '[Translation failed]';
    }

    // 4️⃣ Save translation record to DB (success or failure)
    await this.saveToDatabase({
      sourceLang: sourceLang || Lang.AUTO,
      targetLang,
      sourceText: text,
      translatedText,
      provider: this.provider,
      model: this.model,
      status,
    });

    // 5️⃣ Return response
    return { translatedText, fromCache: false };
  }

  private async checkCache(
    sourceLang: Lang | undefined,
    targetLang: Lang,
    text: string,
  ) {
    return this.prisma.translations.findFirst({
      where: {
        source_lang: sourceLang,
        target_lang: targetLang,
        source_text: text,
      },
    });
  }

  private async saveToDatabase(record: {
    sourceLang: Lang;
    targetLang: Lang;
    sourceText: string;
    translatedText: string;
    provider: string;
    model: string;
    status: string;
  }) {
    await this.prisma.translations.create({
      data: {
        source_lang: record.sourceLang,
        target_lang: record.targetLang,
        source_text: record.sourceText,
        translated_text: record.translatedText,
        provider: record.provider,
        model: record.model,
        status: record.status,
        updated_at: new Date(),
      },
    });
  }
}
