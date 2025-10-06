import {
  Injectable,
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
    let detectedSourceLang: string | null = null; // only for DB
    let status: 'SUCCESS' | 'FAILED' = 'FAILED';

    try {
      // 1️⃣ Check DB cache first
      const cached = await this.checkCache(sourceLang, targetLang, text);
      if (cached) {
        this.logger.log('♻️ Cache hit - returning existing translation');
        return { translatedText: cached.translated_text, fromCache: true };
      }

      // 2️⃣ Build the translation prompt (STRICT JSON, no code fences)
      const prompt = autoLangDetection
        ? `
You are a professional translator.
Detect the source language of the following text and translate it precisely into ${targetLang}.
Respond **ONLY** with valid JSON. **Do not** include markdown code fences, backticks, or any text outside JSON.
The JSON schema must be exactly:
{
  "detectedLang": "<DETECTED_SOURCE_LANG_CODE>",
  "translation": "<TRANSLATED_TEXT>"
}

Text:
"${text}"
        `.trim()
        : `
You are a professional translator.
Translate the following text from ${sourceLang} to ${targetLang}.
Respond **ONLY** with valid JSON. **Do not** include markdown code fences, backticks, or any text outside JSON.
The JSON schema must be exactly:
{
  "translation": "<TRANSLATED_TEXT>"
}

Text:
"${text}"
        `.trim();

      // 3️⃣ Call Gemini API
      const response = await this.gemini.generateContent(prompt);

      // Try to parse JSON, tolerating accidental code fences/backticks
      try {
        const parsed = JSON.parse(
          response
            .trim()
            .replace(/^```(?:json)?\s*/i, '') // remove leading ``` or ```json
            .replace(/```$/i, '')            // remove trailing ```
            .trim(),
        );

        translatedText =
          typeof parsed === 'string'
            ? parsed
            : parsed.translation || '[No translation returned]';

        detectedSourceLang = autoLangDetection
          ? (parsed.detectedLang
              ? String(parsed.detectedLang).toUpperCase()
              : null)
          : null;
      } catch (parseError) {
        this.logger.warn(
          '⚠️ Gemini did not return strict JSON; using raw text as translation.',
        );
        translatedText = response; // fallback to raw text
        detectedSourceLang = autoLangDetection ? 'UNKNOWN' : null;
      }

      status = 'SUCCESS';
      this.logger.log('✅ Gemini API response received successfully');
    } catch (error) {
      this.logger.error('❌ Gemini API call failed', error);
      translatedText = '[Translation failed]';
      detectedSourceLang = null;
      status = 'FAILED';
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
      detectedSourceLang, // only persisted
    });

    // 5️⃣ Return response (UNCHANGED)
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
    detectedSourceLang?: string | null;
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
        detected_source_lang: record.detectedSourceLang ?? null,
        updated_at: new Date(),
      },
    });
  }
}
