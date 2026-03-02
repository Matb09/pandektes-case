import { ObjectType, Field, Int } from '@nestjs/graphql';
import { CaseLaw } from '../entities/case-law.entity';

@ObjectType({ description: 'Paginated case law results' })
export class PaginatedCaseLawResponse {
    @Field(() => [CaseLaw])
    items: CaseLaw[];

    @Field(() => Int)
    total: number;

    @Field(() => Int)
    page: number;

    @Field(() => Int)
    limit: number;

    @Field(() => Int)
    totalPages: number;
}
