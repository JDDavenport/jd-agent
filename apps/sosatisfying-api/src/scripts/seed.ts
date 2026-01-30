import { db } from '../db/client';
import { sosGroups, sosPosts } from '../db/schema';

const seedGroups = [
  { name: 'oddly-satisfying', displayTitle: 'Oddly Satisfying', category: 'Oddly Satisfying' },
  { name: 'perfect-fits', displayTitle: 'Perfect Fits', category: 'Perfect Fits' },
  { name: 'craftsmanship', displayTitle: 'Craftsmanship', category: 'Craftsmanship' },
  { name: 'clean-and-organized', displayTitle: 'Clean & Organized', category: 'Clean & Organized' },
];

const seedPosts = [
  {
    title: 'Glassblower nails the final polish',
    contentType: 'link',
    contentUrl: 'https://example.com/video/1',
  },
  {
    title: 'Perfectly aligned drawer organizers',
    contentType: 'text',
    contentText: 'Sometimes the simplest things feel the most satisfying.',
  },
  {
    title: 'Restoration timelapse with zero waste',
    contentType: 'link',
    contentUrl: 'https://example.com/video/2',
  },
];

const run = async () => {
  console.log('[Seed] Creating groups...');
  const existingGroups = await db.select().from(sosGroups);
  if (existingGroups.length === 0) {
    await db.insert(sosGroups).values(seedGroups);
  }

  const [firstGroup] = await db.select().from(sosGroups).limit(1);
  if (!firstGroup) {
    console.log('[Seed] No groups available, skipping posts.');
    return;
  }

  const existingPosts = await db.select().from(sosPosts);
  if (existingPosts.length === 0) {
    await db.insert(sosPosts).values(
      seedPosts.map((post) => ({
        ...post,
        groupId: firstGroup.id,
      }))
    );
  }

  console.log('[Seed] Done.');
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Seed] Failed:', error);
    process.exit(1);
  });
