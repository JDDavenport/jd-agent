/**
 * Test Voice Profile System
 *
 * Tests voice profile creation, listing, and speaker mapping.
 */

import { voiceProfileService } from '../services/voice-profile-service';
import { db } from '../db/client';
import { transcripts, recordings, voiceProfiles, speakerMappings } from '../db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  Voice Profile System Test');
  console.log('='.repeat(60) + '\n');

  try {
    // Step 1: Create "self" profile
    console.log('[1/5] Creating self profile...');
    const selfProfile = await voiceProfileService.createSelfProfile('JD');
    console.log(`    Created: ${selfProfile.name} (${selfProfile.category})`);
    console.log(`    ID: ${selfProfile.id}`);

    // Step 2: Create additional profiles
    console.log('\n[2/5] Creating additional voice profiles...');

    const teacherProfile = await voiceProfileService.createProfile({
      name: 'Professor Smith',
      category: 'teacher',
      notes: 'MBA Finance professor',
    });
    console.log(`    Created: ${teacherProfile.name} (${teacherProfile.category})`);

    const classmateProfile = await voiceProfileService.createProfile({
      name: 'Student A',
      category: 'classmate',
    });
    console.log(`    Created: ${classmateProfile.name} (${classmateProfile.category})`);

    // Step 3: List profiles
    console.log('\n[3/5] Listing all profiles...');
    const allProfiles = await voiceProfileService.listProfiles();
    console.log(`    Total profiles: ${allProfiles.length}`);
    for (const p of allProfiles) {
      console.log(`      - ${p.name} (${p.category}) ${p.isActive ? '✓' : '✗'}`);
    }

    // Step 4: Test with existing transcript (if any)
    console.log('\n[4/5] Testing speaker mapping...');

    // Find a transcript with multiple speakers
    const [transcript] = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.speakerCount, 5))
      .limit(1);

    if (transcript) {
      console.log(`    Found transcript: ${transcript.id}`);
      console.log(`    Speaker count: ${transcript.speakerCount}`);

      // Initialize speaker mappings
      await voiceProfileService.initializeSpeakerMappings(transcript.id);
      console.log('    Initialized speaker mappings');

      // Assign speaker 0 to self
      const mapping = await voiceProfileService.assignSpeaker({
        transcriptId: transcript.id,
        deepgramSpeakerId: 0,
        voiceProfileId: selfProfile.id,
        confidence: 0.95,
      });
      console.log(`    Assigned speaker 0 -> ${selfProfile.name}`);

      // Get speaker mappings
      const speakerData = await voiceProfileService.getTranscriptSpeakers(transcript.id);
      if (speakerData) {
        console.log(`    Speaker mappings for transcript:`);
        for (const speaker of speakerData.speakers) {
          const profile = speaker.mapping?.voiceProfile;
          const name = profile ? profile.name : 'Unassigned';
          console.log(`      Speaker ${speaker.deepgramSpeakerId}: ${name}`);
        }
      }
    } else {
      console.log('    No multi-speaker transcript found, skipping mapping test');
    }

    // Step 5: Update and delete
    console.log('\n[5/5] Testing update and cleanup...');

    // Update a profile
    const updated = await voiceProfileService.updateProfile(classmateProfile.id, {
      name: 'Classmate John',
      notes: 'Met in MBA 501',
    });
    console.log(`    Updated: ${updated?.name}`);

    // Delete test profiles (keep self)
    await voiceProfileService.deleteProfile(teacherProfile.id);
    await voiceProfileService.deleteProfile(classmateProfile.id);
    console.log('    Deleted test profiles');

    // Final count
    const finalProfiles = await voiceProfileService.listProfiles();
    console.log(`    Final profile count: ${finalProfiles.length}`);

    console.log('\n' + '='.repeat(60));
    console.log('  Test Results');
    console.log('='.repeat(60));
    console.log('\n✅ Voice profile system working correctly!\n');

    console.log('Available endpoints:');
    console.log('  GET    /api/voice-profiles           - List all profiles');
    console.log('  GET    /api/voice-profiles/self      - Get/create self profile');
    console.log('  POST   /api/voice-profiles           - Create profile');
    console.log('  PATCH  /api/voice-profiles/:id       - Update profile');
    console.log('  DELETE /api/voice-profiles/:id       - Delete profile');
    console.log('  GET    /api/voice-profiles/transcripts/:id/speakers - Get speaker mappings');
    console.log('  POST   /api/voice-profiles/transcripts/:id/speakers/:speakerId - Assign speaker');
    console.log('');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
