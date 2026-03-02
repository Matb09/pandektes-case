import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { Exclude } from 'class-transformer';

export enum SourceFileType {
  PDF = 'PDF',
  HTML = 'HTML',
}

registerEnumType(SourceFileType, {
  name: 'SourceFileType',
  description: 'The type of the source file used for extraction',
});

@ObjectType({ description: 'Case law document with extracted metadata' })
@Entity('case_laws')
export class CaseLaw {
  @Field(() => ID)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field({ description: 'Title of the case law' })
  @Index()
  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Field({ description: 'Type of decision (e.g., Judgment, Order, Opinion)' })
  @Index()
  @Column({ type: 'varchar', length: 200 })
  decisionType: string;

  @Field(() => String, { description: 'Date of the decision' })
  @Index()
  @Column({ type: 'date' })
  dateOfDecision: Date;

  @Field(() => String, {
    nullable: true,
    description: 'Office that issued the decision',
  })
  @Column({ type: 'varchar', length: 300, nullable: true })
  office: string | null;

  @Field({ description: 'Court that made the decision' })
  @Index()
  @Column({ type: 'varchar', length: 300 })
  court: string;

  @Field({ description: 'Case number identifier' })
  @Index()
  @Column({ type: 'varchar', length: 200 })
  caseNumber: string;

  @Field({ description: 'AI-generated summary of the case' })
  @Column({ type: 'text' })
  summary: string;

  @Field({ description: 'AI-generated conclusion of the case' })
  @Column({ type: 'text' })
  conclusion: string;

  @Field({ description: 'Original filename of the uploaded document' })
  @Column({ type: 'varchar', length: 500 })
  sourceFileName: string;

  @Field(() => SourceFileType, { description: 'Type of the source file' })
  @Column({ type: 'enum', enum: SourceFileType })
  sourceFileType: SourceFileType;

  // Excluded from GraphQL (@Field omitted) and REST (@Exclude) responses.
  // Stored for re-processing with improved prompts without re-uploading.
  @Exclude({ toPlainOnly: true })
  @Column({ type: 'text' })
  rawText: string;

  @Field({ description: 'Timestamp when the record was created' })
  @Index()
  @CreateDateColumn()
  createdAt: Date;

  @Field({ description: 'Timestamp when the record was last updated' })
  @UpdateDateColumn()
  updatedAt: Date;
}
