/**
 * Tests for fix command - simplified for Jest compatibility
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import fix function
const { fixCommand } = await import('../../src/commands/fix.js');

describe('fix command', () => {
  const tempDir = path.join(__dirname, '../fixtures/temp-fix-test');

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('apply fixes', () => {
    it('should create .dockerignore if missing', async () => {
      const dockerfile = path.join(tempDir, 'Dockerfile');
      fs.writeFileSync(dockerfile, 'FROM node:18\nRUN npm install\n');
      
      const packageJson = path.join(tempDir, 'package.json');
      fs.writeFileSync(packageJson, JSON.stringify({ name: 'test' }));
      
      await fixCommand({
        path: tempDir,
        dryRun: false,
        safe: true
      });
      
      const dockerignore = path.join(tempDir, '.dockerignore');
      expect(fs.existsSync(dockerignore)).toBe(true);
      
      const content = fs.readFileSync(dockerignore, 'utf-8');
      expect(content).toContain('node_modules');
    });

    it('should not make changes in dry-run mode', async () => {
      const dockerfile = path.join(tempDir, 'Dockerfile');
      fs.writeFileSync(dockerfile, 'FROM node:18\n');
      
      const packageJson = path.join(tempDir, 'package.json');
      fs.writeFileSync(packageJson, JSON.stringify({ name: 'test' }));
      
      await fixCommand({
        path: tempDir,
        dryRun: true,
        safe: true
      });
      
      const dockerignore = path.join(tempDir, '.dockerignore');
      expect(fs.existsSync(dockerignore)).toBe(false);
    });

    it('should skip existing .dockerignore', async () => {
      const dockerfile = path.join(tempDir, 'Dockerfile');
      fs.writeFileSync(dockerfile, 'FROM node:18\n');
      
      const dockerignore = path.join(tempDir, '.dockerignore');
      fs.writeFileSync(dockerignore, 'existing content\n');
      
      const packageJson = path.join(tempDir, 'package.json');
      fs.writeFileSync(packageJson, JSON.stringify({ name: 'test' }));
      
      await fixCommand({
        path: tempDir,
        dryRun: false,
        safe: true
      });
      
      const content = fs.readFileSync(dockerignore, 'utf-8');
      expect(content).toBe('existing content\n');
    });
  });
});