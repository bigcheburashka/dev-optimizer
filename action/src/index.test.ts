import { generateComment } from '../src/index';

describe('generateComment', () => {
  it('should generate comment for empty findings', () => {
    const report = {
      score: 100,
      findings: [],
      savings: { timeSeconds: 0, sizeMB: 0 }
    };

    const comment = generateComment(report);
    
    expect(comment).toContain('Score: 100/100');
    expect(comment).toContain('No issues found');
    expect(comment).toContain('dev-optimizer-report');
  });

  it('should group findings by severity', () => {
    const report = {
      score: 50,
      findings: [
        { id: '1', domain: 'ci', title: 'No cache', severity: 'high', confidence: 'high', description: 'Add cache', suggestedFix: { type: 'modify', file: 'ci.yml', description: 'Add cache', autoFixable: true } },
        { id: '2', domain: 'docker', title: 'No .dockerignore', severity: 'medium', confidence: 'high', description: 'Create file', suggestedFix: { type: 'create', file: '.dockerignore', description: 'Create', autoFixable: true } },
        { id: '3', domain: 'deps', title: 'Unused dep', severity: 'low', confidence: 'medium', description: 'Remove', suggestedFix: { type: 'delete', file: 'package.json', description: 'Remove', autoFixable: false } }
      ],
      savings: { timeSeconds: 300, sizeMB: 100 }
    };

    const comment = generateComment(report);
    
    expect(comment).toContain('High Priority');
    expect(comment).toContain('Medium Priority');
    expect(comment).toContain('Low Priority');
    expect(comment).toContain('Quick Wins');
    expect(comment).toContain('Auto-fixable');
  });

  it('should limit high priority findings to 5', () => {
    const report = {
      score: 0,
      findings: Array(10).fill(null).map((_, i) => ({
        id: `${i}`,
        domain: 'ci',
        title: `Issue ${i}`,
        severity: 'high',
        confidence: 'high',
        description: 'Description',
        suggestedFix: { type: 'modify', file: 'ci.yml', description: 'Fix', autoFixable: false }
      })),
      savings: { timeSeconds: 0, sizeMB: 0 }
    };

    const comment = generateComment(report);
    
    expect(comment).toContain('Issue 0');
    expect(comment).toContain('Issue 4');
    expect(comment).toContain('and 5 more');
  });
});