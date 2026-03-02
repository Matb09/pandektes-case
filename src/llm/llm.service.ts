/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  Logger,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { get_encoding, Tiktoken } from 'tiktoken';

export const CaseLawSchema = z.object({
  title: z
    .string()
    .describe("The full title of the case (e.g., 'Smith v. Jones')"),
  decisionType: z
    .string()
    .describe(
      "The type of decision (e.g., 'Judgment', 'Order', 'Opinion', 'Ruling', 'Decree', 'Advisory Opinion')",
    ),
  dateOfDecision: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .describe(
      'The date of the decision in ISO 8601 format (YYYY-MM-DD). If only a year is available, use January 1st of that year (YYYY-01-01).',
    ),
  office: z
    .string()
    .nullable()
    .describe(
      'The office or chamber that issued the decision (null if not identifiable)',
    ),
  court: z
    .string()
    .describe(
      "The full name of the court (e.g., 'Supreme Court of the United States', 'Court of Justice of the European Union')",
    ),
  caseNumber: z
    .string()
    .describe(
      "The official case number or reference (e.g., 'Case C-131/12', '19-1392')",
    ),
  summary: z
    .string()
    .describe(
      'A comprehensive summary of the case covering: the parties involved, the legal questions at issue, the key facts, the legal reasoning, and any relevant precedents cited. This should be 3-5 paragraphs.',
    ),
  conclusion: z
    .string()
    .describe(
      "A clear statement of the court's conclusion/holding, including the disposition (affirmed, reversed, remanded, etc.) and any orders or declarations made. This should be 1-2 paragraphs.",
    ),
});

export type ExtractedCaseLawData = z.infer<typeof CaseLawSchema>;

@Injectable()
export class LlmService implements OnModuleInit {
  private readonly logger = new Logger(LlmService.name);
  private client: OpenAI;
  private model: string;
  private tokenizer: Tiktoken;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.configService.get<string>('openai.apiKey');
    if (!apiKey || apiKey === 'sk-your-openai-api-key-here') {
      this.logger.warn(
        '⚠️  OPENAI_API_KEY is not configured. LLM extraction will fail until a valid key is provided.',
      );
    }
    // Initialize OpenAI SDK. Note: maxRetries defaults to 2 with exponential backoff on 429/5xx automatically.
    this.client = new OpenAI({ apiKey });
    this.model =
      this.configService.get<string>('openai.model') || 'gpt-4o-2024-08-06';
    this.tokenizer = get_encoding('cl100k_base');
    this.logger.log(`LLM Service initialized with model: ${this.model}`);
  }

  /**
   * Truncates text accurately by token boundaries instead of characters.
   * Takes the first half and last half if it exceeds the max token limit.
   */
  private truncateByTokens(text: string, maxTokens: number = 80000): string {
    const tokens = this.tokenizer.encode(text);
    if (tokens.length <= maxTokens) {
      return text;
    }

    this.logger.log(
      `Document exceeds ${maxTokens} tokens limit (${tokens.length} tokens). Truncating bounds.`,
    );
    const halfLimit = Math.floor(maxTokens / 2);

    // Take the first 40k tokens and last 40k tokens
    const startTokens = Array.from(tokens.slice(0, halfLimit));
    const endTokens = Array.from(tokens.slice(tokens.length - halfLimit));

    const startText = this.tokenizer.decode(new Uint32Array(startTokens));
    const endText = this.tokenizer.decode(new Uint32Array(endTokens));

    return startText + '\n\n[...TEXT TRUNCATED...]\n\n' + endText;
  }

  /**
   * Extracts structured case law metadata from raw text using OpenAI.
   * Uses Structured Outputs via Zod for reliable extraction.
   */
  async extractCaseLawMetadata(text: string): Promise<ExtractedCaseLawData> {
    try {
      const truncatedText = this.truncateByTokens(text);

      this.logger.log(
        `Initiating LLM extraction for ${truncatedText.length} chars...`,
      );

      const response = await this.client.chat.completions.create({
        model: this.model,
        response_format: zodResponseFormat(CaseLawSchema, 'case_law_metadata'),
        temperature: 0.1, // Low temperature for consistent extraction
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: `Extract the case law metadata from the following document text:\n\n${truncatedText}`,
          },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from LLM');
      }

      const parsed = this.parseAndValidateResponse(content);
      this.logger.log(
        `Successfully extracted metadata: "${parsed.title}" (${parsed.caseNumber}) using model: ${response.model}`,
      );
      return parsed;
    } catch (error: any) {
      this.logger.error(`LLM extraction failed: ${error.message}`, error.stack);
      throw new InternalServerErrorException(
        'Failed to extract case law metadata. Please try again later.',
      );
    }
  }

  private getSystemPrompt(): string {
    return `You are a legal document analysis expert. Your task is to extract structured metadata from case law documents.

Rules:
- Extract information ONLY from the provided text. Do not hallucinate or infer data not present.
- If a field cannot be determined from the text, use your best judgment based on context clues.
- For dateOfDecision, if only a year is available, use January 1st of that year (YYYY-01-01).
- The summary should be detailed enough to give a reader a complete understanding of the case without reading the original document.
- The conclusion should clearly state the outcome and any remedies ordered.`;
  }

  private parseAndValidateResponse(content: string): ExtractedCaseLawData {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(
        `LLM returned invalid JSON: ${content.substring(0, 200)}`,
      );
    }

    // Validate using Zod. This natively ensures the date fits the YYYY-MM-DD regex.
    const result = CaseLawSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Zod validation failed: ${result.error.message}`);
    }

    const data = result.data;

    // Ensure strings are trimmed
    data.title = data.title.trim();
    data.decisionType = data.decisionType.trim();
    data.court = data.court.trim();
    data.caseNumber = data.caseNumber.trim();
    data.summary = data.summary.trim();
    data.conclusion = data.conclusion.trim();
    if (data.office) {
      data.office = data.office.trim();
    }

    return data;
  }
}
