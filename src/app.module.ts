import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { CaseLawModule } from './case-law/case-law.module';
import { HealthModule } from './health/health.module';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),

    // Rate limiting — global default: 10 requests per 60s
    ThrottlerModule.forRoot([{
      ttl: 60_000,
      limit: 10,
    }]),

    // Serve static frontend
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      exclude: ['/api/*path', '/graphql', '/health'],
    }),

    // GraphQL (Apollo) — code-first
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      context: ({ req }) => ({ req }),
    }),

    // Database
    DatabaseModule,

    // Feature modules
    CaseLawModule,

    // Health checks
    HealthModule,
  ],
  providers: [
    // Enable ThrottlerGuard globally
    { provide: APP_GUARD, useClass: GqlThrottlerGuard },
  ],
})
export class AppModule { }
