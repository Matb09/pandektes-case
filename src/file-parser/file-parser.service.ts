/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import * as cheerio from 'cheerio';

@Injectable()
export class FileParserService {
  private readonly logger = new Logger(FileParserService.name);

  private readonly SUPPORTED_MIME_TYPES = [
    'application/pdf',
    'text/html',
    'application/xhtml+xml',
  ];

  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Parses a file buffer and extracts plain text content.
   * Supports PDF and HTML file types.
   */
  async parseFile(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
  ): Promise<{ text: string; fileType: 'PDF' | 'HTML' }> {
    this.validateFile(buffer, mimeType, fileName);

    if (mimeType === 'application/pdf') {
      return this.parsePdf(buffer);
    }

    return this.parseHtml(buffer);
  }

  private validateFile(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
  ): void {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Uploaded file is empty');
    }

    if (buffer.length > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    if (!this.SUPPORTED_MIME_TYPES.includes(mimeType)) {
      // Fallback: check file extension
      const ext = fileName?.split('.').pop()?.toLowerCase();
      if (ext !== 'pdf' && ext !== 'html' && ext !== 'htm') {
        throw new BadRequestException(
          `Unsupported file type: ${mimeType}. Supported types: PDF, HTML`,
        );
      }
    }
  }

  private async parsePdf(
    buffer: Buffer,
  ): Promise<{ text: string; fileType: 'PDF' }> {
    try {
      const uint8 = new Uint8Array(buffer);
      const parser = new PDFParse(uint8);
      const result = await parser.getText();
      const text = result.text?.trim();

      if (!text) {
        throw new BadRequestException(
          'Could not extract any text from the PDF. The file may be image-based or corrupted.',
        );
      }

      this.logger.log(
        `Extracted ${text.length} characters from PDF (${result.total} pages)`,
      );
      return { text, fileType: 'PDF' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`PDF parsing failed: ${error.message}`, error.stack);
      throw new BadRequestException(
        'Failed to parse PDF file. Ensure the file is a valid PDF document.',
      );
    }
  }

  private async parseHtml(
    buffer: Buffer,
  ): Promise<{ text: string; fileType: 'HTML' }> {
    try {
      const html = buffer.toString('utf-8');
      const $ = cheerio.load(html);

      // Remove non-content elements
      $('script, style, nav, footer, header, aside, noscript, iframe').remove();

      // Extract text from body, fallback to entire document
      let text = $('body').text() || $.root().text();

      // Clean up whitespace: collapse multiple spaces/newlines
      text = text
        .replace(/\s+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (!text) {
        throw new BadRequestException(
          'Could not extract any text from the HTML document.',
        );
      }

      this.logger.log(`Extracted ${text.length} characters from HTML`);
      return { text, fileType: 'HTML' };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(`HTML parsing failed: ${error.message}`, error.stack);
      throw new BadRequestException(
        'Failed to parse HTML file. Ensure the file is a valid HTML document.',
      );
    }
  }
}
