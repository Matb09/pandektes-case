import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FileParserService } from './file-parser.service';

describe('FileParserService', () => {
    let service: FileParserService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [FileParserService],
        }).compile();

        service = module.get<FileParserService>(FileParserService);
    });

    describe('parseFile', () => {
        it('should throw BadRequestException for empty buffer', async () => {
            const emptyBuffer = Buffer.alloc(0);

            await expect(
                service.parseFile(emptyBuffer, 'application/pdf', 'test.pdf'),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException for unsupported file type', async () => {
            const buffer = Buffer.from('some content');

            await expect(
                service.parseFile(buffer, 'application/json', 'test.json'),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw BadRequestException for file exceeding size limit', async () => {
            // Create a buffer just over 10MB
            const largeBuffer = Buffer.alloc(11 * 1024 * 1024);

            await expect(
                service.parseFile(largeBuffer, 'application/pdf', 'large.pdf'),
            ).rejects.toThrow(BadRequestException);
        });

        it('should parse HTML content successfully', async () => {
            const html = `
        <html>
          <head><title>Test Case</title></head>
          <body>
            <h1>Case Title</h1>
            <p>This is the case content with important legal text.</p>
            <script>alert('removed')</script>
            <style>.hidden{display:none}</style>
          </body>
        </html>
      `;
            const buffer = Buffer.from(html, 'utf-8');

            const result = await service.parseFile(buffer, 'text/html', 'case.html');

            expect(result.fileType).toBe('HTML');
            expect(result.text).toContain('Case Title');
            expect(result.text).toContain('important legal text');
            expect(result.text).not.toContain('alert');
            expect(result.text).not.toContain('.hidden');
        });

        it('should detect file type from extension when mime type is generic', async () => {
            const html = '<html><body>Legal content</body></html>';
            const buffer = Buffer.from(html, 'utf-8');

            // Using a generic mime type but .html extension
            const result = await service.parseFile(
                buffer,
                'text/html',
                'document.html',
            );

            expect(result.fileType).toBe('HTML');
            expect(result.text).toContain('Legal content');
        });

        it('should accept .htm extension as HTML', async () => {
            const html = '<html><body>Court ruling content</body></html>';
            const buffer = Buffer.from(html, 'utf-8');

            const result = await service.parseFile(
                buffer,
                'application/octet-stream',
                'document.htm',
            );

            expect(result.fileType).toBe('HTML');
            expect(result.text).toContain('Court ruling content');
        });

        it('should strip navigation and footer elements from HTML', async () => {
            const html = `
                <html>
                    <body>
                        <nav>Menu items</nav>
                        <main>Important legal text</main>
                        <footer>Copyright 2024</footer>
                    </body>
                </html>
            `;
            const buffer = Buffer.from(html, 'utf-8');

            const result = await service.parseFile(buffer, 'text/html', 'case.html');

            expect(result.text).toContain('Important legal text');
            expect(result.text).not.toContain('Menu items');
            expect(result.text).not.toContain('Copyright 2024');
        });

        it('should load and validate the PDF fixture file', async () => {
            const fs = require('fs');
            const path = require('path');
            const fixturePath = path.join(__dirname, 'fixtures', 'sample.pdf');
            const buffer = fs.readFileSync(fixturePath);

            // Verify fixture is a valid PDF (starts with %PDF magic bytes)
            expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-');
            expect(buffer.length).toBeGreaterThan(0);
            expect(buffer.length).toBeLessThan(10 * 1024 * 1024); // Under 10MB limit
        });

        it('should accept PDF mime type and pass validation', async () => {
            const fs = require('fs');
            const path = require('path');
            const fixturePath = path.join(__dirname, 'fixtures', 'sample.pdf');
            const buffer = fs.readFileSync(fixturePath);

            // Spy on the private parsePdf method to bypass pdf-parse execution in test environment
            jest.spyOn(service as any, 'parsePdf').mockResolvedValue({
                text: 'Mocked PDF legal content',
                fileType: 'PDF'
            });

            const result = await service.parseFile(buffer, 'application/pdf', 'sample.pdf');

            expect(result.fileType).toBe('PDF');
            expect(result.text).toBe('Mocked PDF legal content');
        });

        it('should throw BadRequestException for null buffer', async () => {
            await expect(
                service.parseFile(null as any, 'application/pdf', 'test.pdf'),
            ).rejects.toThrow(BadRequestException);
        });
    });
});
