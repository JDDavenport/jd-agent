import { Hono } from 'hono';
import { google } from 'googleapis';

const oauthRouter = new Hono();

// Required scopes for calendar and drive access
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
];

/**
 * Create OAuth2 client
 */
function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/oauth/google/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * GET /api/oauth/google
 * Start Google OAuth flow - redirects to Google consent screen
 */
oauthRouter.get('/google', async (c) => {
  try {
    const oauth2Client = getOAuth2Client();

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent', // Force consent to get new refresh token
    });

    return c.redirect(authUrl);
  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message,
      message: 'Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in your .env file',
    }, 500);
  }
});

/**
 * GET /api/oauth/google/callback
 * Handle OAuth callback from Google
 */
oauthRouter.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');

  if (error) {
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Error</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { background: #fee2e2; border: 1px solid #ef4444; padding: 20px; border-radius: 8px; }
          h1 { color: #dc2626; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>OAuth Error</h1>
          <p>Google returned an error: <strong>${error}</strong></p>
          <p><a href="/api/oauth/google">Try again</a></p>
        </div>
      </body>
      </html>
    `);
  }

  if (!code) {
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Error</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { background: #fee2e2; border: 1px solid #ef4444; padding: 20px; border-radius: 8px; }
          h1 { color: #dc2626; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>Missing Authorization Code</h1>
          <p>No authorization code was provided.</p>
          <p><a href="/api/oauth/google">Try again</a></p>
        </div>
      </body>
      </html>
    `);
  }

  try {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>OAuth Error</title>
          <style>
            body { font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { background: #fee2e2; border: 1px solid #ef4444; padding: 20px; border-radius: 8px; }
            h1 { color: #dc2626; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>No Refresh Token</h1>
            <p>Google did not return a refresh token. This can happen if you've already authorized this app.</p>
            <p>Go to <a href="https://myaccount.google.com/permissions" target="_blank">Google Account Permissions</a> and revoke access to this app, then try again.</p>
            <p><a href="/api/oauth/google">Try again</a></p>
          </div>
        </body>
        </html>
      `);
    }

    // Success! Show the refresh token to be added to .env
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Success</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 700px; margin: 50px auto; padding: 20px; }
          .success { background: #dcfce7; border: 1px solid #22c55e; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .token-box { background: #1e293b; color: #e2e8f0; padding: 15px; border-radius: 8px; font-family: monospace; word-break: break-all; }
          .instructions { background: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; }
          h1 { color: #16a34a; }
          code { background: #e2e8f0; padding: 2px 6px; border-radius: 4px; }
          .copy-btn {
            background: #3b82f6; color: white; border: none; padding: 8px 16px;
            border-radius: 4px; cursor: pointer; margin-top: 10px;
          }
          .copy-btn:hover { background: #2563eb; }
        </style>
      </head>
      <body>
        <div class="success">
          <h1>Google Calendar Connected!</h1>
          <p>You've successfully authenticated with Google Calendar.</p>
        </div>

        <h2>Your Refresh Token:</h2>
        <div class="token-box" id="token">${tokens.refresh_token}</div>
        <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('token').innerText); this.innerText='Copied!';">Copy Token</button>

        <div class="instructions" style="margin-top: 20px;">
          <h3>Next Steps:</h3>
          <ol>
            <li>Copy the refresh token above</li>
            <li>Update your <code>.env</code> file:</li>
          </ol>
          <div class="token-box">GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}</div>
          <ol start="3">
            <li>Restart the hub server: <code>bun run hub</code></li>
            <li>Trigger a sync: <code>curl http://localhost:3000/api/calendar/sync</code></li>
          </ol>
        </div>

        <p style="margin-top: 20px; color: #64748b;">
          Access Token (expires in ~1 hour): ${tokens.access_token?.substring(0, 50)}...
        </p>
      </body>
      </html>
    `);
  } catch (error: any) {
    console.error('[OAuth] Token exchange failed:', error);
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>OAuth Error</title>
        <style>
          body { font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { background: #fee2e2; border: 1px solid #ef4444; padding: 20px; border-radius: 8px; }
          h1 { color: #dc2626; }
          pre { background: #1e293b; color: #e2e8f0; padding: 15px; border-radius: 8px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>Token Exchange Failed</h1>
          <p>Failed to exchange authorization code for tokens.</p>
          <pre>${error.message}</pre>
          <p><a href="/api/oauth/google">Try again</a></p>
        </div>
      </body>
      </html>
    `);
  }
});

/**
 * GET /api/oauth/status
 * Check OAuth configuration status
 */
oauthRouter.get('/status', async (c) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/oauth/google/callback';

  return c.json({
    success: true,
    data: {
      google: {
        clientIdSet: !!clientId,
        clientSecretSet: !!clientSecret,
        refreshTokenSet: !!refreshToken,
        redirectUri,
        authUrl: clientId && clientSecret ? '/api/oauth/google' : null,
      },
    },
  });
});

export { oauthRouter };
