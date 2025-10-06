import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TranslateDto } from './dto/translate.dto';
import { TranslateService } from './translate.service';  

@ApiTags('Translate')
@Controller('translate')
export class TranslateController {
  constructor(private readonly translateService: TranslateService) {} 

  @Post()
  @ApiOperation({
    summary: 'Performs text translation using Gemini API with database caching.',
    description:
      'This endpoint translates input text into the specified target language. It first checks the database for existing translations (cache) before making a Gemini API call.',
  })
  @ApiResponse({
    status: 200,
    description: 'Translation successful (either cached or newly generated).',
    schema: {
      example: {
        translatedText: 'Hello world',
        fromCache: false,
      },
    },
  })
  async translate(@Body() dto: TranslateDto) {
    return this.translateService.translate(dto);
  }
}
