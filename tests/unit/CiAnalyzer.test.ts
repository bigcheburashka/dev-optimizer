/**
 * Tests for CiAnalyzer
 */

import { CiAnalyzer } from '../../src/analyzers/CiAnalyzer.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('CiAnalyzer', () => {
  const analyzer = new CiAnalyzer();

  describe('isApplicable', () => {
    it('should return true for project with GitHub Actions', async () => {
      const projectPath = path.join(__dirname, '../fixtures/good-ci');
      const result = await analyzer.isApplicable(projectPath);
      expect(result).toBe(true);
    });

    it('should return false for project without CI config', async () => {
      const projectPath = path.join(__dirname, '../fixtures/no-ci');
      const result = await analyzer.isApplicable(projectPath);
      expect(result).toBe(false);
    });
  });

  describe('analyze', () => {
    describe('bad CI config', () => {
      it('should detect missing cache', async () => {
        const projectPath = path.join(__dirname, '../fixtures/bad-ci');
        const result = await analyzer.analyze(projectPath);
        
        expect(result.issues).toContainEqual(
          expect.objectContaining({
            type: 'missing_cache',
            severity: 'high'
          })
        );
      });

      it('should detect missing matrix', async () => {
        const projectPath = path.join(__dirname, '../fixtures/bad-ci');
        const result = await analyzer.analyze(projectPath);
        
        expect(result.issues).toContainEqual(
          expect.objectContaining({
            type: 'missing_matrix',
            severity: 'medium'
          })
        );
      });

      it('should detect missing timeout', async () => {
        const projectPath = path.join(__dirname, '../fixtures/bad-ci');
        const result = await analyzer.analyze(projectPath);
        
        expect(result.issues).toContainEqual(
          expect.objectContaining({
            type: 'missing_timeout'
          })
        );
      });

      it('should detect sequential jobs', async () => {
        const projectPath = path.join(__dirname, '../fixtures/bad-ci');
        const result = await analyzer.analyze(projectPath);
        
        expect(result.issues).toContainEqual(
          expect.objectContaining({
            type: 'sequential_jobs',
            severity: 'medium'
          })
        );
      });

      it('should have low score for bad CI config', async () => {
        const projectPath = path.join(__dirname, '../fixtures/bad-ci');
        const result = await analyzer.analyze(projectPath);
        
        expect(result.score).toBeLessThan(70);
      });

      it('should suggest adding cache', async () => {
        const projectPath = path.join(__dirname, '../fixtures/bad-ci');
        const result = await analyzer.analyze(projectPath);
        
        const cacheSuggestion = result.suggestions.find(s => s.type === 'add_cache');
        expect(cacheSuggestion).toBeDefined();
        expect(cacheSuggestion?.autoFix).toBe(true);
        expect(cacheSuggestion?.safe).toBe(true);
      });

      it('should calculate time savings', async () => {
        const projectPath = path.join(__dirname, '../fixtures/bad-ci');
        const result = await analyzer.analyze(projectPath);
        
        expect(result.savings.timeSeconds).toBeGreaterThan(0);
      });
    });

    describe('good CI config', () => {
      it('should have high score for good CI config', async () => {
        const projectPath = path.join(__dirname, '../fixtures/good-ci');
        const result = await analyzer.analyze(projectPath);
        
        expect(result.score).toBeGreaterThanOrEqual(80);
      });

      it('should not detect missing cache', async () => {
        const projectPath = path.join(__dirname, '../fixtures/good-ci');
        const result = await analyzer.analyze(projectPath);
        
        expect(result.issues).not.toContainEqual(
          expect.objectContaining({
            type: 'missing_cache'
          })
        );
      });

      it('should not detect missing matrix', async () => {
        const projectPath = path.join(__dirname, '../fixtures/good-ci');
        const result = await analyzer.analyze(projectPath);
        
        expect(result.issues).not.toContainEqual(
          expect.objectContaining({
            type: 'missing_matrix'
          })
        );
      });

      it('should not detect sequential jobs (has needs directive)', async () => {
        const projectPath = path.join(__dirname, '../fixtures/good-ci');
        const result = await analyzer.analyze(projectPath);
        
        expect(result.issues).not.toContainEqual(
          expect.objectContaining({
            type: 'sequential_jobs'
          })
        );
      });
    });
  });

  describe('savings calculation', () => {
    it('should calculate savings for missing cache', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-ci');
      const result = await analyzer.analyze(projectPath);
      
      // Missing cache = ~2 minutes savings
      expect(result.savings.timeSeconds).toBeGreaterThanOrEqual(120);
    });

    it('should calculate percent improvement', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-ci');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.savings.percentImprovement).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty workflow directory', async () => {
      // Create temp empty directory
      const tempPath = path.join(__dirname, '../fixtures/empty-ci');
      const fs = await import('fs');
      
      if (!fs.existsSync(tempPath)) {
        fs.mkdirSync(tempPath, { recursive: true });
      }
      
      const workflowsPath = path.join(tempPath, '.github/workflows');
      if (!fs.existsSync(workflowsPath)) {
        fs.mkdirSync(workflowsPath, { recursive: true });
      }
      
      const result = await analyzer.analyze(tempPath);
      expect(result.score).toBe(100); // No issues = perfect score
    });
  });
});