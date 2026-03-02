import { Test, TestingModule } from '@nestjs/testing';
import { CaseLawResolver } from './case-law.resolver';
import { CaseLawService } from './case-law.service';
import { CaseLaw, SourceFileType } from './entities/case-law.entity';
import { CaseLawFilterDto } from './dto/case-law-filter.dto';
import { NotFoundException } from '@nestjs/common';

describe('CaseLawResolver', () => {
    let resolver: CaseLawResolver;
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
            providers: [
                CaseLawResolver,
                { provide: CaseLawService, useValue: service },
            ],
        }).compile();

        resolver = module.get<CaseLawResolver>(CaseLawResolver);
    });

    describe('getCaseLaw', () => {
        it('should return a case law by ID', async () => {
            const result = await resolver.getCaseLaw(mockCaseLaw.id);

            expect(service.findById).toHaveBeenCalledWith(mockCaseLaw.id);
            expect(result).toEqual(mockCaseLaw);
        });

        it('should propagate NotFoundException from service', async () => {
            (service.findById as jest.Mock).mockRejectedValue(
                new NotFoundException('Not found'),
            );

            await expect(resolver.getCaseLaw('bad-id')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('getCaseLaws', () => {
        it('should return paginated results with filter', async () => {
            const filter: CaseLawFilterDto = { court: 'European', page: 1, limit: 5 };
            const result = await resolver.getCaseLaws(filter);

            expect(service.findAll).toHaveBeenCalledWith(filter);
            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });

        it('should use default CaseLawFilterDto when no filter provided', async () => {
            await resolver.getCaseLaws(undefined);

            expect(service.findAll).toHaveBeenCalledWith(expect.any(CaseLawFilterDto));
        });

        it('should return correct pagination metadata', async () => {
            const result = await resolver.getCaseLaws({ page: 1, limit: 10 });

            expect(result).toHaveProperty('items');
            expect(result).toHaveProperty('total');
            expect(result).toHaveProperty('page');
            expect(result).toHaveProperty('limit');
            expect(result).toHaveProperty('totalPages');
        });
    });

    describe('deleteCaseLaw', () => {
        it('should delete and return true on success', async () => {
            const result = await resolver.deleteCaseLaw(mockCaseLaw.id);

            expect(service.deleteById).toHaveBeenCalledWith(mockCaseLaw.id);
            expect(result).toBe(true);
        });

        it('should propagate NotFoundException from service', async () => {
            (service.deleteById as jest.Mock).mockRejectedValue(
                new NotFoundException('Not found'),
            );

            await expect(resolver.deleteCaseLaw('bad-id')).rejects.toThrow(
                NotFoundException,
            );
        });
    });
});
