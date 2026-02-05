/**
 * Study Help Authentication Routes
 * Handles user registration, login, logout, and Canvas token management
 */

import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { db } from '../../db/client';
import { studyHelpUsers, studyHelpSessions, studyHelpInstitutions } from '../../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';

const studyHelpAuthRouter = new Hono();

const COOKIE_NAME = 'study_help_session';
const SESSION_DURATION_DAYS = 30;
const ENCRYPTION_KEY = process.env.STUDY_HELP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || 'default-key-change-me-32-chars!!';

// ============================================
// Crypto helpers
// ============================================

function hashPassword(password: string): string {
  // Simple hash for MVP - consider bcrypt for production
  return createHash('sha256').update(password + 'study-help-salt').digest('hex');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function encryptToken(plainToken: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plainToken, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptToken(encryptedData: string): string | null {
  try {
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    
    if (!ivHex || !authTagHex || !encrypted) return null;
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch {
    return null;
  }
}

function getDeviceType(userAgent: string | undefined): string {
  if (!userAgent) return 'unknown';
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod/.test(ua)) {
    return /ipad|tablet/.test(ua) ? 'tablet' : 'mobile';
  }
  return 'desktop';
}

// ============================================
// Auth helpers (exported)
// ============================================

export async function getUserFromSession(sessionToken: string | undefined) {
  if (!sessionToken) return null;

  const tokenHash = hashToken(sessionToken);

  const [session] = await db
    .select()
    .from(studyHelpSessions)
    .where(
      and(
        eq(studyHelpSessions.tokenHash, tokenHash),
        gt(studyHelpSessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!session) return null;

  // Update last active
  await db
    .update(studyHelpSessions)
    .set({ lastActiveAt: new Date() })
    .where(eq(studyHelpSessions.id, session.id));

  const [user] = await db
    .select()
    .from(studyHelpUsers)
    .where(eq(studyHelpUsers.id, session.userId))
    .limit(1);

  return user?.isActive ? user : null;
}

export function getDecryptedCanvasToken(user: { canvasAccessTokenEncrypted: string | null }): string | null {
  if (!user.canvasAccessTokenEncrypted) return null;
  return decryptToken(user.canvasAccessTokenEncrypted);
}

export async function getInstitutionForUser(user: { institutionId: string | null }) {
  if (!user.institutionId) return null;
  
  const [institution] = await db
    .select()
    .from(studyHelpInstitutions)
    .where(eq(studyHelpInstitutions.id, user.institutionId))
    .limit(1);
  
  return institution;
}

// ============================================
// Routes
// ============================================

/**
 * POST /api/study-help/auth/register
 * Create a new user account
 */
studyHelpAuthRouter.post('/register', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name, institutionId } = body;

    if (!email || !password) {
      return c.json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Email and password are required' },
      }, 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: 'Please enter a valid email address' },
      }, 400);
    }

    // Validate password strength
    if (password.length < 8) {
      return c.json({
        success: false,
        error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' },
      }, 400);
    }

    // Check if email already exists
    const [existing] = await db
      .select()
      .from(studyHelpUsers)
      .where(eq(studyHelpUsers.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      return c.json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' },
      }, 409);
    }

    // Validate institution if provided
    if (institutionId) {
      const [institution] = await db
        .select()
        .from(studyHelpInstitutions)
        .where(eq(studyHelpInstitutions.id, institutionId))
        .limit(1);
      
      if (!institution || !institution.enabled) {
        return c.json({
          success: false,
          error: { code: 'INVALID_INSTITUTION', message: 'Selected school is not available' },
        }, 400);
      }
    }

    // Create user
    const [user] = await db
      .insert(studyHelpUsers)
      .values({
        email: email.toLowerCase(),
        passwordHash: hashPassword(password),
        name: name || null,
        institutionId: institutionId || null,
      })
      .returning();

    // Create session
    const sessionToken = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

    await db.insert(studyHelpSessions).values({
      userId: user.id,
      tokenHash: hashToken(sessionToken),
      userAgent: c.req.header('user-agent') || null,
      ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || null,
      deviceType: getDeviceType(c.req.header('user-agent')),
      expiresAt,
    });

    // Set cookie
    setCookie(c, COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    });

    return c.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          canvasConnected: false,
        },
      },
    });
  } catch (error) {
    console.error('[StudyHelp Auth] Register error:', error);
    return c.json({
      success: false,
      error: { code: 'REGISTER_ERROR', message: 'Failed to create account' },
    }, 500);
  }
});

/**
 * POST /api/study-help/auth/login
 * Authenticate user and create session
 */
