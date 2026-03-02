import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { CaseLawService } from './case-law.service';
import { CaseLaw } from './entities/case-law.entity';
import { CaseLawFilterDto } from './dto/case-law-filter.dto';
import { PaginatedCaseLawResponse } from './dto/paginated-case-law.dto';

@Resolver(() => CaseLaw)
export class CaseLawResolver {
    constructor(private readonly caseLawService: CaseLawService) { }

    @Query(() => CaseLaw, {
        name: 'caseLaw',
        description: 'Retrieve a specific case law by ID',
    })
    async getCaseLaw(
        @Args('id', { type: () => ID }) id: string,
    ): Promise<CaseLaw> {
        return this.caseLawService.findById(id);
    }

    @Query(() => PaginatedCaseLawResponse, {
        name: 'caseLaws',
        description: 'List case laws with optional filters, sorting, and pagination',
    })
    async getCaseLaws(
        @Args('filter', { type: () => CaseLawFilterDto, nullable: true })
        filter?: CaseLawFilterDto,
    ): Promise<PaginatedCaseLawResponse> {
        return this.caseLawService.findAll(filter || new CaseLawFilterDto());
    }

    @Mutation(() => Boolean, {
        name: 'deleteCaseLaw',
        description: 'Delete a case law by ID',
    })
    async deleteCaseLaw(
        @Args('id', { type: () => ID }) id: string,
    ): Promise<boolean> {
        await this.caseLawService.deleteById(id);
        return true;
    }
}
