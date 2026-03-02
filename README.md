# Pandektes — AI-Powered Case Law Metadata Extraction

A production-grade **NestJS** application that extracts structured metadata from case law documents (PDF/HTML) using **OpenAI GPT-5.2**, persists them to **PostgreSQL**, and exposes both **REST** and **GraphQL** APIs with filtering, sorting, and pagination.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     Client Request                        │
│              (REST / GraphQL / Swagger UI)                │
└─────────────────────┬────────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────────┐
│                   NestJS Application                      │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Controller  │  │   Resolver   │  │  Health Check  │  │
│  │  (REST API)  │  │  (GraphQL)   │  │   /health      │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────────┘  │
│         │                 │                               │
│  ┌──────▼─────────────────▼──────┐                       │
│  │       CaseLawService          │                       │
│  │  (Orchestration & Business)   │                       │
│  └──┬───────────────────────┬────┘                       │
│     │                       │                             │
│  ┌──▼──────────────┐  ┌────▼──────────────┐             │
│  │ FileParserService│  │   LlmService      │             │
│  │ (PDF / HTML)     │  │   (OpenAI GPT)    │             │
│  └─────────────────┘  └──────────────────┘              │
│                                                           │
└───────────────────────────┬───────────────────────────────┘
                            │
                ┌───────────▼──────────┐
                │   PostgreSQL (Docker) │
                └──────────────────────┘
```

## Tech Stack

| Category | Technology | Rationale |
|---|---|---|
| Framework | NestJS 11 | Enterprise-grade DI, modularity, TypeScript-first |
| LLM | OpenAI GPT-5.2 | Best cost/quality for structured extraction; JSON mode |
| Database | PostgreSQL 16 | Industry standard, ILIKE queries, robust indexing |
| ORM | TypeORM | First-class NestJS integration, migrations, decorators |
| GraphQL | Apollo (code-first) | Auto-generates schema from TypeScript types |
| PDF Parsing | pdf-parse | Lightweight, no native dependencies |
| HTML Parsing | cheerio | Fast jQuery-like DOM traversal |
| API Docs | Swagger (OpenAPI) | Interactive endpoint testing |
| Security | Helmet + Throttler | HTTP headers hardening, rate limiting |
| Containerization | Docker Compose | One-command infrastructure setup |

## Prerequisites

- **Node.js** ≥ 20
- **Docker** & **Docker Compose**
- **OpenAI API Key** ([get one here](https://platform.openai.com/api-keys))

## Quick Start

### 1. Clone & Install

```bash
git clone <repository-url>
cd pandektes
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your OpenAI API key:

```
OPENAI_API_KEY=sk-your-actual-key-here
```

### 3. Start Database

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** on port `5432`
- **pgAdmin** on port `5050` (login: `admin@pandektes.dev` / `admin`)

### 4. Run the Application

```bash
# Development (with hot reload)
npm run start:dev

# Production
npm run build
npm run start:prod
```

### 5. Access the APIs

| Interface | URL |
|---|---|
| **Swagger UI** | http://localhost:3000/api |
| **GraphQL Playground** | http://localhost:3000/graphql |
| **Health Check** | http://localhost:3000/health |

## API Reference

### REST Endpoints

#### `POST /api/case-laws/extract`

Upload a PDF or HTML document to extract case law metadata.

```bash
curl -X POST http://localhost:3000/api/case-laws/extract \
  -F "file=@/path/to/case-law.pdf"
```

**Response** (201):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Google Spain SL v AEPD",
  "decisionType": "Judgment",
  "dateOfDecision": "2014-05-13",
  "office": "Grand Chamber",
  "court": "Court of Justice of the European Union",
  "caseNumber": "C-131/12",
  "summary": "...",
  "conclusion": "...",
  "sourceFileName": "case-c-131-12.pdf",
  "sourceFileType": "PDF",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

#### `GET /api/case-laws`

List case laws with filters. All query params are optional.

