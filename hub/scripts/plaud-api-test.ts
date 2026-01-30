/**
 * Plaud API Test - Test the API endpoints
 */

import { chromium } from 'playwright';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';

async function main() {
  console.log('Testing Plaud API...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: STORAGE_PATH,
  });

  const page = await context.newPage();

  // Navigate to get auth context
  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Get auth token from localStorage
  const token = await page.evaluate(() => {
    return localStorage.getItem('tokenstr');
  });

  console.log('Auth token:', token ? `${token.slice(0, 70)}...` : 'NOT FOUND');

  // Test the file list API
  console.log('\n=== Testing /file/simple/web API ===');

  const result = await page.evaluate(async (authToken) => {
    try {
      const response = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=100&is_trash=2&sort_by=start_time&is_desc=true', {
        method: 'GET',
        headers: {
          'Authorization': authToken || '',
          'Content-Type': 'application/json',
        }
      });

      return response.json();
    } catch (e) {
      return { error: String(e) };
    }
  }, token);

  console.log('Total files:', result.data_file_total);

  if (result.data_file_list && result.data_file_list.length > 0) {
    console.log(`\nFound ${result.data_file_list.length} recordings:`);
    for (const rec of result.data_file_list) {
      const duration = Math.round(rec.duration / 60000); // ms to minutes
      const size = Math.round(rec.filesize / 1024 / 1024 * 10) / 10; // bytes to MB
      console.log(`\n  [${rec.id.slice(0, 8)}] ${rec.filename}`);
      console.log(`    Duration: ${duration}min, Size: ${size}MB`);
      console.log(`    Date: ${new Date(rec.start_time).toLocaleDateString()}`);
    }

    // Test file detail API for first recording
    const firstFile = result.data_file_list[0];
    console.log('\n=== Testing /file/:id API ===');
    console.log('File ID:', firstFile.id);

    const detailResult = await page.evaluate(async ({ fileId, authToken }) => {
      try {
        const response = await fetch(`https://api.plaud.ai/file/${fileId}`, {
          headers: { 'Authorization': authToken || '' }
        });
        return response.json();
      } catch (e) {
        return { error: String(e) };
      }
    }, { fileId: firstFile.id, authToken: token });

    console.log('Detail response:', JSON.stringify(detailResult, null, 2).slice(0, 2000));

    // Try to find audio download URL
    console.log('\n=== Looking for audio URL ===');

    // Check /file/audio endpoint
    const audioResult = await page.evaluate(async ({ fileId, authToken }) => {
      try {
        const response = await fetch(`https://api.plaud.ai/file/${fileId}/audio`, {
          headers: { 'Authorization': authToken || '' }
        });
        return { status: response.status, data: await response.text().then(t => t.slice(0, 500)) };
      } catch (e) {
        return { error: String(e) };
      }
    }, { fileId: firstFile.id, authToken: token });

    console.log('/file/:id/audio:', audioResult);

    // Check /file/download endpoint
    const downloadResult = await page.evaluate(async ({ fileId, authToken }) => {
      try {
        const response = await fetch(`https://api.plaud.ai/file/${fileId}/download`, {
          headers: { 'Authorization': authToken || '' }
        });
        return { status: response.status, data: await response.text().then(t => t.slice(0, 500)) };
      } catch (e) {
        return { error: String(e) };
      }
    }, { fileId: firstFile.id, authToken: token });

    console.log('/file/:id/download:', downloadResult);

    // Check /file/ori endpoint
    const oriResult = await page.evaluate(async ({ fileId, authToken }) => {
      try {
        const response = await fetch(`https://api.plaud.ai/file/${fileId}/ori`, {
          headers: { 'Authorization': authToken || '' }
        });
        return { status: response.status, data: await response.text().then(t => t.slice(0, 500)) };
      } catch (e) {
        return { error: String(e) };
      }
    }, { fileId: firstFile.id, authToken: token });

    console.log('/file/:id/ori:', oriResult);
  }

  await browser.close();
  console.log('\nDone!');
}

main().catch(console.error);
