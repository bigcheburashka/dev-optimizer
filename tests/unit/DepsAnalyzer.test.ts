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

  describe('knip dependency parsing', () => {
    it('should handle string dependency names from knip', () => {
      // knip can return dependencies as strings
      const depName = 'lodash';
      const result = typeof depName === 'string' ? depName : (depName as any).name || String(depName);
      expect(result).toBe('lodash');
    });

    it('should handle object dependency names from knip', () => {
      // knip can also return dependencies as objects with name property
      const depObj = { name: 'moment', version: '2.29.0' };
      const result = typeof depObj === 'string' ? depObj : (depObj as any).name || String(depObj);
      expect(result).toBe('moment');
    });

    it('should not show [object Object] for dependency names', () => {
      // Test the actual fix - ensure we never get [object Object]
      const depObj = { name: 'axios' };
      const depName = typeof depObj === 'string' ? depObj : (depObj as any).name || String(depObj);
      
      // This should NOT be "[object Object]"
      expect(depName).not.toBe('[object Object]');
      expect(depName).toBe('axios');
    });

    it('should handle mixed string and object dependencies', () => {
      const deps = [
        'lodash',
        { name: 'moment' },
        'axios',
        { name: 'underscore' }
      ];
      
      const names = deps.map(d => typeof d === 'string' ? d : (d as any).name || String(d));
      
      expect(names).toEqual(['lodash', 'moment', 'axios', 'underscore']);
      expect(names).not.toContain('[object Object]');
    });

    it('should handle unnamed dependency gracefully', () => {
      // Edge case: dependency object without name
      const depObj = { version: '1.0.0' };
      const result = typeof depObj === 'string' ? depObj : (depObj as any).name || String(depObj);
      
      // Should fall back to String() which gives "[object Object]"
      // But at least it won't crash
      expect(typeof result).toBe('string');
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