studyHelpAuthRouter.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Email and password are required' },
      }, 400);
    }

    // Find user
    const [user] = await db
      .select()
      .from(studyHelpUsers)
      .where(eq(studyHelpUsers.email, email.toLowerCase()))
      .limit(1);

    if (!user || user.passwordHash !== hashPassword(password)) {
      return c.json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
      }, 401);
    }

    if (!user.isActive) {
      return c.json({
        success: false,
        error: { code: 'ACCOUNT_DISABLED', message: 'This account has been disabled' },
      }, 403);
    }

    // Create session
    const sessionToken = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

    await db.insert(studyHelpSessions).values({
      userId: user.id,
      tokenHash: hashToken(sessionToken),
      userAgent: c.req.header('user-agent') || null,
      ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || null,
      deviceType: getDeviceType(c.req.header('user-agent')),
      expiresAt,
    });

    // Update last login
    await db
      .update(studyHelpUsers)
      .set({ lastLoginAt: new Date() })
      .where(eq(studyHelpUsers.id, user.id));

    // Set cookie
    setCookie(c, COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    });

    // Get institution info if linked
    const institution = await getInstitutionForUser(user);

    return c.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          canvasConnected: !!user.canvasAccessTokenEncrypted,
          institution: institution ? {
            id: institution.id,
            name: institution.name,
            shortName: institution.shortName,
            canvasBaseUrl: institution.canvasBaseUrl,
          } : null,
        },
      },
    });
  } catch (error) {
    console.error('[StudyHelp Auth] Login error:', error);
    return c.json({
      success: false,
      error: { code: 'LOGIN_ERROR', message: 'Failed to log in' },
    }, 500);
  }
});

/**
 * POST /api/study-help/auth/logout
 * End user session
 */
studyHelpAuthRouter.post('/logout', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);

  if (sessionToken) {
    const tokenHash = hashToken(sessionToken);
    await db
      .delete(studyHelpSessions)
      .where(eq(studyHelpSessions.tokenHash, tokenHash));
  }

  deleteCookie(c, COOKIE_NAME, { path: '/' });

  return c.json({
    success: true,
    data: { message: 'Logged out successfully' },
  });
});

/**
 * GET /api/study-help/auth/me
 * Get current user info
 */
studyHelpAuthRouter.get('/me', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json({
      success: false,
      error: { code: 'NOT_AUTHENTICATED', message: 'Not logged in' },
    }, 401);
  }

  const institution = await getInstitutionForUser(user);

  return c.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        canvasConnected: !!user.canvasAccessTokenEncrypted,
        canvasUserId: user.canvasUserId,
        lastSyncAt: user.lastSyncAt,
        institution: institution ? {
          id: institution.id,
          name: institution.name,
          shortName: institution.shortName,
          canvasBaseUrl: institution.canvasBaseUrl,
        } : null,
      },
    },
  });
});

/**
 * POST /api/study-help/auth/canvas/connect
 * Connect Canvas account with personal access token
 * 
 * For MVP, we use personal access tokens. Users can:
 * 1. Provide their institution's Canvas URL directly, OR
 * 2. Select an institution that's already configured
 */
studyHelpAuthRouter.post('/canvas/connect', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json({
      success: false,
      error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' },
    }, 401);
  }

  try {
    const body = await c.req.json();
    const { canvasToken, canvasBaseUrl, institutionId } = body;

    if (!canvasToken) {
      return c.json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Canvas access token is required' },
      }, 400);
    }

    // Determine Canvas URL: from institution or direct input
    let finalCanvasUrl = canvasBaseUrl;
    let finalInstitutionId = institutionId || user.institutionId;
    
    if (finalInstitutionId) {
      const [institution] = await db
        .select()
        .from(studyHelpInstitutions)
        .where(eq(studyHelpInstitutions.id, finalInstitutionId))
        .limit(1);
      
      if (institution?.canvasBaseUrl) {
        finalCanvasUrl = institution.canvasBaseUrl;
      }
    }

    if (!finalCanvasUrl) {
      return c.json({
        success: false,
        error: { code: 'MISSING_CANVAS_URL', message: 'Canvas URL is required. Select a school or provide the URL.' },
      }, 400);
    }

    // Normalize URL
    let normalizedUrl = finalCanvasUrl.trim();
    if (!normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    normalizedUrl = normalizedUrl.replace(/\/$/, '');

    // Test the token by fetching user profile
    try {
      const testResponse = await fetch(`${normalizedUrl}/api/v1/users/self`, {
        headers: {
          'Authorization': `Bearer ${canvasToken}`,
        },
      });

      if (!testResponse.ok) {
        return c.json({
          success: false,
          error: { 
            code: 'INVALID_TOKEN', 
            message: 'Could not connect to Canvas. Please check your token.' 
          },
        }, 400);
      }

      const canvasUser = await testResponse.json();
      console.log(`[StudyHelp] Canvas connected for user ${user.email}: ${canvasUser.name} (${canvasUser.id})`);

      // Encrypt and store the token
      const encryptedToken = encryptToken(canvasToken);

      await db
        .update(studyHelpUsers)
        .set({
          canvasAccessTokenEncrypted: encryptedToken,
          canvasUserId: String(canvasUser.id),
          institutionId: finalInstitutionId || user.institutionId,
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(studyHelpUsers.id, user.id));

      return c.json({
        success: true,
        data: {
          message: 'Canvas connected successfully',
          canvasUser: {
            id: canvasUser.id,
            name: canvasUser.name,
          },
        },
      });
    } catch (error) {
      return c.json({
        success: false,
        error: { 
          code: 'CONNECTION_ERROR', 
          message: 'Could not reach Canvas. Please check the URL.' 
        },
      }, 400);
    }
  } catch (error) {
    console.error('[StudyHelp Auth] Canvas connect error:', error);
    return c.json({
      success: false,
      error: { code: 'CONNECT_ERROR', message: 'Failed to connect Canvas' },
    }, 500);
  }
});

