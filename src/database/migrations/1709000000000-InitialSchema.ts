import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitialSchema1709000000000 implements MigrationInterface {
  name = 'InitialSchema1709000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid-ossp extension BEFORE creating table that uses uuid_generate_v4()
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create the source_file_type enum
    await queryRunner.query(
      `CREATE TYPE "source_file_type_enum" AS ENUM('PDF', 'HTML')`,
    );

    // Create the case_laws table
    await queryRunner.createTable(
      new Table({
        name: 'case_laws',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'decisionType',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'dateOfDecision',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'office',
            type: 'varchar',
            length: '300',
            isNullable: true,
          },
          {
            name: 'court',
            type: 'varchar',
            length: '300',
            isNullable: false,
          },
          {
            name: 'caseNumber',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'summary',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'conclusion',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'sourceFileName',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'sourceFileType',
            type: 'source_file_type_enum',
            isNullable: false,
          },
          {
            name: 'rawText',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Create index on caseNumber for faster lookups
    await queryRunner.createIndex(
      'case_laws',
      new TableIndex({
        name: 'IDX_case_laws_caseNumber',
        columnNames: ['caseNumber'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('case_laws', 'IDX_case_laws_caseNumber');
    await queryRunner.dropTable('case_laws');
    await queryRunner.query(`DROP TYPE "source_file_type_enum"`);
  }
}
