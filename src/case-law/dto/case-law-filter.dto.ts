import {
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { InputType, Field, Int, registerEnumType } from '@nestjs/graphql';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

registerEnumType(SortOrder, {
  name: 'SortOrder',
  description: 'The order to sort the results',
});

export enum CaseLawSortBy {
  CREATED_AT = 'createdAt',
  DATE_OF_DECISION = 'dateOfDecision',
  TITLE = 'title',
  COURT = 'court',
  CASE_NUMBER = 'caseNumber',
}

registerEnumType(CaseLawSortBy, {
  name: 'CaseLawSortBy',
  description: 'The field to sort the results by',
});

@InputType({ description: 'Filter, sort, and paginate case laws' })
export class CaseLawFilterDto {
  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Filter by court name (partial match)' })
  @IsOptional()
  @IsString()
  court?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Filter by decision type' })
  @IsOptional()
  @IsString()
  decisionType?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({ description: 'Filter by case number (partial match)' })
  @IsOptional()
  @IsString()
  caseNumber?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({
    description: 'Filter decisions from this date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({
    description: 'Filter decisions up to this date (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @Field({ nullable: true })
  @ApiPropertyOptional({
    description: 'Full-text search across title, summary, and conclusion',
  })
  @IsOptional()
  @IsString()
  searchTerm?: string;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Field(() => Int, { nullable: true, defaultValue: 10 })
  @ApiPropertyOptional({
    description: 'Items per page',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @Field(() => CaseLawSortBy, { nullable: true, defaultValue: 'createdAt' })
  @ApiPropertyOptional({
    description: 'Field to sort by',
    default: 'createdAt',
    enum: CaseLawSortBy,
  })
  @IsOptional()
  @IsEnum(CaseLawSortBy)
  sortBy?: CaseLawSortBy = CaseLawSortBy.CREATED_AT;

  @Field(() => SortOrder, { nullable: true, defaultValue: 'DESC' })
  @ApiPropertyOptional({
    description: 'Sort order',
    default: 'DESC',
    enum: SortOrder,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
