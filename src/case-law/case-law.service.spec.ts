import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { CaseLawService } from './case-law.service';
import { CaseLaw, SourceFileType } from './entities/case-law.entity';
import { FileParserService } from '../file-parser/file-parser.service';
import { LlmService, ExtractedCaseLawData } from '../llm/llm.service';

describe('CaseLawService', () => {
    let service: CaseLawService;
    let repository: jest.Mocked<Partial<Repository<CaseLaw>>>;
    let fileParserService: jest.Mocked<Partial<FileParserService>>;
    let llmService: jest.Mocked<Partial<LlmService>>;

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

    const mockExtractedData: ExtractedCaseLawData = {
        title: 'Google Spain SL v AEPD',
        decisionType: 'Judgment',
        dateOfDecision: '2014-05-13',
        office: 'Grand Chamber',
        court: 'Court of Justice of the European Union',
        caseNumber: 'C-131/12',
        summary: 'The case concerned the right to be forgotten...',
        conclusion: 'The Court ruled that individuals have the right...',
    };

    beforeEach(async () => {
        repository = {
            create: jest.fn().mockReturnValue(mockCaseLaw),
            save: jest.fn().mockResolvedValue(mockCaseLaw),
            findOne: jest.fn().mockResolvedValue(mockCaseLaw),
            remove: jest.fn().mockResolvedValue(mockCaseLaw),
            createQueryBuilder: jest.fn().mockReturnValue({
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                take: jest.fn().mockReturnThis(),
                getManyAndCount: jest.fn().mockResolvedValue([[mockCaseLaw], 1]),
            }),
        };

        fileParserService = {
            parseFile: jest.fn().mockResolvedValue({
                text: 'Extracted text content',
                fileType: 'PDF',
            }),
        };

        llmService = {
            extractCaseLawMetadata: jest.fn().mockResolvedValue(mockExtractedData),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CaseLawService,
                { provide: getRepositoryToken(CaseLaw), useValue: repository },
                { provide: FileParserService, useValue: fileParserService },
                { provide: LlmService, useValue: llmService },
            ],
        }).compile();

        service = module.get<CaseLawService>(CaseLawService);
    });

    describe('extractAndSave', () => {
        const mockFile = {
            originalname: 'case-c-131-12.pdf',
            mimetype: 'application/pdf',
            buffer: Buffer.from('fake pdf content'),
            size: 1024,
        } as Express.Multer.File;

        it('should parse file, extract metadata via LLM, and save to database', async () => {
            const result = await service.extractAndSave(mockFile);

            expect(fileParserService.parseFile).toHaveBeenCalledWith(
                mockFile.buffer,
                mockFile.mimetype,
                mockFile.originalname,
            );
            expect(llmService.extractCaseLawMetadata).toHaveBeenCalledWith(
                'Extracted text content',
            );
            expect(repository.create).toHaveBeenCalledWith({
                title: mockExtractedData.title,
                decisionType: mockExtractedData.decisionType,
                dateOfDecision: new Date(mockExtractedData.dateOfDecision),
                office: mockExtractedData.office,
                court: mockExtractedData.court,
                caseNumber: mockExtractedData.caseNumber,
                summary: mockExtractedData.summary,
                conclusion: mockExtractedData.conclusion,
                sourceFileName: mockFile.originalname,
                sourceFileType: 'PDF',
                rawText: 'Extracted text content',
            });
            expect(repository.save).toHaveBeenCalledWith(mockCaseLaw);
            expect(result).toEqual(mockCaseLaw);
        });

        it('should handle HTML files correctly', async () => {
            const htmlFile = {
                originalname: 'case.html',
                mimetype: 'text/html',
                buffer: Buffer.from('<html>content</html>'),
                size: 512,
            } as Express.Multer.File;

            (fileParserService.parseFile as jest.Mock).mockResolvedValue({
                text: 'HTML text content',
                fileType: 'HTML',
            });

            await service.extractAndSave(htmlFile);

            expect(repository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    sourceFileName: 'case.html',
                    sourceFileType: 'HTML',
                    rawText: 'HTML text content',
                }),
            );
        });

        it('should propagate file parser errors', async () => {
            (fileParserService.parseFile as jest.Mock).mockRejectedValue(
                new Error('Invalid PDF'),
            );

            await expect(service.extractAndSave(mockFile)).rejects.toThrow(
                'Invalid PDF',
            );
        });

        it('should propagate LLM extraction errors', async () => {
            (llmService.extractCaseLawMetadata as jest.Mock).mockRejectedValue(
                new Error('LLM failed'),
            );

            await expect(service.extractAndSave(mockFile)).rejects.toThrow(
                'LLM failed',
            );
        });
    });

    describe('findById', () => {
        it('should return a case law when found', async () => {
            const result = await service.findById(mockCaseLaw.id);
            expect(result).toEqual(mockCaseLaw);
            expect(repository.findOne).toHaveBeenCalledWith({
                where: { id: mockCaseLaw.id },
            });
        });

        it('should throw NotFoundException when case law not found', async () => {
            (repository.findOne as jest.Mock).mockResolvedValue(null);

            await expect(service.findById('non-existent-id')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('deleteById', () => {
        it('should delete a case law when found', async () => {
            await service.deleteById(mockCaseLaw.id);

            expect(repository.findOne).toHaveBeenCalledWith({
                where: { id: mockCaseLaw.id },
            });
            expect(repository.remove).toHaveBeenCalledWith(mockCaseLaw);
        });

        it('should throw NotFoundException when case law does not exist', async () => {
            (repository.findOne as jest.Mock).mockResolvedValue(null);

            await expect(service.deleteById('non-existent-id')).rejects.toThrow(
                NotFoundException,
            );
            expect(repository.remove).not.toHaveBeenCalled();
        });
    });

    describe('findAll', () => {
        it('should return paginated results', async () => {
            const result = await service.findAll({ page: 1, limit: 10 });

            expect(result).toEqual({
                items: [mockCaseLaw],
                total: 1,
                page: 1,
                limit: 10,
                totalPages: 1,
            });
        });

        it('should apply court filter with correct ILIKE parameter', async () => {
            const qb = repository.createQueryBuilder!('cl');
            await service.findAll({ court: 'European', page: 1, limit: 10 });

            expect(repository.createQueryBuilder).toHaveBeenCalledWith('cl');
            expect(qb.andWhere).toHaveBeenCalledWith(
                'cl.court ILIKE :court',
                { court: '%European%' },
            );
        });

        it('should apply date range filters with correct parameters', async () => {
            const qb = repository.createQueryBuilder!('cl');
            await service.findAll({
                dateFrom: '2020-01-01',
                dateTo: '2024-12-31',
                page: 1,
                limit: 10,
            });

            expect(qb.andWhere).toHaveBeenCalledWith(
                'cl.dateOfDecision >= :dateFrom',
                { dateFrom: '2020-01-01' },
            );
            expect(qb.andWhere).toHaveBeenCalledWith(
                'cl.dateOfDecision <= :dateTo',
                { dateTo: '2024-12-31' },
            );
        });

        it('should apply search term across title, summary, and conclusion', async () => {
            const qb = repository.createQueryBuilder!('cl');
            await service.findAll({
                searchTerm: 'right to be forgotten',
                page: 1,
                limit: 10,
            });

            expect(qb.andWhere).toHaveBeenCalledWith(
                '(cl.title ILIKE :search OR cl.summary ILIKE :search OR cl.conclusion ILIKE :search)',
                { search: '%right to be forgotten%' },
            );
        });

        it('should use default pagination values', async () => {
            const result = await service.findAll({});

            expect(result.page).toBe(1);
            expect(result.limit).toBe(10);
        });

        it('should sanitize sort field to prevent injection', async () => {
            const qb = repository.createQueryBuilder!('cl');
            await service.findAll({
                sortBy: 'malicious; DROP TABLE' as any,
                page: 1,
                limit: 10,
            });

            // Should fallback to 'createdAt' since the value is not in the allowlist
            expect(qb.orderBy).toHaveBeenCalledWith('cl.createdAt', 'DESC');
        });
    });
});
