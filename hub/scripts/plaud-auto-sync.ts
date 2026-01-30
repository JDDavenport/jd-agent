import { PlaudScraper } from '../src/services/plaud-scraper';

async function main() {
  console.log('Starting Plaud auto-sync...');
  
  const scraper = new PlaudScraper();
  
  if (!scraper.isConfigured()) {
    console.error('Plaud credentials not configured!');
    process.exit(1);
  }
  
  console.log('Credentials found, initializing browser...');
  await scraper.init();
  
  console.log('Attempting login...');
  const loggedIn = await scraper.login();
  
  if (!loggedIn) {
    console.error('Login failed!');
    await scraper.close();
    process.exit(1);
  }
  
  console.log('Login successful! Fetching recordings...');
  const result = await scraper.sync();
  
  console.log('Sync result:', JSON.stringify(result, null, 2));
  
  await scraper.close();
  console.log('Done!');
}

main().catch(console.error);
