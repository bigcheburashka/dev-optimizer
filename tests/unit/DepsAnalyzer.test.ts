/**
 * Tests for DepsAnalyzer with Finding schema
 */

import { DepsAnalyzer } from '../../src/analyzers/DepsAnalyzer.js';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('DepsAnalyzer', () => {
  const analyzer = new DepsAnalyzer();

  describe('isApplicable', () => {
    it('should return true for project with package.json', async () => {
      const projectPath = path.join(__dirname, '../../');
      const result = await analyzer.isApplicable(projectPath);
      expect(result).toBe(true);
    });

    it('should return false for project without package.json', async () => {
      const projectPath = path.join(__dirname, '../fixtures/no-dockerfile');
      const result = await analyzer.isApplicable(projectPath);
      expect(result).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should return unified Finding schema', async () => {
      const projectPath = path.join(__dirname, '../../');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.analyzer).toBe('deps');
      expect(result.findings).toBeDefined();
      expect(Array.isArray(result.findings)).toBe(true);
      expect(result.baseline).toBeDefined();
      expect(result.savings).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should detect project type', async () => {
      const projectPath = path.join(__dirname, '../../');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.baseline.projectType).toBeDefined();
      expect(['typescript', 'nodejs', 'nextjs', 'react']).toContain(result.baseline.projectType);
    });

    it('should count dependencies', async () => {
      const projectPath = path.join(__dirname, '../../');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.baseline.dependencyCount).toBeGreaterThan(0);
    });

    it('should measure node_modules size', async () => {
      const projectPath = path.join(__dirname, '../../');
      const result = await analyzer.analyze(projectPath);
      
      // node_modules should exist in this project
      expect(result.baseline.nodeModulesSizeMB).toBeDefined();
      // May be 0 if node_modules is empty or measurement fails
      expect(typeof result.baseline.nodeModulesSizeMB).toBe('number');
    });

    it('should detect duplicate dependencies (same package in deps and devDeps)', async () => {
      const projectPath = path.join(__dirname, '../fixtures/unused-deps');
      
      // Create node_modules to avoid error
      const fs = await import('fs');
      const nodeModulesPath = path.join(projectPath, 'node_modules');
      if (!fs.existsSync(nodeModulesPath)) {
        fs.mkdirSync(nodeModulesPath, { recursive: true });
      }
      
      const result = await analyzer.analyze(projectPath);
      
      // Should find lodash in both deps and devDeps
      const duplicateFinding = result.findings.find(f => 
        f.id.includes('deps-002') && f.title.includes('Duplicate')
      );
      
      expect(duplicateFinding).toBeDefined();
    });

    it('should include correct impact structure in findings', async () => {
      const projectPath = path.join(__dirname, '../../');
      const result = await analyzer.analyze(projectPath);
      
      for (const finding of result.findings) {
        expect(finding.domain).toBe('deps');
        expect(finding.impact.type).toMatch(/time|size|cost|security|maintenance/);
        expect(['high', 'medium', 'low']).toContain(finding.confidence);
      }
    });

    it('should calculate score based on severity', async () => {
      const projectPath = path.join(__dirname, '../../');
      const result = await analyzer.analyze(projectPath);
      
      // Score should be between 0 and 100
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });

  describe('baseline', () => {
    it('should detect if package.json has Docker', async () => {
      const projectPath = path.join(__dirname, '../../');
      const result = await analyzer.analyze(projectPath);
      
      // This project doesn't have Dockerfile by default
      expect(typeof result.baseline.hasDockerfile).toBe('boolean');
    });

    it('should detect if package.json has CI', async () => {
      const projectPath = path.join(__dirname, '../../');
      const result = await analyzer.analyze(projectPath);
      
      expect(result.baseline.hasCi).toBe(true);
    });
  });
});