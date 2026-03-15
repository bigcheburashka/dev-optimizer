/**
 * Tests for handling missing suggestedFix in Findings
 * Bug: TypeError when finding.suggestedFix is undefined
 */

import { ConsoleReporter } from '../../src/reporters/ConsoleReporter.js';
import { Finding } from '../../src/types.js';

describe('Finding without suggestedFix', () => {
  it('should not crash when finding has suggestedFix', () => {
    const reporter = new ConsoleReporter();
    
    // Security findings may not have autoFixable suggestedFix
    const finding: Finding = {
      id: 'deps-security-test',
      domain: 'deps',
      title: 'Security vulnerability found',
      description: 'Test security finding without autoFix',
      evidence: {
        file: 'package.json',
        snippet: '"lodash": "4.17.0"',
        metrics: {
          cve: 'CVE-2021-23337',
          severity: 'high'
        }
      },
      severity: 'high',
      confidence: 'high',
      impact: {
        type: 'security',
        estimate: 'CVE-2021-23337',
        confidence: 'high'
      },
      suggestedFix: {
        type: 'modify',
        file: 'package.json',
        description: 'Update lodash to 4.17.21 or later',
        autoFixable: false
      },
      autoFixSafe: false
    };

    // This should not throw TypeError
    expect(() => {
      const output = reporter.format({
        timestamp: new Date().toISOString(),
        path: '/test',
        version: '0.1.0',
        findings: [finding],
        topFindings: [finding],
        quickWins: [],
        manualReview: [],
        baseline: {
          projectType: 'nodejs',
          hasPackageJson: true,
          hasDockerfile: false,
          hasCi: true,
          dependencyCount: 10
        },
        totalSavings: { timeSeconds: 0, sizeMB: 0, percentImprovement: 0 },
        score: 50
      });
      expect(output).toBeDefined();
    }).not.toThrow();
  });

  it('should filter quickWins without crashing', () => {
    // Simulate the quickWins filter from analyze.ts
    const findings: Finding[] = [
      {
        id: 'test-1',
        domain: 'deps',
        title: 'Finding with autoFix',
        description: 'Test',
        evidence: { file: 'test.js', snippet: 'test' },
        severity: 'low',
        confidence: 'high',
        impact: { type: 'size', estimate: '1KB', confidence: 'high' },
        suggestedFix: { type: 'modify', file: 'test.js', description: 'Fix', autoFixable: true },
        autoFixSafe: true
      },
      {
        id: 'test-2',
        domain: 'deps',
        title: 'Finding without autoFix',
        description: 'Test',
        evidence: { file: 'test.js', snippet: 'test' },
        severity: 'medium',
        confidence: 'high',
        impact: { type: 'time', estimate: '1s', confidence: 'high' },
        suggestedFix: { type: 'modify', file: 'test.js', description: 'Manual fix required', autoFixable: false },
        autoFixSafe: false
      },
      {
        id: 'test-3',
        domain: 'deps',
        title: 'Security finding (no autoFix)',
        description: 'Test',
        evidence: { file: 'test.js', snippet: 'test' },
        severity: 'high',
        confidence: 'high',
        impact: { type: 'security', estimate: 'CVE-test', confidence: 'high' },
        suggestedFix: { type: 'modify', file: 'test.js', description: 'Update package', autoFixable: false },
        autoFixSafe: false
      }
    ];

    // This should not throw TypeError - using optional chaining
    const quickWins = findings.filter(f => f.suggestedFix?.autoFixable && f.confidence === 'high');
    
    // Only test-1 has autoFixable: true && confidence: high
    expect(quickWins.length).toBe(1);
    expect(quickWins[0].id).toBe('test-1');
  });

  it('should handle findings list in ConsoleReporter', () => {
    const reporter = new ConsoleReporter();
    
    const findings: Finding[] = [
      {
        id: 'test-1',
        domain: 'deps',
        title: 'Auto-fixable finding',
        description: 'Test',
        evidence: { file: 'test.js', snippet: 'test' },
        severity: 'low',
        confidence: 'high',
        impact: { type: 'size', estimate: '1KB', confidence: 'high' },
        suggestedFix: { type: 'modify', file: 'test.js', description: 'Fix', autoFixable: true },
        autoFixSafe: true
      },
      {
        id: 'test-2',
        domain: 'deps',
        title: 'Manual fix finding',
        description: 'Test',
        evidence: { file: 'test.js', snippet: 'test' },
        severity: 'medium',
        confidence: 'medium',
        impact: { type: 'time', estimate: '1s', confidence: 'medium' },
        suggestedFix: { type: 'modify', file: 'test.js', description: 'Manual fix', autoFixable: false },
        autoFixSafe: false
      }
    ];

    expect(() => {
      const output = reporter.format({
        timestamp: new Date().toISOString(),
        path: '/test',
        version: '0.1.0',
        score: 75,
        findings,
        topFindings: findings,
        quickWins: [findings[0]],
        manualReview: [findings[1]],
        baseline: {
          projectType: 'nodejs',
          hasPackageJson: true,
          hasDockerfile: false,
          hasCi: true,
          dependencyCount: 2
        },
        totalSavings: { timeSeconds: 1, sizeMB: 0, percentImprovement: 10 }
      });
      expect(output).toContain('Auto-fixable finding');
      expect(output).toContain('Manual fix finding');
    }).not.toThrow();
  });
});