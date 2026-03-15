import { describe, it, expect } from '@jest/globals';
import { Finding } from '../../src/types';

describe('Finding suggestedFix handling', () => {
  it('should handle findings without suggestedFix', () => {
    const finding: Finding = {
      id: 'test-001',
      domain: 'deps',
      title: 'Test finding',
      description: 'Test description',
      evidence: { file: 'test.js', snippet: 'test' },
      severity: 'high',
      confidence: 'high',
      impact: { type: 'security', estimate: 'test', confidence: 'high' },
      autoFixSafe: false
    };

    const hasAutoFix = finding.suggestedFix?.autoFixable ?? false;
    expect(hasAutoFix).toBe(false);
    
    // Use !! to convert to boolean
    const canAutoFix = !!(finding.autoFixSafe || finding.suggestedFix?.autoFixable);
    expect(canAutoFix).toBe(false);
  });

  it('should handle findings with suggestedFix but no autoFixable', () => {
    const finding: Finding = {
      id: 'test-002',
      domain: 'deps',
      title: 'Test finding',
      description: 'Test description',
      evidence: { file: 'test.js', snippet: 'test' },
      severity: 'medium',
      confidence: 'high',
      impact: { type: 'time', estimate: 'test', confidence: 'medium' },
      suggestedFix: {
        type: 'modify',
        file: 'test.js',
        description: 'Fix description',
        autoFixable: false
      },
      autoFixSafe: false
    };

    const hasAutoFix = finding.suggestedFix?.autoFixable ?? false;
    expect(hasAutoFix).toBe(false);
  });

  it('should handle findings with autoFixable', () => {
    const finding: Finding = {
      id: 'test-003',
      domain: 'deps',
      title: 'Test finding',
      description: 'Test description',
      evidence: { file: 'test.js', snippet: 'test' },
      severity: 'low',
      confidence: 'high',
      impact: { type: 'size', estimate: '100KB', confidence: 'high' },
      suggestedFix: {
        type: 'modify',
        file: 'test.js',
        description: 'Fix description',
        autoFixable: true
      },
      autoFixSafe: true
    };

    const hasAutoFix = finding.suggestedFix?.autoFixable ?? false;
    expect(hasAutoFix).toBe(true);
    
    // When both autoFixSafe and autoFixable are true, it's auto-fixable
    const canAutoFix = finding.autoFixSafe && finding.suggestedFix?.autoFixable;
    expect(canAutoFix).toBe(true);
  });
});