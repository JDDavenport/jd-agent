/**
 * JD Agent - Privacy Policy Page
 * 
 * Privacy policy page required for Whoop API OAuth
 */

import { Hono } from 'hono';

const privacyRouter = new Hono();

const privacyPolicyHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Privacy Policy - JD Agent</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0c0c12;
      color: #f0f0f5;
      line-height: 1.6;
      padding: 2rem;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      background: #12121a;
      border-radius: 12px;
      padding: 3rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }

    header {
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid #2a2a3a;
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      background: linear-gradient(135deg, #7c3aed, #a855f7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }

    .last-updated {
      color: #8888aa;
      font-size: 0.9rem;
    }

    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-top: 2rem;
      margin-bottom: 1rem;
      color: #e5e5e5;
    }

    h3 {
      font-size: 1.2rem;
      font-weight: 600;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      color: #d0d0d5;
    }

    p {
      margin-bottom: 1rem;
      color: #c0c0c5;
    }

    ul, ol {
      margin-left: 1.5rem;
      margin-bottom: 1rem;
      color: #c0c0c5;
    }

    li {
      margin-bottom: 0.5rem;
    }

    strong {
      color: #e5e5e5;
      font-weight: 600;
    }

    a {
      color: #7c3aed;
      text-decoration: none;
      transition: color 0.2s;
    }

    a:hover {
      color: #a855f7;
      text-decoration: underline;
    }

    .contact {
      background: #1a1a25;
      border-left: 4px solid #7c3aed;
      padding: 1rem 1.5rem;
      margin: 2rem 0;
      border-radius: 4px;
    }

    .contact h3 {
      margin-top: 0;
    }

    footer {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid #2a2a3a;
      text-align: center;
      color: #8888aa;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Privacy Policy</h1>
      <p class="last-updated">Last Updated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    </header>

    <section>
      <p>
        JD Agent ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our personal AI agent system.
      </p>
    </section>

    <section>
      <h2>1. Information We Collect</h2>
      
      <h3>1.1 Information You Provide</h3>
      <p>We collect information you provide directly to us, including:</p>
      <ul>
        <li><strong>Account Information:</strong> Email address, name, and authentication credentials</li>
        <li><strong>Task Data:</strong> Tasks, projects, schedules, and productivity data you create</li>
        <li><strong>Content:</strong> Notes, documents, recordings, and other content you upload</li>
        <li><strong>Calendar Data:</strong> Events, schedules, and calendar information</li>
        <li><strong>Integration Data:</strong> Data from third-party services you connect (Linear, Canvas, Google Calendar, etc.)</li>
      </ul>

      <h3>1.2 Automatically Collected Information</h3>
      <p>When you use our service, we automatically collect:</p>
      <ul>
        <li><strong>Usage Data:</strong> How you interact with the service, features used, and time spent</li>
        <li><strong>Device Information:</strong> Device type, operating system, and browser information</li>
        <li><strong>Log Data:</strong> IP address, access times, and error logs</li>
      </ul>

      <h3>1.3 Third-Party Data</h3>
      <p>We collect data from third-party services you authorize us to access:</p>
      <ul>
        <li><strong>Whoop:</strong> Health and fitness data, including recovery, strain, and sleep metrics</li>
        <li><strong>Linear:</strong> Project and task management data</li>
        <li><strong>Canvas LMS:</strong> Course assignments, grades, and academic data</li>
        <li><strong>Google Calendar:</strong> Calendar events and schedule information</li>
        <li><strong>Gmail:</strong> Email content for task extraction and triage</li>
      </ul>
    </section>

    <section>
      <h2>2. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Provide, maintain, and improve our AI agent services</li>
        <li>Process and respond to your requests and inquiries</li>
        <li>Generate personalized insights, recommendations, and briefings</li>
        <li>Sync data between connected services</li>
        <li>Send you notifications, updates, and daily briefings</li>
        <li>Analyze usage patterns to improve our services</li>
        <li>Detect and prevent fraud or abuse</li>
        <li>Comply with legal obligations</li>
      </ul>
    </section>

    <section>
      <h2>3. Data Sharing and Disclosure</h2>
      
      <h3>3.1 We Do Not Sell Your Data</h3>
      <p>We do not sell, rent, or trade your personal information to third parties.</p>

      <h3>3.2 Service Providers</h3>
      <p>We may share your information with third-party service providers who perform services on our behalf, including:</p>
      <ul>
        <li>Cloud hosting providers (Railway, Cloudflare)</li>
        <li>AI service providers (OpenAI for chat, Deepgram for transcription)</li>
        <li>Database providers (PostgreSQL)</li>
      </ul>

      <h3>3.3 Integration Services</h3>
      <p>When you authorize integrations, we share relevant data with those services (e.g., tasks to Linear, events to Google Calendar) according to their privacy policies.</p>

      <h3>3.4 Legal Requirements</h3>
      <p>We may disclose your information if required by law or to protect our rights and safety.</p>
    </section>

    <section>
      <h2>4. Data Security</h2>
      <p>
        We implement appropriate technical and organizational measures to protect your personal information, including:
      </p>
      <ul>
        <li>Encryption of data in transit and at rest</li>
        <li>Secure authentication and authorization</li>
        <li>Regular security assessments</li>
        <li>Access controls and monitoring</li>
      </ul>
      <p>
        However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.
      </p>
    </section>

    <section>
      <h2>5. Your Rights and Choices</h2>
      <p>You have the right to:</p>
      <ul>
        <li><strong>Access:</strong> Request access to your personal information</li>
        <li><strong>Correction:</strong> Request correction of inaccurate data</li>
        <li><strong>Deletion:</strong> Request deletion of your personal information</li>
        <li><strong>Portability:</strong> Request export of your data</li>
        <li><strong>Opt-out:</strong> Disconnect integrations or disable features at any time</li>
      </ul>
      <p>
        To exercise these rights, please contact us using the information provided below.
      </p>
    </section>

    <section>
      <h2>6. Data Retention</h2>
      <p>
        We retain your personal information for as long as necessary to provide our services and comply with legal obligations. You may request deletion of your data at any time.
      </p>
    </section>

    <section>
      <h2>7. Children's Privacy</h2>
      <p>
        Our service is not intended for children under 13. We do not knowingly collect personal information from children under 13.
      </p>
    </section>

    <section>
      <h2>8. Changes to This Privacy Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.
      </p>
    </section>

    <section class="contact">
      <h3>9. Contact Us</h3>
      <p>
        If you have any questions about this Privacy Policy, please contact us:
      </p>
      <p>
        <strong>Email:</strong> <a href="mailto:privacy@jdagent.local">privacy@jdagent.local</a><br>
        <strong>Website:</strong> <a href="http://localhost:3000">http://localhost:3000</a>
      </p>
    </section>

    <footer>
      <p>JD Agent - Personal AI Agent System</p>
      <p>&copy; ${new Date().getFullYear()} All rights reserved</p>
    </footer>
  </div>
</body>
</html>`;

/**
 * GET /privacy
 * Serve the privacy policy page
 */
privacyRouter.get('/', (c) => {
  return c.html(privacyPolicyHTML);
});

export { privacyRouter };
