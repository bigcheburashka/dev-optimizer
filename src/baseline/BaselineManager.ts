/**
 * Baseline Manager
 * Save and compare baseline metrics over time
 */

import * as fs from 'fs';
import * as path from 'path';
import { Baseline, Savings, Finding } from '../types.js';

interface BaselineRecord {
  timestamp: string;
  baseline: Baseline;
  findings: {
    total: number;
    byDomain: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  score: number;
  savings: Savings;
}

interface BaselineHistory {
  projectPath: string;
  records: BaselineRecord[];
}

export class BaselineManager {
  private baselineDir: string;

  constructor(projectPath: string) {
    this.baselineDir = path.join(projectPath, '.dev-optimizer');
  }

  /**
   * Save current analysis as baseline
   */
  async save(
    baseline: Baseline,
    findings: Finding[],
    score: number,
    savings: Savings
  ): Promise<string> {
    if (!fs.existsSync(this.baselineDir)) {
      fs.mkdirSync(this.baselineDir, { recursive: true });
    }

    const record: BaselineRecord = {
      timestamp: new Date().toISOString(),
      baseline,
      findings: {
        total: findings.length,
        byDomain: this.countBy(findings, 'domain'),
        bySeverity: this.countBy(findings, 'severity')
      },
      score,
      savings
    };

    const baselinePath = path.join(this.baselineDir, 'baseline.json');
    fs.writeFileSync(baselinePath, JSON.stringify(record, null, 2));

    // Also append to history
    await this.appendToHistory(record);

    return baselinePath;
  }

  /**
   * Load previous baseline
   */
  async load(): Promise<BaselineRecord | null> {
    const baselinePath = path.join(this.baselineDir, 'baseline.json');
    
    if (!fs.existsSync(baselinePath)) {
      return null;
    }

    const content = fs.readFileSync(baselinePath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Load full history
   */
  async loadHistory(): Promise<BaselineHistory | null> {
    const historyPath = path.join(this.baselineDir, 'history.json');
    
    if (!fs.existsSync(historyPath)) {
      return null;
    }

    const content = fs.readFileSync(historyPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Compare current analysis with baseline
   */
  async compare(
    current: { baseline: Baseline; findings: Finding[]; score: number; savings: Savings }
  ): Promise<{
    previous: BaselineRecord | null;
    current: BaselineRecord;
    changes: {
      scoreDelta: number;
      findingsDelta: number;
      newFindings: Finding[];
      fixedFindings: Finding[];
      regressions: Finding[];
    };
  }> {
    const previous = await this.load();

    const currentRecord: BaselineRecord = {
      timestamp: new Date().toISOString(),
      baseline: current.baseline,
      findings: {
        total: current.findings.length,
        byDomain: this.countBy(current.findings, 'domain'),
        bySeverity: this.countBy(current.findings, 'severity')
      },
      score: current.score,
      savings: current.savings
    };

    if (!previous) {
      return {
        previous: null,
        current: currentRecord,
        changes: {
          scoreDelta: 0,
          findingsDelta: 0,
          newFindings: current.findings,
          fixedFindings: [],
          regressions: []
        }
      };
    }

    // Compare findings
    previous.findings.total = previous.findings.total || 0;
    
    const changes = {
      scoreDelta: current.score - previous.score,
      findingsDelta: current.findings.length - previous.findings.total,
      newFindings: current.findings, // Can't compare without stored findings
      fixedFindings: [],
      regressions: current.score < previous.score ? current.findings : []
    };

    return {
      previous,
      current: currentRecord,
      changes
    };
  }

  /**
   * Append record to history
   */
  private async appendToHistory(record: BaselineRecord): Promise<void> {
    const historyPath = path.join(this.baselineDir, 'history.json');
    
    let history: BaselineHistory = {
      projectPath: this.baselineDir,
      records: []
    };

    if (fs.existsSync(historyPath)) {
      const content = fs.readFileSync(historyPath, 'utf-8');
      history = JSON.parse(content);
    }

    history.records.push(record);

    // Keep last 100 records
    if (history.records.length > 100) {
      history.records = history.records.slice(-100);
    }

    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
  }

  /**
   * Count findings by property
   */
  private countBy(findings: Finding[], prop: keyof Finding): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const finding of findings) {
      const key = String(finding[prop]);
      counts[key] = (counts[key] || 0) + 1;
    }
    
    return counts;
  }

  /**
   * Format comparison for display
   */
  formatComparison(comparison: {
    previous: BaselineRecord | null;
    current: BaselineRecord;
    changes: { scoreDelta: number; findingsDelta: number; newFindings: Finding[] };
  }): string {
    const lines: string[] = [];

    if (!comparison.previous) {
      lines.push('📊 First baseline saved.');
      lines.push(`   Score: ${comparison.current.score}/100`);
      lines.push(`   Findings: ${comparison.current.findings.total}`);
      return lines.join('\n');
    }

    const scoreEmoji = comparison.changes.scoreDelta > 0 ? '✅' : 
                        comparison.changes.scoreDelta < 0 ? '🔴' : '➡️';

    lines.push('📊 Baseline Comparison');
    lines.push('─'.repeat(40));
    lines.push(`Previous: ${comparison.previous.score}/100 (${comparison.previous.timestamp})`);
    lines.push(`Current:  ${comparison.current.score}/100`);
    lines.push(`Change:  ${scoreEmoji} ${comparison.changes.scoreDelta > 0 ? '+' : ''}${comparison.changes.scoreDelta}`);
    lines.push('');

    if (comparison.changes.newFindings.length > 0) {
      lines.push('🆕 New Findings:');
      for (const finding of comparison.changes.newFindings.slice(5)) {
        lines.push(`   [${finding.severity.toUpperCase()}] ${finding.title}`);
      }
      if (comparison.changes.newFindings.length > 5) {
        lines.push(`   ... and ${comparison.changes.newFindings.length - 5} more`);
      }
    }

    return lines.join('\n');
  }
}