```bash
# Filter by court, paginate, sort
curl "http://localhost:3000/api/case-laws?court=European&page=1&limit=5&sortBy=dateOfDecision&sortOrder=DESC"

# Full-text search
curl "http://localhost:3000/api/case-laws?searchTerm=right+to+be+forgotten"

# Date range
curl "http://localhost:3000/api/case-laws?dateFrom=2020-01-01&dateTo=2024-12-31"
```

| Parameter | Type | Description |
|---|---|---|
| `court` | string | Partial match on court name |
| `decisionType` | string | Exact decision type |
| `caseNumber` | string | Partial match on case number |
| `dateFrom` | date | From date (YYYY-MM-DD) |
| `dateTo` | date | To date (YYYY-MM-DD) |
| `searchTerm` | string | Search across title, summary, conclusion |
| `page` | int | Page number (default: 1) |
| `limit` | int | Items per page (default: 10, max: 100) |
| `sortBy` | enum | `createdAt`, `dateOfDecision`, `title`, `court`, `caseNumber` |
| `sortOrder` | enum | `ASC` or `DESC` |

#### `GET /api/case-laws/:id`

Get a specific case law by UUID.

```bash
curl http://localhost:3000/api/case-laws/550e8400-e29b-41d4-a716-446655440000
```

#### `DELETE /api/case-laws/:id`

Delete a case law by UUID. Returns `204 No Content` on success.

```bash
curl -X DELETE http://localhost:3000/api/case-laws/550e8400-e29b-41d4-a716-446655440000
```

### GraphQL

Access the playground at http://localhost:3000/graphql

```graphql
# Get a single case law
query {
  caseLaw(id: "550e8400-e29b-41d4-a716-446655440000") {
    title
    court
    caseNumber
    summary
    conclusion
  }
}

# List with filters and pagination
query {
  caseLaws(filter: {
    court: "European"
    sortBy: "dateOfDecision"
    sortOrder: "DESC"
    page: 1
    limit: 5
  }) {
    items {
      id
      title
      court
      dateOfDecision
      caseNumber
    }
    total
    totalPages
  }
}

# Delete a case law
mutation {
  deleteCaseLaw(id: "550e8400-e29b-41d4-a716-446655440000")
}
```

## Database & Migrations

The application uses TypeORM with PostgreSQL. For data integrity and production readiness, `synchronize: false` is strictly enforced across all environments.

Schema changes must be managed via migrations:

```bash
# Generate a migration from entity changes
npm run migration:generate -- src/database/migrations/InitialSchema

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert
```

### Entity Schema: `case_laws`

| Column | Type | Constraints |
|---|---|---|
| `id` | UUID | PK, auto-generated |
| `title` | VARCHAR(500) | NOT NULL |
| `decisionType` | VARCHAR(200) | NOT NULL |
| `dateOfDecision` | DATE | NOT NULL |
| `office` | VARCHAR(300) | NULLABLE |
| `court` | VARCHAR(300) | NOT NULL |
| `caseNumber` | VARCHAR(200) | NOT NULL, INDEXED |
| `summary` | TEXT | NOT NULL |
| `conclusion` | TEXT | NOT NULL |
| `sourceFileName` | VARCHAR(500) | NOT NULL |
| `sourceFileType` | ENUM (PDF, HTML) | NOT NULL |
| `rawText` | TEXT | NOT NULL |
| `createdAt` | TIMESTAMP | Auto |
| `updatedAt` | TIMESTAMP | Auto |

## Testing

```bash
# Unit tests
npm run test

# Unit tests with watch mode
npm run test:watch

# Test coverage
npm run test:cov

# E2E tests (requires running database)
npm run test:e2e
```

## Project Structure

