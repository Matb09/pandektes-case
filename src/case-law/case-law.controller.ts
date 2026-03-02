import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  BadRequestException,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CaseLawService } from './case-law.service';
import { CaseLaw } from './entities/case-law.entity';
import {
  CaseLawFilterDto,
  CaseLawSortBy,
  SortOrder,
} from './dto/case-law-filter.dto';
import { PaginatedCaseLawResponse } from './dto/paginated-case-law.dto';

@ApiTags('Case Laws')
@Controller('api/case-laws')
@UseInterceptors(ClassSerializerInterceptor)
export class CaseLawController {
  constructor(private readonly caseLawService: CaseLawService) {}

  @Post('extract')
  @Throttle({ default: { ttl: 60_000, limit: 3 } }) // Tighter limit: LLM calls are expensive
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  @ApiOperation({
    summary: 'Extract case law metadata from a document',
    description:
      'Accepts a PDF or HTML file, extracts case law metadata using AI, and persists it to the database.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF or HTML document containing case law',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Case law extracted and persisted successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file type or empty file',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'LLM extraction failed',
  })
  async extractCaseLaw(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<CaseLaw> {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Please provide a PDF or HTML file.',
      );
    }
    return this.caseLawService.extractAndSave(file);
  }

  @Get()
  @ApiOperation({
    summary: 'List case laws with filtering, sorting, and pagination',
    description:
      'Retrieve case laws with optional filters for court, decision type, date range, and full-text search.',
  })
  @ApiQuery({
    name: 'court',
    required: false,
    description: 'Filter by court (partial match)',
  })
  @ApiQuery({
    name: 'decisionType',
    required: false,
    description: 'Filter by decision type',
  })
  @ApiQuery({
    name: 'caseNumber',
    required: false,
    description: 'Filter by case number (partial match)',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description: 'From date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description: 'To date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    description: 'Full-text search',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page',
    example: 10,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: CaseLawSortBy,
    description: 'Sort field',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: SortOrder,
    description: 'Sort direction',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated list of case laws',
  })
  async findAll(
    @Query() filter: CaseLawFilterDto,
  ): Promise<PaginatedCaseLawResponse> {
    return this.caseLawService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a case law by ID',
    description: 'Retrieve a specific case law resource by its UUID.',
  })
  @ApiParam({ name: 'id', description: 'Case law UUID', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Case law found',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Case law not found',
  })
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<CaseLaw> {
    return this.caseLawService.findById(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a case law by ID',
    description: 'Permanently removes a case law resource by its UUID.',
  })
  @ApiParam({ name: 'id', description: 'Case law UUID', format: 'uuid' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Case law deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Case law not found',
  })
  async deleteById(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.caseLawService.deleteById(id);
  }
}
