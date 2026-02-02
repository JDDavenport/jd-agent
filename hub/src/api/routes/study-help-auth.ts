import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { studyHelpAuthService } from '../../services/study-help-auth-service';

const studyHelpAuthRouter = new Hono();

// Cookie configuration
const COOKIE_NAME = 'study_help_session';
// For cross-origin cookies (frontend on studyaide.app, backend on railway.app),
// we need sameSite: 'none' and secure: true
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true, // Required for sameSite: 'none'
  sameSite: 'none' as const, // Allow cross-site cookies
  path: '/',
  maxAge: 30 * 24 * 60 * 60, // 30 days
};

/**
 * POST /api/study-help/auth/signup
 * Create a new user account
 */
studyHelpAuthRouter.post('/signup', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name, institutionId } = body;

    if (!email || !password) {
      return c.json(
        {
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'Email and password are required' },
        },
        400
      );
    }

    const result = await studyHelpAuthService.signup({
      email,
      password,
      name,
      institutionId,
    });

    // Set session cookie
    setCookie(c, COOKIE_NAME, result.sessionToken, {
      ...COOKIE_OPTIONS,
      expires: result.expiresAt,
    });

    return c.json({
      success: true,
      data: {
        user: result.user,
        expiresAt: result.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Signup failed';
    console.error('[Auth] Signup error:', message);

    const statusCode = message.includes('already exists') ? 409 : 400;
    return c.json(
      {
        success: false,
        error: { code: 'SIGNUP_FAILED', message },
      },
      statusCode
    );
  }
});

/**
 * POST /api/study-help/auth/login
 * Login with email and password
 */
studyHelpAuthRouter.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json(
        {
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'Email and password are required' },
        },
        400
      );
    }

    const result = await studyHelpAuthService.login({ email, password });

    // Set session cookie
    setCookie(c, COOKIE_NAME, result.sessionToken, {
      ...COOKIE_OPTIONS,
      expires: result.expiresAt,
    });

    return c.json({
      success: true,
      data: {
        user: result.user,
        expiresAt: result.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    console.error('[Auth] Login error:', message);

    return c.json(
      {
        success: false,
        error: { code: 'LOGIN_FAILED', message },
      },
      401
    );
  }
});

/**
 * POST /api/study-help/auth/logout
 * Logout and invalidate session
 */
studyHelpAuthRouter.post('/logout', async (c) => {
  try {
    const sessionToken = getCookie(c, COOKIE_NAME);

    if (sessionToken) {
      await studyHelpAuthService.logout(sessionToken);
    }

    // Clear the cookie
    deleteCookie(c, COOKIE_NAME, { path: '/' });

    return c.json({
      success: true,
      data: { message: 'Logged out successfully' },
    });
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    // Still clear cookie even if logout fails
    deleteCookie(c, COOKIE_NAME, { path: '/' });
    return c.json({ success: true, data: { message: 'Logged out' } });
  }
});

/**
 * GET /api/study-help/auth/me
 * Get current authenticated user
 */
studyHelpAuthRouter.get('/me', async (c) => {
  try {
    const sessionToken = getCookie(c, COOKIE_NAME);

    if (!sessionToken) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_AUTHENTICATED', message: 'No session found' },
        },
        401
      );
    }

    const user = await studyHelpAuthService.validateSession(sessionToken);

    if (!user) {
      // Clear invalid cookie
      deleteCookie(c, COOKIE_NAME, { path: '/' });
      return c.json(
        {
          success: false,
          error: { code: 'SESSION_EXPIRED', message: 'Session expired or invalid' },
        },
        401
      );
    }

    return c.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('[Auth] Get user error:', error);
    return c.json(
      {
        success: false,
        error: { code: 'AUTH_ERROR', message: 'Failed to get user' },
      },
      500
    );
  }
});

/**
 * POST /api/study-help/auth/verify-email
 * Verify email with token
 */
