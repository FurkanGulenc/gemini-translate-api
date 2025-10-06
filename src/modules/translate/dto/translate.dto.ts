import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
  IsEmpty,
} from 'class-validator';
import { Lang } from './lang.enum';

/**
 * 🔹 TranslateDto
 * Represents a translation request payload.
 * - When `autoLangDetection = true`, `sourceLang` MUST NOT be provided.
 * - When `autoLangDetection = false`, `sourceLang` is required.
 */
export class TranslateDto {
  @ApiProperty({
    description: 'The text to be translated.',
    example: 'Hello world',
  })
  @IsString()
  @IsNotEmpty()
  text!: string;

  @ApiProperty({
    description: 'Target language for translation.',
    example: Lang.TR,
    enum: Lang,
  })
  @Transform(({ value }) => value?.toUpperCase()) // normalize to uppercase
  @IsEnum(Lang)
  targetLang!: Lang;

  @ApiPropertyOptional({
    description:
      'Source language (required if `autoLangDetection` is false; MUST NOT be provided if true).',
    example: Lang.EN,
    enum: Lang,
  })
  @Transform(({ value }) => {
    // Treat empty string as undefined; otherwise normalize to uppercase
    if (value === '') return undefined;
    return value?.toUpperCase();
  })
  // When autodetect is OFF, sourceLang is required and must be a valid enum
  @ValidateIf((o: TranslateDto) => o.autoLangDetection === false)
  @IsEnum(Lang, {
    message: 'sourceLang must be provided when autoLangDetection is false',
  })
  // When autodetect is ON, sourceLang must NOT be provided
  @ValidateIf((o: TranslateDto) => o.autoLangDetection === true)
  @IsEmpty({ message: 'sourceLang must not be provided when autoLangDetection is true' })
  sourceLang?: Lang;

  @ApiPropertyOptional({
    description:
      'Enables automatic source language detection. Accepts "true" (string) or boolean true.',
    example: true,
    default: false,
  })
  @Transform(({ value }) =>
    value === true || value === 'true' || value === 1 || value === '1',
  )
  @IsBoolean()
  @IsOptional()
  autoLangDetection: boolean = false;
}
