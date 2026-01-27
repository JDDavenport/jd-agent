/**
 * Quick test to verify Canvas API is working
 */

import { canvasIntegration } from '../src/integrations/canvas';

async function testCanvasAPI() {
  console.log('🧪 Testing Canvas API connection...\n');

  if (!canvasIntegration.isConfigured()) {
    console.log('❌ Canvas is not configured');
    console.log('   Check .env file for CANVAS_TOKEN and CANVAS_BASE_URL\n');
    process.exit(1);
  }

  console.log('✅ Canvas API is configured\n');

  try {
    // Test by fetching courses
    console.log('📚 Fetching courses from Canvas API...\n');
    const result = await canvasIntegration.fullSync();

    console.log('✅ Canvas API is working!\n');
    console.log('Results:');
    console.log(`  - Assignments synced: ${result.assignments}`);
    console.log(`  - Announcements synced: ${result.announcements}`);
    console.log(`  - Newly published courses: ${result.newlyPublished.length}`);

    if (result.newlyPublished.length > 0) {
      console.log('\n📚 Newly published courses:');
      result.newlyPublished.forEach(course => {
        console.log(`  - ${course}`);
      });
    }

    console.log('\n🎉 Canvas API integration is fully functional!');
    console.log('   You can proceed with Phase 0 testing.\n');

  } catch (error) {
    console.error('❌ Canvas API test failed:', error);
    console.log('\nTroubleshooting:');
    console.log('  1. Check CANVAS_TOKEN in .env file');
    console.log('  2. Check CANVAS_BASE_URL in .env file');
    console.log('  3. Verify token hasn\'t expired\n');
    process.exit(1);
  }
}

testCanvasAPI()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
