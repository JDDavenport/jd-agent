#!/usr/bin/env bun
/**
 * Setup BYU Institution for Study Help
 * 
 * Creates the BYU institution record and optionally migrates
 * the existing Canvas token for JD's account.
 * 
 * Usage:
 *   bun run scripts/setup-byu-institution.ts
 *   bun run scripts/setup-byu-institution.ts --migrate-jd
 */

import { db } from '../src/db/client';
import { studyHelpInstitutions, studyHelpUsers } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { createCipheriv, randomBytes, createHash } from 'crypto';

const ENCRYPTION_KEY = process.env.STUDY_HELP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || 'default-key-change-me-32-chars!!';

function encryptToken(plainToken: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plainToken, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'study-help-salt').digest('hex');
}

async function setupBYUInstitution() {
  console.log('Setting up BYU Institution...\n');

  // Check if BYU already exists
  const [existing] = await db
    .select()
    .from(studyHelpInstitutions)
    .where(eq(studyHelpInstitutions.shortName, 'BYU'))
    .limit(1);

  if (existing) {
    console.log('✅ BYU institution already exists:', existing.id);
    return existing;
  }

  // Create BYU institution
  const [byu] = await db
    .insert(studyHelpInstitutions)
    .values({
      name: 'Brigham Young University',
      shortName: 'BYU',
      domain: 'byu.edu',
      canvasBaseUrl: 'https://byu.instructure.com',
      logoUrl: 'https://www.byu.edu/images/logo.svg',
      enabled: true,
    })
    .returning();

  console.log('✅ Created BYU institution:', byu.id);
  console.log('   Canvas URL:', byu.canvasBaseUrl);
  return byu;
}

async function migrateJDAccount(institutionId: string) {
  console.log('\nMigrating JD account...\n');

  // Get Canvas token from environment
  const canvasToken = process.env.CANVAS_TOKEN;
  if (!canvasToken) {
    console.log('❌ CANVAS_TOKEN not found in environment. Skipping migration.');
    return;
  }

  const email = 'jddavenport46@gmail.com';
  const defaultPassword = 'changeme123'; // JD should change this

  // Check if JD account exists
  let [jd] = await db
    .select()
    .from(studyHelpUsers)
    .where(eq(studyHelpUsers.email, email))
    .limit(1);

  if (!jd) {
    // Create JD's account
    console.log('Creating JD account...');
    [jd] = await db
      .insert(studyHelpUsers)
      .values({
        email,
        passwordHash: hashPassword(defaultPassword),
        name: 'JD Davenport',
        institutionId,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        isActive: true,
      })
      .returning();
    console.log('✅ Created account for', email);
    console.log('   Default password: changeme123 (please change!)');
  } else {
    console.log('✅ Account already exists for', email);
  }

  // Encrypt and store Canvas token if not already set
  if (!jd.canvasAccessTokenEncrypted) {
    const encryptedToken = encryptToken(canvasToken);
    
    // Test the token first
    const testResponse = await fetch('https://byu.instructure.com/api/v1/users/self', {
      headers: { 'Authorization': `Bearer ${canvasToken}` },
    });

    if (!testResponse.ok) {
      console.log('❌ Canvas token is invalid or expired');
      return;
    }

    const canvasUser = await testResponse.json();
    console.log('✅ Canvas token verified for:', canvasUser.name);

    await db
      .update(studyHelpUsers)
      .set({
        canvasAccessTokenEncrypted: encryptedToken,
        canvasUserId: String(canvasUser.id),
        institutionId,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(studyHelpUsers.id, jd.id));

    console.log('✅ Canvas token migrated successfully');
  } else {
    console.log('✅ Canvas token already configured');
  }
}

async function main() {
  try {
    const byu = await setupBYUInstitution();

    // Check if --migrate-jd flag is passed
    if (process.argv.includes('--migrate-jd')) {
      await migrateJDAccount(byu.id);
    } else {
      console.log('\nTo migrate JD\'s existing Canvas token, run:');
      console.log('  bun run scripts/setup-byu-institution.ts --migrate-jd');
    }

    console.log('\n✅ Setup complete!');
    console.log('\nNext steps:');
    console.log('1. Start the hub: bun run dev');
    console.log('2. Log in to Study Help with your account');
    console.log('3. If not migrated, connect Canvas using a personal access token');
    console.log('4. Trigger a sync: POST /api/study-help/sync/trigger');

    process.exit(0);
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

main();
