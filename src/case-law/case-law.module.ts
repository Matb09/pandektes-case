import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaseLaw } from './entities/case-law.entity';
import { CaseLawService } from './case-law.service';
import { CaseLawController } from './case-law.controller';
import { CaseLawResolver } from './case-law.resolver';
import { FileParserModule } from '../file-parser/file-parser.module';
import { LlmModule } from '../llm/llm.module';

@Module({
  imports: [TypeOrmModule.forFeature([CaseLaw]), FileParserModule, LlmModule],
  controllers: [CaseLawController],
  providers: [CaseLawService, CaseLawResolver],
  exports: [CaseLawService],
})
export class CaseLawModule {}