studyHelpAuthRouter.post('/verify-email', async (c) => {
  try {
    const body = await c.req.json();
    const { token } = body;

    if (!token) {
      return c.json(
        {
          success: false,
          error: { code: 'MISSING_TOKEN', message: 'Verification token required' },
        },
        400
      );
    }

    const success = await studyHelpAuthService.verifyEmail(token);

    if (!success) {
      return c.json(
        {
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Invalid or expired verification token' },
        },
        400
      );
    }

    return c.json({
      success: true,
      data: { message: 'Email verified successfully' },
    });
  } catch (error) {
    console.error('[Auth] Email verification error:', error);
    return c.json(
      {
        success: false,
        error: { code: 'VERIFICATION_ERROR', message: 'Email verification failed' },
      },
      500
    );
  }
});

/**
 * POST /api/study-help/auth/forgot-password
 * Request password reset email
 */
studyHelpAuthRouter.post('/forgot-password', async (c) => {
  try {
    const body = await c.req.json();
    const { email } = body;

    if (!email) {
      return c.json(
        {
          success: false,
          error: { code: 'MISSING_EMAIL', message: 'Email is required' },
        },
        400
      );
    }

    const resetToken = await studyHelpAuthService.requestPasswordReset(email);

    // TODO: Send email with reset link
    // For now, log token for development
    if (resetToken) {
      console.log(`[Auth] Password reset token for ${email}: ${resetToken}`);
    }

    // Always return success to not reveal if email exists
    return c.json({
      success: true,
      data: { message: 'If an account exists with this email, a reset link has been sent' },
    });
  } catch (error) {
    console.error('[Auth] Forgot password error:', error);
    return c.json({
      success: true,
      data: { message: 'If an account exists with this email, a reset link has been sent' },
    });
  }
});

/**
 * POST /api/study-help/auth/reset-password
 * Reset password with token
 */
studyHelpAuthRouter.post('/reset-password', async (c) => {
  try {
    const body = await c.req.json();
    const { token, password } = body;

    if (!token || !password) {
      return c.json(
        {
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'Token and new password are required' },
        },
        400
      );
    }

    const success = await studyHelpAuthService.resetPassword(token, password);

    if (!success) {
      return c.json(
        {
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Invalid or expired reset token' },
        },
        400
      );
    }

    return c.json({
      success: true,
      data: { message: 'Password reset successfully. Please log in with your new password.' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Password reset failed';
    return c.json(
      {
        success: false,
        error: { code: 'RESET_FAILED', message },
      },
      400
    );
  }
});

/**
 * POST /api/study-help/auth/change-password
 * Change password when logged in
 */
studyHelpAuthRouter.post('/change-password', async (c) => {
  try {
    const sessionToken = getCookie(c, COOKIE_NAME);

    if (!sessionToken) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_AUTHENTICATED', message: 'Must be logged in' },
        },
        401
      );
    }

    const user = await studyHelpAuthService.validateSession(sessionToken);
    if (!user) {
      return c.json(
        {
          success: false,
          error: { code: 'SESSION_EXPIRED', message: 'Session expired' },
        },
        401
      );
    }

    const body = await c.req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return c.json(
        {
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'Current and new password are required' },
        },
        400
      );
    }

    await studyHelpAuthService.changePassword(user.id, currentPassword, newPassword);

    return c.json({
      success: true,
      data: { message: 'Password changed successfully' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Password change failed';
    return c.json(
      {
        success: false,
        error: { code: 'CHANGE_PASSWORD_FAILED', message },
      },
      400
    );
  }
});

/**
 * GET /api/study-help/auth/institutions
 * Get list of supported institutions
 */
studyHelpAuthRouter.get('/institutions', async (c) => {
  try {
    const institutions = await studyHelpAuthService.getInstitutions();

    return c.json({
      success: true,
      data: { institutions },
    });
  } catch (error) {
    console.error('[Auth] Get institutions error:', error);
    return c.json(
      {
        success: false,
        error: { code: 'FETCH_ERROR', message: 'Failed to get institutions' },
      },
      500
    );
  }
});

export { studyHelpAuthRouter };
