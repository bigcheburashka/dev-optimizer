/**
 * Tests for CiAnalyzer with Finding schema
 */

import { CiAnalyzer } from '../../src/analyzers/CiAnalyzer.js';
import * as path from 'path';
import * as fs from 'fs';
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
    it('should return unified Finding schema', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-ci');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.analyzer).toBe('ci');
      expect(result.findings).toBeDefined();
      expect(Array.isArray(result.findings)).toBe(true);
      expect(result.baseline).toBeDefined();
      expect(result.savings).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should detect missing cache in bad CI config', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-ci');
      const result = await analyzer.analyze(projectPath);
      
      const finding = result.findings.find(f => f.id.includes('ci-002'));
      expect(finding).toBeDefined();
      expect(finding?.title).toContain('No caching');
      expect(finding?.severity).toBe('high');
      expect(finding?.autoFixSafe).toBe(true);
    });

    it('should detect missing matrix in bad CI config', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-ci');
      const result = await analyzer.analyze(projectPath);
      
      const finding = result.findings.find(f => f.id.includes('ci-003'));
      expect(finding).toBeDefined();
      expect(finding?.title).toContain('No matrix');
    });

    it('should include evidence with metrics', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-ci');
      const result = await analyzer.analyze(projectPath);
      
      const finding = result.findings.find(f => f.id.includes('ci-002'));
      expect(finding?.evidence.metrics).toBeDefined();
    });

    it('should not detect missing cache in good CI config', async () => {
      const projectPath = path.join(__dirname, '../fixtures/good-ci');
      const result = await analyzer.analyze(projectPath);
      
      const finding = result.findings.find(f => f.id.includes('ci-002'));
      expect(finding).toBeUndefined();
    });

    it('should calculate time savings', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-ci');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.savings.timeSeconds).toBeGreaterThan(0);
    });

    it('should have correct domain', async () => {
      const projectPath = path.join(__dirname, '../fixtures/bad-ci');
      const result = await analyzer.analyze(projectPath);
      
      for (const finding of result.findings) {
        expect(finding.domain).toBe('ci');
      }
    });
  });

  describe('false positive handling', () => {
    it('should NOT report missing cache for workflow without npm install', async () => {
      // Create a test fixture for workflow without npm
      const projectPath = path.join(__dirname, '../fixtures/no-npm-ci');
      if (fs.existsSync(projectPath)) {
        const result = await analyzer.analyze(projectPath);
        
        // Should NOT report "No caching configured" for workflow without npm
        const cacheFinding = result.findings.find(f => 
          f.id.includes('ci-002') && f.title.includes('No caching')
        );
        expect(cacheFinding).toBeUndefined();
      }
    });

    it('should NOT report duplicate npm install for isolated jobs', async () => {
      // In GitHub Actions, each job runs in its own runner
      // npm install in different jobs is NOT a duplicate
      const projectPath = path.join(__dirname, '../fixtures/good-ci');
      const result = await analyzer.analyze(projectPath);
      
      // Should NOT report duplicate npm install
      const duplicateFinding = result.findings.find(f => 
        f.id.includes('ci-007') && f.title.includes('Duplicate npm')
      );
      expect(duplicateFinding).toBeUndefined();
    });

    it('should NOT report sequential jobs when jobs run without needs (parallel)', async () => {
      // Jobs WITHOUT 'needs' run IN PARALLEL in GitHub Actions
      // This is the optimal case, not a problem
      const projectPath = path.join(__dirname, '../fixtures/good-ci');
      const result = await analyzer.analyze(projectPath);
      
      // Should NOT report jobs run sequentially for parallel jobs
      const sequentialFinding = result.findings.find(f => 
        f.id.includes('ci-005') && f.title.includes('Jobs run sequentially')
      );
      expect(sequentialFinding).toBeUndefined();
    });
  });
});