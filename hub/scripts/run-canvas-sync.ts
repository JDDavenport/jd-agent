import { canvasIntegration } from '../src/integrations/canvas';

async function main() {
  console.log('Running Canvas sync...');
  try {
    const result = await canvasIntegration.fullSync();
    console.log('Sync complete:', result);
  } catch (error) {
    console.error('Sync failed:', error);
  }
  process.exit(0);
}

main();