/**
 * DELETE /api/study-help/auth/canvas/disconnect
 * Disconnect Canvas account
 */
studyHelpAuthRouter.delete('/canvas/disconnect', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json({
      success: false,
      error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' },
    }, 401);
  }

  try {
    await db
      .update(studyHelpUsers)
      .set({
        canvasAccessTokenEncrypted: null,
        canvasRefreshTokenEncrypted: null,
        canvasTokenExpiresAt: null,
        canvasUserId: null,
        updatedAt: new Date(),
      })
      .where(eq(studyHelpUsers.id, user.id));

    return c.json({
      success: true,
      data: { message: 'Canvas disconnected' },
    });
  } catch (error) {
    console.error('[StudyHelp Auth] Canvas disconnect error:', error);
    return c.json({
      success: false,
      error: { code: 'DISCONNECT_ERROR', message: 'Failed to disconnect Canvas' },
    }, 500);
  }
});

/**
 * GET /api/study-help/auth/institutions
 * Get list of available institutions (schools)
 */
studyHelpAuthRouter.get('/institutions', async (c) => {
  try {
    const institutions = await db
      .select({
        id: studyHelpInstitutions.id,
        name: studyHelpInstitutions.name,
        shortName: studyHelpInstitutions.shortName,
        domain: studyHelpInstitutions.domain,
        logoUrl: studyHelpInstitutions.logoUrl,
        canvasBaseUrl: studyHelpInstitutions.canvasBaseUrl,
      })
      .from(studyHelpInstitutions)
      .where(eq(studyHelpInstitutions.enabled, true));

    return c.json({
      success: true,
      data: { institutions },
    });
  } catch (error) {
    console.error('[StudyHelp Auth] Institutions error:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch institutions' },
    }, 500);
  }
});

/**
 * GET /api/study-help/auth/canvas/instructions
 * Get instructions for generating a Canvas personal access token
 */
studyHelpAuthRouter.get('/canvas/instructions', async (c) => {
  return c.json({
    success: true,
    data: {
      title: 'How to Connect Your Canvas Account',
      steps: [
        {
          step: 1,
          title: 'Log into Canvas',
          description: 'Go to your school\'s Canvas website and log in with your credentials.',
        },
        {
          step: 2,
          title: 'Go to Account Settings',
          description: 'Click on "Account" in the left sidebar, then click "Settings".',
        },
        {
          step: 3,
          title: 'Create Access Token',
          description: 'Scroll down to "Approved Integrations" and click "+ New Access Token".',
        },
        {
          step: 4,
          title: 'Name Your Token',
          description: 'Enter a purpose like "Study Help App" and optionally set an expiration date.',
        },
        {
          step: 5,
          title: 'Copy Token',
          description: 'Click "Generate Token" and copy the token that appears. You won\'t be able to see it again!',
        },
        {
          step: 6,
          title: 'Paste Here',
          description: 'Paste your token in the Study Help app to complete the connection.',
        },
      ],
      tips: [
        'Your token is stored securely with encryption',
        'You can revoke the token anytime from Canvas settings',
        'If your token expires, just create a new one',
      ],
    },
  });
});

export { studyHelpAuthRouter };
