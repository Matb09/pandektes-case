import {
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaseLaw, SourceFileType } from './entities/case-law.entity';
import { FileParserService } from '../file-parser/file-parser.service';
import { LlmService } from '../llm/llm.service';
import { CaseLawFilterDto } from './dto/case-law-filter.dto';
import { PaginatedCaseLawResponse } from './dto/paginated-case-law.dto';

@Injectable()
export class CaseLawService {
    private readonly logger = new Logger(CaseLawService.name);

    constructor(
        @InjectRepository(CaseLaw)
        private readonly caseLawRepository: Repository<CaseLaw>,
        private readonly fileParserService: FileParserService,
        private readonly llmService: LlmService,
    ) { }

    /**
     * Orchestrates the full extraction pipeline:
     * 1. Parse the uploaded file to extract plain text
     * 2. Send text to LLM for structured metadata extraction
     * 3. Persist the extracted data to the database
     */
    async extractAndSave(file: Express.Multer.File): Promise<CaseLaw> {
        this.logger.log(
            `Starting extraction for file: ${file.originalname} (${file.mimetype}, ${file.size} bytes)`,
        );

        // Step 1: Parse file to text
        const { text, fileType } = await this.fileParserService.parseFile(
            file.buffer,
            file.mimetype,
            file.originalname,
        );
        this.logger.log(
            `File parsed successfully. Extracted ${text.length} characters.`,
        );

        // Step 2: Extract metadata via LLM
        const metadata = await this.llmService.extractCaseLawMetadata(text);
        this.logger.log(
            `LLM extraction complete: "${metadata.title}" (${metadata.caseNumber})`,
        );

        // Step 3: Persist to database
        const caseLaw = this.caseLawRepository.create({
            title: metadata.title,
            decisionType: metadata.decisionType,
            dateOfDecision: new Date(metadata.dateOfDecision),
            office: metadata.office ?? null,
            court: metadata.court,
            caseNumber: metadata.caseNumber,
            summary: metadata.summary,
            conclusion: metadata.conclusion,
            sourceFileName: file.originalname,
            sourceFileType: fileType as SourceFileType,
            rawText: text,
        });

        const saved = await this.caseLawRepository.save(caseLaw);
        this.logger.log(`Case law persisted with ID: ${saved.id}`);

        return saved as CaseLaw;
    }

    /**
     * Retrieves a single case law by its UUID.
     * Throws NotFoundException if not found.
     */
    async findById(id: string): Promise<CaseLaw> {
        const caseLaw = await this.caseLawRepository.findOne({ where: { id } });

        if (!caseLaw) {
            throw new NotFoundException(`Case law with ID "${id}" not found`);
        }

        return caseLaw;
    }

    /**
     * Escapes SQL LIKE wildcards (% and _) to prevent wildcard injection.
     */
    private escapeLike(str: string): string {
        return str.replace(/([%_\\])/g, '\\$1');
    }

    /**
     * Retrieves case laws with filtering, sorting, and pagination.
     * Supports partial matching on court, caseNumber, and full-text search
     * across title, summary, and conclusion.
     */
    async findAll(filter: CaseLawFilterDto): Promise<PaginatedCaseLawResponse> {
        const {
            court,
            decisionType,
            caseNumber,
            dateFrom,
            dateTo,
            searchTerm,
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'DESC',
        } = filter;

        const qb = this.caseLawRepository.createQueryBuilder('cl');

        // Dynamic filter building with wildcard escaping
        if (court) {
            qb.andWhere('cl.court ILIKE :court', { court: `%${this.escapeLike(court)}%` });
        }

        if (decisionType) {
            qb.andWhere('cl.decisionType ILIKE :decisionType', {
                decisionType: `%${this.escapeLike(decisionType)}%`,
            });
        }

        if (caseNumber) {
            qb.andWhere('cl.caseNumber ILIKE :caseNumber', {
                caseNumber: `%${this.escapeLike(caseNumber)}%`,
            });
        }

        if (dateFrom) {
            qb.andWhere('cl.dateOfDecision >= :dateFrom', { dateFrom });
        }

        if (dateTo) {
            qb.andWhere('cl.dateOfDecision <= :dateTo', { dateTo });
        }

        if (searchTerm) {
            qb.andWhere(
                '(cl.title ILIKE :search OR cl.summary ILIKE :search OR cl.conclusion ILIKE :search)',
                { search: `%${this.escapeLike(searchTerm)}%` },
            );
        }

        // Sorting
        const allowedSortFields = [
            'createdAt',
            'dateOfDecision',
            'title',
            'court',
            'caseNumber',
        ];
        const safeSort = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const safeSortOrder = sortOrder === 'ASC' ? 'ASC' : 'DESC';
        qb.orderBy(`cl.${safeSort}`, safeSortOrder);

        // Pagination
        const skip = (page - 1) * limit;
        qb.skip(skip).take(limit);

        const [items, total] = await qb.getManyAndCount();

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Deletes a case law by its UUID.
     * Throws NotFoundException if not found.
     */
    async deleteById(id: string): Promise<void> {
        const caseLaw = await this.findById(id);
        await this.caseLawRepository.remove(caseLaw);
        this.logger.log(`Case law deleted: ${id}`);
    }
}
