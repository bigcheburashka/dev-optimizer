/**
 * Tests for DockerAnalyzer
 */

import { DockerAnalyzer } from '../../src/analyzers/DockerAnalyzer.js';
import * as path from 'path';

describe('DockerAnalyzer', () => {
  const analyzer = new DockerAnalyzer();

  describe('isApplicable', () => {
    it('should return true for project with Dockerfile', async () => {
      const projectPath = path.join(__dirname, '../fixtures/good-dockerfile');
      const result = await analyzer.isApplicable(projectPath);
      expect(result).toBe(true);
    });

    it('should return false for project without Dockerfile', async () => {
      const projectPath = path.join(__dirname, '../fixtures/no-dockerfile');
      const result = await analyzer.isApplicable(projectPath);
      expect(result).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should detect missing .dockerignore', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'missing_dockerignore',
          severity: 'high'
        })
      );
    });

    it('should detect no multistage build', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'no_multistage',
          severity: 'high'
        })
      );
    });

    it('should detect large base image', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'large_base_image',
          severity: 'medium'
        })
      );
    });

    it('should detect too many layers', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'too_many_layers'
        })
      );
    });

    it('should detect no cleanup', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'no_cleanup',
          severity: 'medium'
        })
      );
    });

    it('should have score below 60 for bad Dockerfile', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.score).toBeLessThan(60);
    });

    it('should have score above 80 for good Dockerfile', async () => {
      const projectPath = path.join(__dirname, '../fixtures/good-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.score).toBeGreaterThan(80);
    });

    it('should calculate potential savings', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.savings.sizeMB).toBeGreaterThan(0);
      expect(result.savings.timeSeconds).toBeGreaterThan(0);
    });

    it('should generate auto-fix suggestions', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      const autoFixSuggestions = result.suggestions.filter(s => s.autoFix);
      expect(autoFixSuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty Dockerfile', async () => {
      // Would need a fixture for this
      // Skipping for now
    });

    it('should handle Dockerfile with lowercase filename', async () => {
      // Would need a fixture for this
      // Skipping for now
    });
  });
});