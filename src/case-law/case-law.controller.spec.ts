/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CaseLawController } from './case-law.controller';
import { CaseLawService } from './case-law.service';
import { CaseLaw, SourceFileType } from './entities/case-law.entity';

describe('CaseLawController', () => {
  let controller: CaseLawController;
  let service: jest.Mocked<Partial<CaseLawService>>;

  const mockCaseLaw: CaseLaw = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Google Spain SL v AEPD',
    decisionType: 'Judgment',
    dateOfDecision: new Date('2014-05-13'),
    office: 'Grand Chamber',
    court: 'Court of Justice of the European Union',
    caseNumber: 'C-131/12',
    summary: 'The case concerned the right to be forgotten...',
    conclusion: 'The Court ruled that individuals have the right...',
    sourceFileName: 'case-c-131-12.pdf',
    sourceFileType: SourceFileType.PDF,
    rawText: 'Full text of the case...',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    service = {
      extractAndSave: jest.fn().mockResolvedValue(mockCaseLaw),
      findById: jest.fn().mockResolvedValue(mockCaseLaw),
      findAll: jest.fn().mockResolvedValue({
        items: [mockCaseLaw],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }),
      deleteById: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CaseLawController],
      providers: [{ provide: CaseLawService, useValue: service }],
    }).compile();

    controller = module.get<CaseLawController>(CaseLawController);
  });

  describe('extractCaseLaw', () => {
    it('should throw BadRequestException when no file is provided', async () => {
      await expect(controller.extractCaseLaw(undefined as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException with descriptive message', async () => {
      await expect(controller.extractCaseLaw(null as any)).rejects.toThrow(
        'No file uploaded. Please provide a PDF or HTML file.',
      );
    });

    it('should delegate to service and return result for valid file', async () => {
      const mockFile = {
        originalname: 'case.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('fake pdf'),
        size: 1024,
      } as Express.Multer.File;

      const result = await controller.extractCaseLaw(mockFile);

      expect(service.extractAndSave).toHaveBeenCalledWith(mockFile);
      expect(result).toEqual(mockCaseLaw);
    });
  });

  describe('findById', () => {
    it('should delegate to service with the correct ID', async () => {
      const id = '550e8400-e29b-41d4-a716-446655440000';
      const result = await controller.findById(id);

      expect(service.findById).toHaveBeenCalledWith(id);
      expect(result).toEqual(mockCaseLaw);
    });
  });

  describe('findAll', () => {
    it('should delegate to service with filter params', async () => {
      const filter = { court: 'European', page: 1, limit: 5 };
      const result = await controller.findAll(filter as any);

      expect(service.findAll).toHaveBeenCalledWith(filter);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should return paginated response structure', async () => {
      const result = await controller.findAll({} as any);

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('totalPages');
    });
  });

  describe('deleteById', () => {
    it('should delegate to service with the correct ID', async () => {
      const id = '550e8400-e29b-41d4-a716-446655440000';
      await controller.deleteById(id);

      expect(service.deleteById).toHaveBeenCalledWith(id);
    });

    it('should propagate NotFoundException from service', async () => {
      (service.deleteById as jest.Mock).mockRejectedValue(
        new NotFoundException('Not found'),
      );

      await expect(controller.deleteById('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
