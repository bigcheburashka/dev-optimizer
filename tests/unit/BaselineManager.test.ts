/**
 * Tests for BaselineManager
 */

import { BaselineManager } from '../../src/baseline/BaselineManager.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create valid Baseline
function createBaseline(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    projectType: 'nodejs',
    hasPackageJson: true,
    hasDockerfile: false,
    hasCi: true,
    dependencyCount: 10,
    ...overrides
  };
}

// Helper to create valid Finding
function createFinding(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'test-001',
    domain: 'docker',
    title: 'Test Finding',
    severity: 'high',
    confidence: 'high',
    description: 'Test description',
    evidence: {},
    impact: { type: 'size', estimate: '100 MB', confidence: 'high' },
    suggestedFix: { type: 'create', file: '.dockerignore', description: 'Create .dockerignore', autoFixable: true },
    autoFixSafe: true,
    ...overrides
  };
}

describe('BaselineManager', () => {
  const tempDir = path.join(__dirname, '../fixtures/temp-baseline');
  let manager: BaselineManager;

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    manager = new BaselineManager(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('save', () => {
    it('should save baseline to file', async () => {
      const baseline = createBaseline();
      const findings = [createFinding()];

      const savedPath = await manager.save(baseline as any, findings as any, 85, { timeSeconds: 60, sizeMB: 100, percentImprovement: 10 });

      expect(fs.existsSync(savedPath)).toBe(true);
      
      const content = JSON.parse(fs.readFileSync(savedPath, 'utf-8'));
      expect(content.score).toBe(85);
      expect(content.findings.total).toBe(1);
    });

    it('should create .dev-optimizer directory', async () => {
      const baseline = createBaseline();
      const findings: any[] = [];

      await manager.save(baseline as any, findings, 100, { timeSeconds: 0, sizeMB: 0, percentImprovement: 0 });

      const baselineDir = path.join(tempDir, '.dev-optimizer');
      expect(fs.existsSync(baselineDir)).toBe(true);
    });
  });

  describe('load', () => {
    it('should return null if no baseline exists', async () => {
      const result = await manager.load();
      expect(result).toBeNull();
    });

    it('should load saved baseline', async () => {
      const baseline = createBaseline();
      const findings: any[] = [];

      await manager.save(baseline as any, findings, 75, { timeSeconds: 30, sizeMB: 50, percentImprovement: 5 });
      
      const loaded = await manager.load();
      
      expect(loaded).not.toBeNull();
      expect(loaded?.score).toBe(75);
    });
  });

  describe('compare', () => {
    it('should return newFindings when no previous baseline', async () => {
      const baseline = createBaseline();
      const findings = [createFinding()];

      const comparison = await manager.compare({
        baseline: baseline as any,
        findings: findings as any,
        score: 80,
        savings: { timeSeconds: 60, sizeMB: 100, percentImprovement: 10 }
      });

      expect(comparison.previous).toBeNull();
      expect(comparison.current.score).toBe(80);
      expect(comparison.changes.newFindings.length).toBe(1);
    });

    it('should calculate score delta', async () => {
      const baseline = createBaseline();
      const findings1: any[] = [];
      const findings2: any[] = [];

      // First save
      await manager.save(baseline as any, findings1, 70, { timeSeconds: 60, sizeMB: 100, percentImprovement: 10 });

      // Then compare with better score
      const comparison = await manager.compare({
        baseline: baseline as any,
        findings: findings2,
        score: 85,
        savings: { timeSeconds: 30, sizeMB: 50, percentImprovement: 5 }
      });

      expect(comparison.previous).not.toBeNull();
      expect(comparison.changes.scoreDelta).toBe(15); // 85 - 70 = +15
    });
  });

  describe('formatComparison', () => {
    it('should format first baseline', () => {
      const comparison = {
        previous: null,
        current: {
          timestamp: '2024-01-01T00:00:00Z',
          baseline: createBaseline(),
          findings: { total: 0, byDomain: {}, bySeverity: {} },
          score: 80,
          savings: { timeSeconds: 0, sizeMB: 0, percentImprovement: 0 }
        },
        changes: { scoreDelta: 0, findingsDelta: 0, newFindings: [] }
      };

      const output = manager.formatComparison(comparison as any);
      
      expect(output).toContain('First baseline');
      expect(output).toContain('80/100');
    });

    it('should format comparison with previous', () => {
      const comparison = {
        previous: {
          timestamp: '2024-01-01T00:00:00Z',
          baseline: createBaseline(),
          findings: { total: 0, byDomain: {}, bySeverity: {} },
          score: 70,
          savings: { timeSeconds: 0, sizeMB: 0, percentImprovement: 0 }
        },
        current: {
          timestamp: '2024-01-02T00:00:00Z',
          baseline: createBaseline(),
          findings: { total: 0, byDomain: {}, bySeverity: {} },
          score: 85,
          savings: { timeSeconds: 0, sizeMB: 0, percentImprovement: 0 }
        },
        changes: { scoreDelta: 15, findingsDelta: -2, newFindings: [] }
      };

      const output = manager.formatComparison(comparison as any);
      
      expect(output).toContain('Previous: 70/100');
      expect(output).toContain('85/100');
      expect(output).toContain('+15');
    });
  });
});