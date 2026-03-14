/**
 * Tests for DockerAnalyzer with Finding schema
 */

import { DockerAnalyzer } from '../../src/analyzers/DockerAnalyzer.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    it('should return unified Finding schema', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.analyzer).toBe('docker');
      expect(result.findings).toBeDefined();
      expect(Array.isArray(result.findings)).toBe(true);
      expect(result.baseline).toBeDefined();
      expect(result.savings).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should detect missing .dockerignore', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      const finding = result.findings.find(f => f.id === 'docker-001');
      expect(finding).toBeDefined();
      expect(finding?.title).toContain('Missing .dockerignore');
      expect(finding?.severity).toBe('high');
      expect(finding?.confidence).toBe('high');
      expect(finding?.autoFixSafe).toBe(true);
    });

    it('should detect no multistage build', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      const finding = result.findings.find(f => f.id === 'docker-002');
      expect(finding).toBeDefined();
      expect(finding?.title).toContain('No multistage');
      expect(finding?.severity).toBe('high');
      expect(finding?.autoFixSafe).toBe(false);
    });

    it('should detect large base image', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      const finding = result.findings.find(f => f.id === 'docker-003');
      expect(finding).toBeDefined();
      expect(finding?.title).toContain('Large base image');
      expect(finding?.severity).toBe('medium');
    });

    it('should include evidence in findings', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      const finding = result.findings[0];
      expect(finding?.evidence).toBeDefined();
      expect(finding?.impact).toBeDefined();
      expect(finding?.suggestedFix).toBeDefined();
    });

    it('should have correct impact structure', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      for (const finding of result.findings) {
        expect(finding.impact.type).toMatch(/time|size|cost/);
        expect(finding.impact.estimate).toBeDefined();
        expect(['high', 'medium', 'low']).toContain(finding.impact.confidence);
      }
    });

    it('should calculate score based on severity', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      // Bad Dockerfile should have low score (penalty changed)
      expect(result.score).toBeLessThan(80);
    });

    it('should have higher score for good Dockerfile', async () => {
      const projectPath = path.join(__dirname, '../fixtures/good-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.score).toBeGreaterThan(60);
    });

    it('should calculate savings', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-dockerfile');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.savings.sizeMB).toBeGreaterThan(0);
    });
  });
});