/**
 * JD Agent - Test Report Generator
 *
 * Generates HTML and JSON reports from test results.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Finding, TestScenario, TestResult, ReportOptions } from './types';

export class ReportGenerator {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  }

  /**
   * Generate a test result summary from raw data
   */
  generateResult(data: {
    findings: Finding[];
    scenarios: TestScenario[];
    duration: number;
    screenshots: string[];
    summary?: string;
    recommendations?: string[];
  }): TestResult {
    const passed = data.scenarios.filter((s) => s.passed).length;
    const failed = data.scenarios.filter((s) => !s.passed).length;
    const warnings = data.findings.filter((f) => f.type === 'warning').length;

    const summary = data.summary || this.generateSummary(data);
    const recommendations = data.recommendations || this.generateRecommendations(data.findings);

    return {
      passed,
      failed,
      warnings,
      findings: data.findings,
      scenarios: data.scenarios,
      summary,
      recommendations,
      duration: data.duration,
      screenshots: data.screenshots,
      completedAt: new Date(),
    };
  }

  /**
   * Generate an HTML report
   */
  async generateHtmlReport(result: TestResult): Promise<string> {
    const timestamp = Date.now();
    const filename = `test-report-${timestamp}.html`;
    const filepath = path.join(this.outputDir, filename);

    const html = this.buildHtml(result);
    fs.writeFileSync(filepath, html);

    return filepath;
  }

  /**
   * Generate a JSON report
   */
  async generateJsonReport(result: TestResult): Promise<string> {
    const timestamp = Date.now();
    const filename = `test-report-${timestamp}.json`;
    const filepath = path.join(this.outputDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(result, null, 2));

    return filepath;
  }

  /**
   * Generate a markdown report
   */
  async generateMarkdownReport(result: TestResult): Promise<string> {
    const timestamp = Date.now();
    const filename = `test-report-${timestamp}.md`;
    const filepath = path.join(this.outputDir, filename);

    const markdown = this.buildMarkdown(result);
    fs.writeFileSync(filepath, markdown);

    return filepath;
  }

  // ============================================
  // Private Methods
  // ============================================

  private generateSummary(data: {
    findings: Finding[];
    scenarios: TestScenario[];
    duration: number;
  }): string {
    const bugs = data.findings.filter((f) => f.type === 'bug');
    const criticalBugs = bugs.filter((b) => b.severity === 'critical');
    const highBugs = bugs.filter((b) => b.severity === 'high');
    const passes = data.findings.filter((f) => f.type === 'pass');
    const fails = data.findings.filter((f) => f.type === 'fail');

    const durationSeconds = Math.round(data.duration / 1000);
    const durationMinutes = Math.floor(durationSeconds / 60);
    const remainingSeconds = durationSeconds % 60;

    const timeStr = durationMinutes > 0
      ? `${durationMinutes}m ${remainingSeconds}s`
      : `${durationSeconds}s`;

    return `
Testing completed in ${timeStr}.

Scenarios: ${data.scenarios.length} total
  - Passed: ${data.scenarios.filter((s) => s.passed).length}
  - Failed: ${data.scenarios.filter((s) => !s.passed).length}

Findings: ${data.findings.length} total
  - Bugs: ${bugs.length} (${criticalBugs.length} critical, ${highBugs.length} high)
  - Warnings: ${data.findings.filter((f) => f.type === 'warning').length}
  - Passes: ${passes.length}
  - Fails: ${fails.length}
  - Info: ${data.findings.filter((f) => f.type === 'info').length}
    `.trim();
  }

  private generateRecommendations(findings: Finding[]): string[] {
    const recommendations: string[] = [];

    const criticalBugs = findings.filter(
      (f) => f.type === 'bug' && f.severity === 'critical'
    );
    const highBugs = findings.filter(
      (f) => f.type === 'bug' && f.severity === 'high'
    );
    const mediumBugs = findings.filter(
      (f) => f.type === 'bug' && f.severity === 'medium'
    );

    if (criticalBugs.length > 0) {
      recommendations.push(
        `URGENT: Fix ${criticalBugs.length} critical bug(s) immediately - these block core functionality`
      );
    }

    if (highBugs.length > 0) {
      recommendations.push(
        `HIGH PRIORITY: Address ${highBugs.length} high-severity issue(s) before next release`
      );
    }

    if (mediumBugs.length > 0) {
      recommendations.push(
        `Schedule fixes for ${mediumBugs.length} medium-severity issue(s)`
      );
    }

    const warnings = findings.filter((f) => f.type === 'warning');
    if (warnings.length > 0) {
      recommendations.push(
        `Review ${warnings.length} warning(s) for potential improvements`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('No critical issues found. Application appears stable.');
    }

    return recommendations;
  }

  private buildHtml(result: TestResult): string {
    const severityColors: Record<string, string> = {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#ca8a04',
      low: '#65a30d',
    };

    const typeColors: Record<string, string> = {
      bug: '#dc2626',
      warning: '#ea580c',
      fail: '#dc2626',
      pass: '#16a34a',
      info: '#2563eb',
    };

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JD Agent Test Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f9fafb;
      color: #111827;
    }
    h1 { font-size: 2rem; margin-bottom: 1rem; }
    h2 { font-size: 1.5rem; margin: 2rem 0 1rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
    h3 { font-size: 1.25rem; margin: 1rem 0 0.5rem; }

    .summary {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      white-space: pre-line;
      margin-bottom: 2rem;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: white;
      padding: 1rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      text-align: center;
    }
    .stat-value { font-size: 2rem; font-weight: bold; }
    .stat-label { color: #6b7280; font-size: 0.875rem; }
    .stat-passed .stat-value { color: #16a34a; }
    .stat-failed .stat-value { color: #dc2626; }
    .stat-warnings .stat-value { color: #ea580c; }

    .finding {
      background: white;
      padding: 1rem;
      margin: 0.75rem 0;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border-left: 4px solid #e5e7eb;
    }
    .finding-bug { border-left-color: ${typeColors.bug}; }
    .finding-warning { border-left-color: ${typeColors.warning}; }
    .finding-pass { border-left-color: ${typeColors.pass}; }
    .finding-fail { border-left-color: ${typeColors.fail}; }
    .finding-info { border-left-color: ${typeColors.info}; }

    .finding-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .finding-type {
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      color: white;
    }
    .finding-severity {
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
      background: #f3f4f6;
    }
    .finding-title { font-weight: 600; flex: 1; }
    .finding-description { color: #4b5563; margin-top: 0.5rem; }
    .finding-steps { margin-top: 0.5rem; padding-left: 1.5rem; }
    .finding-steps li { color: #6b7280; }

    .scenario {
      background: white;
      padding: 1rem;
      margin: 0.75rem 0;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .scenario-passed { border-left: 4px solid #16a34a; }
    .scenario-failed { border-left: 4px solid #dc2626; }
    .scenario-header { display: flex; align-items: center; gap: 0.5rem; }
    .scenario-status {
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      color: white;
    }
    .status-passed { background: #16a34a; }
    .status-failed { background: #dc2626; }

    .recommendations {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 1rem;
      border-radius: 8px;
      margin-top: 2rem;
    }
    .recommendations ul { margin-left: 1.5rem; }
    .recommendations li { margin: 0.5rem 0; }

    .screenshot {
      max-width: 100%;
      margin: 1rem 0;
      border-radius: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .timestamp {
      color: #9ca3af;
      font-size: 0.875rem;
      margin-top: 2rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>JD Agent Test Report</h1>

  <div class="stats">
    <div class="stat-card stat-passed">
      <div class="stat-value">${result.passed}</div>
      <div class="stat-label">Passed</div>
    </div>
    <div class="stat-card stat-failed">
      <div class="stat-value">${result.failed}</div>
      <div class="stat-label">Failed</div>
    </div>
    <div class="stat-card stat-warnings">
      <div class="stat-value">${result.warnings}</div>
      <div class="stat-label">Warnings</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${result.findings.length}</div>
      <div class="stat-label">Total Findings</div>
    </div>
  </div>

  <div class="summary">${result.summary}</div>

  <h2>Findings (${result.findings.length})</h2>
  ${result.findings.map((f) => `
    <div class="finding finding-${f.type}">
      <div class="finding-header">
        <span class="finding-type" style="background: ${typeColors[f.type] || '#6b7280'}">${f.type}</span>
        ${f.severity ? `<span class="finding-severity" style="color: ${severityColors[f.severity]}">${f.severity}</span>` : ''}
        <span class="finding-title">${this.escapeHtml(f.title)}</span>
      </div>
      ${f.description ? `<div class="finding-description">${this.escapeHtml(f.description)}</div>` : ''}
      ${f.steps && f.steps.length > 0 ? `
        <ol class="finding-steps">
          ${f.steps.map((s) => `<li>${this.escapeHtml(s)}</li>`).join('')}
        </ol>
      ` : ''}
      ${f.screenshot ? `<img class="screenshot" src="${f.screenshot}" alt="Screenshot" />` : ''}
    </div>
  `).join('')}

  <h2>Test Scenarios (${result.scenarios.length})</h2>
  ${result.scenarios.map((s) => `
    <div class="scenario ${s.passed ? 'scenario-passed' : 'scenario-failed'}">
      <div class="scenario-header">
        <span class="scenario-status ${s.passed ? 'status-passed' : 'status-failed'}">${s.passed ? 'PASSED' : 'FAILED'}</span>
        <strong>${this.escapeHtml(s.name)}</strong>
      </div>
      ${s.description ? `<p>${this.escapeHtml(s.description)}</p>` : ''}
      ${s.summary ? `<p><em>${this.escapeHtml(s.summary)}</em></p>` : ''}
    </div>
  `).join('')}

  ${result.recommendations.length > 0 ? `
    <div class="recommendations">
      <h3>Recommendations</h3>
      <ul>
        ${result.recommendations.map((r) => `<li>${this.escapeHtml(r)}</li>`).join('')}
      </ul>
    </div>
  ` : ''}

  <p class="timestamp">Report generated: ${result.completedAt.toISOString()}</p>
</body>
</html>`;
  }

  private buildMarkdown(result: TestResult): string {
    return `# JD Agent Test Report

## Summary

| Metric | Value |
|--------|-------|
| Passed | ${result.passed} |
| Failed | ${result.failed} |
| Warnings | ${result.warnings} |
| Total Findings | ${result.findings.length} |
| Duration | ${Math.round(result.duration / 1000)}s |

\`\`\`
${result.summary}
\`\`\`

## Findings

${result.findings.map((f) => `
### ${f.type.toUpperCase()}: ${f.title}

${f.severity ? `**Severity:** ${f.severity}` : ''}

${f.description || ''}

${f.steps && f.steps.length > 0 ? `
**Steps to Reproduce:**
${f.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}
` : ''}
`).join('\n---\n')}

## Test Scenarios

${result.scenarios.map((s) => `
### ${s.passed ? '✅' : '❌'} ${s.name}

${s.description || ''}

${s.summary ? `*${s.summary}*` : ''}
`).join('\n')}

## Recommendations

${result.recommendations.map((r) => `- ${r}`).join('\n')}

---

*Report generated: ${result.completedAt.toISOString()}*
`;
  }

  private escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
  }
}
