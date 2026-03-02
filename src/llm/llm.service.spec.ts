/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { LlmService } from './llm.service';

// Mock the OpenAI module
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  }));
});

// Mock tiktoken
jest.mock('tiktoken', () => ({
  get_encoding: jest.fn().mockReturnValue({
    encode: jest.fn((text: string) => {
      // Simple mock: 1 token = 1 char for testing logic
      return Array.from(text).map((c) => c.charCodeAt(0));
    }),
    decode: jest.fn((tokens: Uint32Array) => {
      return Array.from(tokens)
        .map((t) => String.fromCharCode(t))
        .join('');
    }),
    free: jest.fn(),
  }),
}));

describe('LlmService', () => {
  let service: LlmService;
  let mockCreate: jest.Mock;

  const mockLlmResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            title: 'Smith v. Jones',
            decisionType: 'Judgment',
            dateOfDecision: '2023-06-15',
            office: null,
            court: 'Supreme Court',
            caseNumber: '22-1234',
            summary: 'This case involved...',
            conclusion: 'The court ruled...',
          }),
        },
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                'openai.apiKey': 'sk-test-key',
                'openai.model': 'gpt-5.2',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
    service.onModuleInit();

    // Access the mocked create method
    mockCreate = (service as any).client.chat.completions.create;
  });

  describe('extractCaseLawMetadata', () => {
    it('should extract metadata successfully', async () => {
      mockCreate.mockResolvedValue(mockLlmResponse);

      const result = await service.extractCaseLawMetadata(
        'Some case law text...',
      );

      expect(result).toEqual({
        title: 'Smith v. Jones',
        decisionType: 'Judgment',
        dateOfDecision: '2023-06-15',
        office: null,
        court: 'Supreme Court',
        caseNumber: '22-1234',
        summary: 'This case involved...',
        conclusion: 'The court ruled...',
      });
    });

    it('should throw on OpenAI API error unconditionally (relying on SDK for internal retries)', async () => {
      const error = new Error('Rate limit') as any;
      error.status = 429;

      mockCreate.mockRejectedValue(error);

      await expect(
        service.extractCaseLawMetadata('Some text...'),
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should throw on invalid JSON response', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'not json' } }],
      });

      await expect(
        service.extractCaseLawMetadata('Some text...'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw on missing required fields or zod validation failure', async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: 'Test',
                // Missing other required fields
              }),
            },
          },
        ],
      });

      await expect(
        service.extractCaseLawMetadata('Some text...'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should truncate text exceeding 80k tokens', async () => {
      mockCreate.mockResolvedValue(mockLlmResponse);

      // Since our mock tiktoken uses 1 char = 1 token, this is 150k tokens
      const longText = 'x'.repeat(150_000);
      await service.extractCaseLawMetadata(longText);

      // Verify the text sent to OpenAI was truncated
      const callArgs = mockCreate.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');
      expect(userMessage.content).toContain('[...TEXT TRUNCATED...]');
      // 80k max tokens + truncation marker length
      expect(userMessage.content.length).toBeLessThan(81_000);
    });

    it('should handle empty response choices gracefully', async () => {
      mockCreate.mockResolvedValue({ choices: [] });

      await expect(
        service.extractCaseLawMetadata('Some text...'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
