/**
 * SARIF Reporter
 * Formats analysis results as SARIF for GitHub Code Scanning
 * @see https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning
 */

import { FullReport, Finding } from '../types.js';

export class SarifReporter {
  format(report: FullReport): string {
    const sarif = {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [{
        tool: {
          driver: {
            name: 'dev-optimizer',
            version: '0.1.0',
            informationUri: 'https://github.com/bigcheburashka/dev-optimizer',
            rules: report.findings.map(f => this.findingToRule(f))
          }
        },
        results: report.findings.map(f => this.findingToResult(f))
      }]
    };

    return JSON.stringify(sarif, null, 2);
  }

  private findingToRule(f: Finding): object {
    return {
      id: f.id,
      shortDescription: {
        text: f.title
      },
      fullDescription: {
        text: f.description
      },
      defaultConfiguration: {
        level: this.mapSeverity(f.severity)
      },
      helpUri: `https://github.com/bigcheburashka/dev-optimizer/blob/main/docs/checks/${f.id}.md`
    };
  }

  private findingToResult(f: Finding): object {
    const result: any = {
      ruleId: f.id,
      message: {
        text: f.description
      },
      level: this.mapSeverity(f.severity)
    };

    // Add location if file is known
    if (f.evidence?.file) {
      result.locations = [{
        physicalLocation: {
          artifactLocation: {
            uri: f.evidence.file
          }
        }
      }];

      // Add line if known
      if (f.evidence.line) {
        result.locations[0].physicalLocation.region = {
          startLine: f.evidence.line
        };
      }
    }

    // Add related location for suggested fix
    if (f.suggestedFix?.file) {
      result.relatedLocations = [{
        message: {
          text: f.suggestedFix.description
        },
        physicalLocation: {
          artifactLocation: {
            uri: f.suggestedFix.file
          }
        }
      }];
    }

    return result;
  }

  private mapSeverity(severity: string): string {
    const mapping: Record<string, string> = {
      critical: 'error',
      high: 'error',
      medium: 'warning',
      low: 'note'
    };
    return mapping[severity] || 'note';
  }
}