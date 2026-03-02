import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexesToCaseLaw1772487863762 implements MigrationInterface {
  name = 'AddIndexesToCaseLaw1772487863762';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_dff057ca4326cdbb165782824e" ON "case_laws" ("title") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0e23cda7199e16b3b06c44cf49" ON "case_laws" ("decisionType") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_25b3f2d519bbfcce1cb95dbedc" ON "case_laws" ("dateOfDecision") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f131d23e7516b642fca4115a44" ON "case_laws" ("court") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_40a1987114c39cc1a4ae6b56af" ON "case_laws" ("createdAt") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_40a1987114c39cc1a4ae6b56af"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f131d23e7516b642fca4115a44"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_25b3f2d519bbfcce1cb95dbedc"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0e23cda7199e16b3b06c44cf49"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dff057ca4326cdbb165782824e"`,
    );
  }
}