```
src/
├── main.ts                          # App bootstrap, Swagger, global pipes
├── app.module.ts                    # Root module composition
├── config/
│   └── configuration.ts             # Typed environment config
├── database/
│   ├── database.module.ts           # TypeORM async configuration
│   └── migrations/                  # Generated DB migrations
├── case-law/
│   ├── case-law.module.ts           # Feature module
│   ├── case-law.controller.ts       # REST endpoints (rate-limited)
│   ├── case-law.controller.spec.ts  # Controller unit tests
│   ├── case-law.resolver.ts         # GraphQL resolver
│   ├── case-law.resolver.spec.ts    # Resolver unit tests
│   ├── case-law.service.ts          # Business logic & orchestration
│   ├── case-law.service.spec.ts     # Service unit tests
│   ├── entities/
│   │   └── case-law.entity.ts       # TypeORM + GraphQL entity
│   └── dto/
│       ├── case-law-filter.dto.ts   # Filter/sort/pagination DTO
│       └── paginated-case-law.dto.ts
├── llm/
│   ├── llm.module.ts
│   ├── llm.service.ts              # OpenAI integration & retry logic
│   └── llm.service.spec.ts         # Unit tests
├── file-parser/
│   ├── file-parser.module.ts
│   ├── file-parser.service.ts      # PDF/HTML → text extraction
│   ├── file-parser.service.spec.ts # Unit tests
│   └── fixtures/
│       └── sample.pdf              # Test fixture for PDF parsing
├── health/
│   ├── health.module.ts
│   └── health.controller.ts        # /health endpoint
└── common/
    ├── filters/
    │   └── http-exception.filter.ts # Global error handling
    └── interceptors/
        └── logging.interceptor.ts   # Request logging
```

## Key Decisions & Trade-offs

### LLM Choice: OpenAI GPT-5.2
- **Why**: Best cost-to-quality ratio for structured data extraction. JSON response mode ensures reliable parsing without fragile regex.
- **Trade-off**: Requires an API key and internet access. The extraction cost is ~$0.001 per document.

### Code-First GraphQL
- **Why**: Single source of truth — decorators on TypeScript classes generate both the GraphQL schema and database schema.
- **Trade-off**: Tighter coupling between layers vs. schema-first approach.

### Raw Text Storage
- **Why**: Storing the extracted plain text enables re-processing with improved prompts without re-uploading. Also provides an audit trail.
- **Trade-off**: Increases storage usage. Could be moved to object storage (S3) for production.

### Strict Migrations Enforced
- **Why**: Speeds up reliable deployments and guarantees database schema matches code state exactly across development and production environments.
- **Trade-off**: Requires developers to run migration generation scripts rather than relying on auto-sync iteration.

### File Upload via REST (not GraphQL)
- **Why**: Multipart file uploads in GraphQL require additional packages (graphql-upload) and non-standard handling. REST file upload is universally supported and simpler.
- **Trade-off**: Extraction is REST-only; queries are available on both REST and GraphQL.

## Production Readiness Roadmap

### Security
- [ ] Add JWT/OAuth authentication (`@nestjs/passport`)
- [x] Rate limiting on extraction endpoint (`@nestjs/throttler`) — 3 req/min on extract, 10 req/min global
- [x] Helmet for HTTP security headers
- [x] GraphQL playground/introspection disabled in production
- [ ] Input sanitization for uploaded files (virus scan)
- [ ] API key rotation for OpenAI

### Performance
- [ ] Queue-based extraction using BullMQ (decouple upload from LLM call)
- [ ] File size streaming for large PDFs (avoid memory spikes)
- [ ] Redis caching for frequently accessed case laws
- [ ] Database connection pooling tuning
- [ ] CDN for static assets if serving a frontend

### Reliability
- [x] Comprehensive E2E test suite (HTML upload → extract → fetch → delete)
- [ ] Integration tests with test containers
- [x] CI/CD pipeline (GitHub Actions)
- [ ] Structured logging (Pino/Winston with JSON format)
- [ ] Error tracking (Sentry)
- [ ] Health checks for OpenAI connectivity

### Data
- [ ] Full-text search with PostgreSQL `tsvector` or Elasticsearch
- [ ] Move raw text to object storage (S3)
- [ ] Soft deletes for audit compliance
- [ ] Data export endpoints (CSV/JSON)
- [ ] Duplicate detection based on case number

### DevOps
- [ ] Kubernetes manifests or AWS ECS task definitions
- [ ] Terraform for cloud infrastructure
- [ ] Monitoring dashboards (Grafana + Prometheus)
- [ ] Automated backups for PostgreSQL

## License

UNLICENSED — Private assessment project
