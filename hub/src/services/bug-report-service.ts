import nodemailer from 'nodemailer';

interface BugReportPayload {
  title: string;
  description: string;
  steps?: string;
  expected?: string;
  actual?: string;
  reporterEmail?: string;
  pageUrl?: string;
  userAgent?: string;
}

class BugReportService {
  private smtpHost = process.env.GODADDY_SMTP_HOST || 'smtpout.secureserver.net';
  private smtpPort = Number(process.env.GODADDY_SMTP_PORT || 465);
  private smtpUser = process.env.GODADDY_SMTP_USER || '';
  private smtpPass = process.env.GODADDY_SMTP_PASS || '';
  private fromAddress = process.env.GODADDY_SMTP_FROM || this.smtpUser;
  private toAddress = process.env.BUG_REPORT_TO_EMAIL || this.smtpUser;

  isConfigured() {
    return !!(this.smtpUser && this.smtpPass && this.toAddress);
  }

  async sendBugReport(payload: BugReportPayload) {
    if (!this.isConfigured()) {
      throw new Error('Bug report email not configured');
    }

    const transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: this.smtpPort === 465,
      auth: {
        user: this.smtpUser,
        pass: this.smtpPass,
      },
    });

    const lines = [
      `Title: ${payload.title}`,
      payload.reporterEmail ? `Reporter: ${payload.reporterEmail}` : undefined,
      payload.pageUrl ? `Page: ${payload.pageUrl}` : undefined,
      payload.userAgent ? `User Agent: ${payload.userAgent}` : undefined,
      '',
      'Description:',
      payload.description,
      payload.steps ? `\nSteps:\n${payload.steps}` : undefined,
      payload.expected ? `\nExpected:\n${payload.expected}` : undefined,
      payload.actual ? `\nActual:\n${payload.actual}` : undefined,
    ].filter(Boolean);

    await transporter.sendMail({
      from: this.fromAddress,
      to: this.toAddress,
      subject: `Crypto Tracker Bug: ${payload.title}`,
      text: lines.join('\n'),
    });
  }

  async verifyConnection() {
    if (!this.isConfigured()) {
      throw new Error('Bug report email not configured');
    }

    const transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: this.smtpPort === 465,
      auth: {
        user: this.smtpUser,
        pass: this.smtpPass,
      },
    });

    await transporter.verify();
  }

  async sendTestEmail() {
    if (!this.isConfigured()) {
      throw new Error('Bug report email not configured');
    }

    const transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: this.smtpPort === 465,
      auth: {
        user: this.smtpUser,
        pass: this.smtpPass,
      },
    });

    await transporter.sendMail({
      from: this.fromAddress,
      to: this.toAddress,
      subject: 'Crypto Tracker: GoDaddy SMTP test',
      text: 'SMTP authentication succeeded for bug reports.',
    });
  }
}

export const bugReportService = new BugReportService();
