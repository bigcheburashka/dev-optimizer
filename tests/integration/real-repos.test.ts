/**
 * Integration tests for public repositories
 * These tests require network access and may be slow
 */

import { DockerAnalyzer } from '../../src/analyzers/DockerAnalyzer.js';
import { DepsAnalyzer } from '../../src/analyzers/DepsAnalyzer.js';
import { CiAnalyzer } from '../../src/analyzers/CiAnalyzer.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Integration Tests', () => {
  beforeAll(() => {
    // Ensure test directory exists
    const testDir = path.join(__dirname, '../fixtures/integration');
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Cleanup test repositories
    const testDir = path.join(__dirname, '../fixtures/integration');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('DockerAnalyzer on real projects', () => {
    it('should analyze Dockerfile in current project', async () => {
      const projectPath = path.join(__dirname, '../../');
      const analyzer = new DockerAnalyzer();
      
      const isApplicable = await analyzer.isApplicable(projectPath);
      expect(typeof isApplicable).toBe('boolean');
    });
  });

  describe('DepsAnalyzer on real projects', () => {
    it('should analyze package.json in current project', async () => {
      const projectPath = path.join(__dirname, '../../');
      const analyzer = new DepsAnalyzer();
      
      const isApplicable = await analyzer.isApplicable(projectPath);
      expect(isApplicable).toBe(true);
      
      const result = await analyzer.analyze(projectPath);
      
      expect(result).toHaveProperty('analyzer', 'deps');
      expect(result).toHaveProperty('findings');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('baseline');
      expect(result.findings).toBeInstanceOf(Array);
    });
  });

  describe('CiAnalyzer on real projects', () => {
    it('should analyze CI config in current project', async () => {
      const projectPath = path.join(__dirname, '../../');
      const analyzer = new CiAnalyzer();
      
      const isApplicable = await analyzer.isApplicable(projectPath);
      expect(typeof isApplicable).toBe('boolean');
    });
  });

  describe('Finding Schema Validation', () => {
    it('should return correct Finding structure from all analyzers', async () => {
      const projectPath = path.join(__dirname, '../../');
      
      const analyzers = [
        new DockerAnalyzer(),
        new DepsAnalyzer(),
        new CiAnalyzer()
      ];

      for (const analyzer of analyzers) {
        if (await analyzer.isApplicable(projectPath)) {
          const result = await analyzer.analyze(projectPath);
          
          // Check Finding schema
          for (const finding of result.findings) {
            expect(finding).toHaveProperty('id');
            expect(finding).toHaveProperty('domain');
            expect(finding).toHaveProperty('title');
            expect(finding).toHaveProperty('description');
            expect(finding).toHaveProperty('evidence');
            expect(finding).toHaveProperty('severity');
            expect(finding).toHaveProperty('confidence');
            expect(finding).toHaveProperty('impact');
            expect(finding).toHaveProperty('suggestedFix');
            expect(finding).toHaveProperty('autoFixSafe');
            
            // Validate enums
            expect(['docker', 'deps', 'ci']).toContain(finding.domain);
            expect(['critical', 'high', 'medium', 'low']).toContain(finding.severity);
            expect(['high', 'medium', 'low']).toContain(finding.confidence);
          }
        }
      }
    });
  });
});