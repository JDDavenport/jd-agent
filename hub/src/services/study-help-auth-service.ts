import { db } from '../db/client';
import { studyHelpUsers, studyHelpSessions, studyHelpInstitutions } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';

// Password hashing using Bun's native crypto
async function hashPassword(password: string): Promise<string> {
  return await Bun.password.hash(password, {
    algorithm: 'argon2id',
    memoryCost: 65536, // 64 MB
    timeCost: 3,
  });
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await Bun.password.verify(password, hash);
}

// Token hashing (for session tokens)
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Generate secure random token
function generateToken(bytes: number = 32): string {
  return randomBytes(bytes).toString('hex');
}

// Types
export interface SignupInput {
  email: string;
  password: string;
  name?: string;
  institutionId?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
    institutionId: string | null;
    canvasConnected: boolean;
  };
  sessionToken: string;
  expiresAt: Date;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  institutionId: string | null;
  institutionName: string | null;
  canvasConnected: boolean;
  canvasUserId: string | null;
  lastLoginAt: Date | null;
  lastSyncAt: Date | null;
  createdAt: Date;
}

class StudyHelpAuthService {
  private sessionDurationDays = 30; // Sessions last 30 days

  /**
   * Create a new user account
   */
  async signup(input: SignupInput): Promise<AuthResult> {
    const { email, password, name, institutionId } = input;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Check if email already exists
    const existing = await db
      .select({ id: studyHelpUsers.id })
      .from(studyHelpUsers)
      .where(eq(studyHelpUsers.email, email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      throw new Error('An account with this email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate email verification token
    const emailVerificationToken = generateToken();
    const emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const [user] = await db
      .insert(studyHelpUsers)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        name: name || null,
        institutionId: institutionId || null,
        emailVerificationToken,
        emailVerificationExpiresAt,
      })
      .returning();

    console.log(`[Auth] User created: ${user.id} (${email})`);

    // Create session
    const session = await this.createSession(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        institutionId: user.institutionId,
        canvasConnected: !!user.canvasAccessTokenEncrypted,
      },
      sessionToken: session.token,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Login with email and password
   */
  async login(input: LoginInput): Promise<AuthResult> {
    const { email, password } = input;

    // Find user
    const [user] = await db
      .select()
      .from(studyHelpUsers)
      .where(eq(studyHelpUsers.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      throw new Error('Account is disabled');
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    await db
      .update(studyHelpUsers)
      .set({ lastLoginAt: new Date() })
      .where(eq(studyHelpUsers.id, user.id));

    console.log(`[Auth] User logged in: ${user.id} (${email})`);

    // Create session
    const session = await this.createSession(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        institutionId: user.institutionId,
        canvasConnected: !!user.canvasAccessTokenEncrypted,
      },
      sessionToken: session.token,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Logout - invalidate session
   */
  async logout(sessionToken: string): Promise<void> {
    const tokenHash = hashToken(sessionToken);

    await db
      .delete(studyHelpSessions)
      .where(eq(studyHelpSessions.tokenHash, tokenHash));

    console.log('[Auth] Session invalidated');
  }

  /**
   * Validate session token and return user
   */
  async validateSession(sessionToken: string): Promise<UserProfile | null> {
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

    if (!session) {
      return null;
    }

    // Get user with institution info
    const [user] = await db
      .select({
        id: studyHelpUsers.id,
        email: studyHelpUsers.email,
        name: studyHelpUsers.name,
        emailVerified: studyHelpUsers.emailVerified,
        institutionId: studyHelpUsers.institutionId,
        canvasAccessTokenEncrypted: studyHelpUsers.canvasAccessTokenEncrypted,
        canvasUserId: studyHelpUsers.canvasUserId,
        lastLoginAt: studyHelpUsers.lastLoginAt,
        lastSyncAt: studyHelpUsers.lastSyncAt,
        createdAt: studyHelpUsers.createdAt,
        isActive: studyHelpUsers.isActive,
      })
      .from(studyHelpUsers)
      .where(eq(studyHelpUsers.id, session.userId))
      .limit(1);

    if (!user || !user.isActive) {
      return null;
    }

    // Get institution name if linked
    let institutionName: string | null = null;
    if (user.institutionId) {
      const [institution] = await db
        .select({ name: studyHelpInstitutions.name })
        .from(studyHelpInstitutions)
        .where(eq(studyHelpInstitutions.id, user.institutionId))
        .limit(1);
      institutionName = institution?.name || null;
    }

    // Update session last active
    await db
      .update(studyHelpSessions)
      .set({ lastActiveAt: new Date() })
      .where(eq(studyHelpSessions.id, session.id));

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      institutionId: user.institutionId,
      institutionName,
      canvasConnected: !!user.canvasAccessTokenEncrypted,
      canvasUserId: user.canvasUserId,
      lastLoginAt: user.lastLoginAt,
      lastSyncAt: user.lastSyncAt,
      createdAt: user.createdAt,
    };
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<boolean> {
    const [user] = await db
      .select()
      .from(studyHelpUsers)
      .where(
        and(
          eq(studyHelpUsers.emailVerificationToken, token),
          gt(studyHelpUsers.emailVerificationExpiresAt, new Date())
        )
      )
      .limit(1);

    if (!user) {
      return false;
    }

    await db
      .update(studyHelpUsers)
      .set({
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      })
      .where(eq(studyHelpUsers.id, user.id));

    console.log(`[Auth] Email verified: ${user.id} (${user.email})`);
    return true;
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<string | null> {
    const [user] = await db
      .select({ id: studyHelpUsers.id })
      .from(studyHelpUsers)
      .where(eq(studyHelpUsers.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      // Don't reveal if email exists
      return null;
    }

    const resetToken = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db
      .update(studyHelpUsers)
      .set({
        passwordResetToken: resetToken,
        passwordResetExpiresAt: expiresAt,
      })
      .where(eq(studyHelpUsers.id, user.id));

    console.log(`[Auth] Password reset requested for: ${email}`);
    return resetToken;
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const [user] = await db
      .select()
      .from(studyHelpUsers)
      .where(
        and(
          eq(studyHelpUsers.passwordResetToken, token),
          gt(studyHelpUsers.passwordResetExpiresAt, new Date())
        )
      )
      .limit(1);

    if (!user) {
      return false;
    }

    const passwordHash = await hashPassword(newPassword);

    // Update password and clear reset token
    await db
      .update(studyHelpUsers)
      .set({
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      })
      .where(eq(studyHelpUsers.id, user.id));

    // Invalidate all sessions for security
    await db
      .delete(studyHelpSessions)
      .where(eq(studyHelpSessions.userId, user.id));

    console.log(`[Auth] Password reset for: ${user.id} (${user.email})`);
    return true;
  }

  /**
   * Change password (when logged in)
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const [user] = await db
      .select({ passwordHash: studyHelpUsers.passwordHash })
      .from(studyHelpUsers)
      .where(eq(studyHelpUsers.id, userId))
      .limit(1);

    if (!user) {
      throw new Error('User not found');
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      throw new Error('Current password is incorrect');
    }

    const passwordHash = await hashPassword(newPassword);

    await db
      .update(studyHelpUsers)
      .set({ passwordHash })
      .where(eq(studyHelpUsers.id, userId));

    console.log(`[Auth] Password changed for: ${userId}`);
    return true;
  }

  /**
   * Get all institutions
   */
  async getInstitutions(): Promise<
    Array<{ id: string; name: string; domain: string; shortName: string | null }>
  > {
    return db
      .select({
        id: studyHelpInstitutions.id,
        name: studyHelpInstitutions.name,
        domain: studyHelpInstitutions.domain,
        shortName: studyHelpInstitutions.shortName,
      })
      .from(studyHelpInstitutions)
      .where(eq(studyHelpInstitutions.enabled, true));
  }

  /**
   * Create a session for a user
   */
  private async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(
      Date.now() + this.sessionDurationDays * 24 * 60 * 60 * 1000
    );

    // Detect device type from user agent
    let deviceType = 'desktop';
    if (userAgent) {
      if (/mobile/i.test(userAgent)) deviceType = 'mobile';
      else if (/tablet|ipad/i.test(userAgent)) deviceType = 'tablet';
    }

    await db.insert(studyHelpSessions).values({
      userId,
      tokenHash,
      expiresAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      deviceType,
    });

    return { token, expiresAt };
  }

  /**
   * Clean up expired sessions (call periodically)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await db
      .delete(studyHelpSessions)
      .where(gt(new Date(), studyHelpSessions.expiresAt))
      .returning({ id: studyHelpSessions.id });

    if (result.length > 0) {
      console.log(`[Auth] Cleaned up ${result.length} expired sessions`);
    }

    return result.length;
  }
}

export const studyHelpAuthService = new StudyHelpAuthService();
