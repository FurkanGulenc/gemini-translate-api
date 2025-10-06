// src/modules/gemini/gemini.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';

@Injectable()
export class GeminiService {
  // Ortam değişkenleriyle esnek yapı
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly apiVersion = process.env.GEMINI_API_VERSION ?? 'v1beta'; // istersen 'v1' yapabilirsin
  private readonly model = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';
  private readonly baseUrl = `https://generativelanguage.googleapis.com/${this.apiVersion}`;

  /**
   * Prompt'ı alır, Gemini'ye gönderir ve düz metin yanıt döndürür.
   * Prompt üretimi iş mantığıdır; TranslateService içinde yapılmalıdır.
   */
  async generateContent(prompt: string, modelOverride?: string): Promise<string> {
    if (!this.apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY is not set');
    }

    const model = modelOverride ?? this.model;
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    const body = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e: any) {
      throw new InternalServerErrorException(
        `Gemini API network error: ${e?.message ?? e}`,
      );
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new InternalServerErrorException(
        `Gemini API error ${res.status}: ${errText}`,
      );
    }

    let data: any;
    try {
      data = await res.json();
    } catch {
      throw new InternalServerErrorException('Gemini API: invalid JSON response');
    }

    const text = this.extractText(data);
    if (!text) {
      throw new InternalServerErrorException('Gemini API returned empty response');
    }
    return text;
  }

  /**
   * Google cevabından düz metni güvenli şekilde çıkarır.
   * candidates[0].content.parts[*].text yapısını tarar.
   */
  private extractText(payload: any): string | null {
    const candidates = payload?.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) return null;

    const parts = candidates[0]?.content?.parts;
    if (Array.isArray(parts)) {
      for (const p of parts) {
        if (typeof p?.text === 'string' && p.text.trim()) {
          return p.text.trim();
        }
      }
    }

    const fallback = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof fallback === 'string' ? fallback.trim() : null;
  }
}
