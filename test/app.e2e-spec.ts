import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import nock from 'nock';
import { AppModule } from './../src/app.module';

describe('Case Law API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    nock.cleanAll();
    nock.restore();
    await app.close();
  });

  describe('/api/case-laws (GET)', () => {
    it('should return paginated results', () => {
      return request(app.getHttpServer())
        .get('/api/case-laws')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('items');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
          expect(res.body).toHaveProperty('limit');
          expect(res.body).toHaveProperty('totalPages');
          expect(Array.isArray(res.body.items)).toBe(true);
        });
    });

    it('should support pagination parameters', () => {
      return request(app.getHttpServer())
        .get('/api/case-laws?page=1&limit=5')
        .expect(200)
        .expect((res) => {
          expect(res.body.page).toBe(1);
          expect(res.body.limit).toBe(5);
        });
    });
  });

  describe('/api/case-laws/:id (GET)', () => {
    it('should return 404 for non-existent ID', () => {
      return request(app.getHttpServer())
        .get('/api/case-laws/550e8400-e29b-41d4-a716-446655440000')
        .expect(404);
    });

    it('should return 400 for invalid UUID format', () => {
      return request(app.getHttpServer())
        .get('/api/case-laws/not-a-uuid')
        .expect(400);
    });
  });

  describe('/api/case-laws/extract (POST)', () => {
    it('should return 400 when no file is provided', () => {
      return request(app.getHttpServer())
        .post('/api/case-laws/extract')
        .expect(400);
    });

    it('should extract metadata from an HTML file and persist it', async () => {
      const htmlContent = `
        <html>
          <head><title>Smith v. Jones — Supreme Court</title></head>
          <body>
            <h1>Smith v. Jones</h1>
            <p><strong>Case Number:</strong> 22-1234</p>
            <p><strong>Court:</strong> Supreme Court of the United States</p>
            <p><strong>Date of Decision:</strong> June 15, 2023</p>
            <p><strong>Decision Type:</strong> Opinion</p>
            <p><strong>Office:</strong> Office of the Chief Justice</p>
            <section>
              <h2>Summary</h2>
              <p>This case involved a dispute between Smith and Jones regarding
              the interpretation of the Fourth Amendment's protections against
              unreasonable searches and seizures in the digital age. The petitioner,
              Smith, argued that law enforcement's warrantless access to cell-site
              location information constituted an unreasonable search.</p>
            </section>
            <section>
              <h2>Conclusion</h2>
              <p>The Court reversed the lower court's decision and held that
              accessing historical cell-site location information constitutes a
              search under the Fourth Amendment, requiring a warrant supported by
              probable cause.</p>
            </section>
          </body>
        </html>
      `;

      // Intercept the OpenAI API call
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(200, {
          id: 'chatcmpl-123',
          object: 'chat.completion',
          created: 1677652288,
          model: 'gpt-4o-2024-08-06',
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: JSON.stringify({
                title: 'Smith v. Jones',
                decisionType: 'Opinion',
                dateOfDecision: '2023-06-15',
                office: 'Office of the Chief Justice',
                court: 'Supreme Court of the United States',
                caseNumber: '22-1234',
                summary: 'This case involved a dispute between Smith and Jones regarding the interpretation of the Fourth Amendment...',
                conclusion: 'The Court reversed the lower court\'s decision and held that accessing historical cell-site location information constitutes a search under the Fourth Amendment.'
              }),
            },
            finish_reason: 'stop'
          }],
          usage: { prompt_tokens: 9, completion_tokens: 12, total_tokens: 21 }
        });

      // Step 1: Upload HTML and extract metadata
      const extractRes = await request(app.getHttpServer())
        .post('/api/case-laws/extract')
        .attach('file', Buffer.from(htmlContent, 'utf-8'), {
          filename: 'smith-v-jones.html',
          contentType: 'text/html',
        })
        .expect(201);

      // Verify extracted fields are present and non-empty
      expect(extractRes.body).toHaveProperty('id');
      expect(extractRes.body.title).toBeTruthy();
      expect(extractRes.body.court).toBeTruthy();
      expect(extractRes.body.caseNumber).toBeTruthy();
      expect(extractRes.body.summary).toBeTruthy();
      expect(extractRes.body.conclusion).toBeTruthy();
      expect(extractRes.body.decisionType).toBeTruthy();
      expect(extractRes.body.dateOfDecision).toBeTruthy();
      expect(extractRes.body.sourceFileName).toBe('smith-v-jones.html');
      expect(extractRes.body.sourceFileType).toBe('HTML');

      const createdId = extractRes.body.id;

      // Step 2: Fetch by ID and verify persistence
      const fetchRes = await request(app.getHttpServer())
        .get(`/api/case-laws/${createdId}`)
        .expect(200);

      expect(fetchRes.body.id).toBe(createdId);
      expect(fetchRes.body.title).toBe(extractRes.body.title);
      expect(fetchRes.body.court).toBe(extractRes.body.court);
      expect(fetchRes.body.caseNumber).toBe(extractRes.body.caseNumber);
      // rawText should NOT be in the response (excluded via @Exclude)
      expect(fetchRes.body).not.toHaveProperty('rawText');

      // Step 3: Verify it appears in the list
      const listRes = await request(app.getHttpServer())
        .get('/api/case-laws')
        .expect(200);

      expect(listRes.body.total).toBeGreaterThanOrEqual(1);
      const found = listRes.body.items.find((item: any) => item.id === createdId);
      expect(found).toBeDefined();

      // Step 4: Delete and verify it's gone
      await request(app.getHttpServer())
        .delete(`/api/case-laws/${createdId}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/case-laws/${createdId}`)
        .expect(404);
    });
  });

  describe('/api/case-laws/:id (DELETE)', () => {
    it('should return 404 when deleting non-existent ID', () => {
      return request(app.getHttpServer())
        .delete('/api/case-laws/550e8400-e29b-41d4-a716-446655440000')
        .expect(404);
    });

    it('should return 400 for invalid UUID format', () => {
      return request(app.getHttpServer())
        .delete('/api/case-laws/not-a-uuid')
        .expect(400);
    });
  });

  describe('/health (GET)', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
        });
    });
  });
});
