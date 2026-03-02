import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * TypeORM data source configuration for CLI-based migrations.
 * Used by: npm run migration:generate, migration:run, migration:revert
 */
export default new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USER || 'pandektes',
    password: process.env.DATABASE_PASSWORD || 'pandektes_secret',
    database: process.env.DATABASE_NAME || 'pandektes',
    entities: [__dirname + '/src/**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/src/database/migrations/*{.ts,.js}'],
    synchronize: false,
    logging: true,
});
