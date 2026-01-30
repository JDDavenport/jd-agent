/**
 * Plaud Find Audio - Find the audio download URL
 */

import { chromium } from 'playwright';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';

async function main() {
  console.log('=== Finding Audio URL ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: STORAGE_PATH,
  });

  const page = await context.newPage();

  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const token = await page.evaluate(() => localStorage.getItem('tokenstr'));
  console.log('Token loaded');

  // Get file list
  const files = await page.evaluate(async (authToken) => {
    const response = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=5&is_trash=2&sort_by=start_time&is_desc=true', {
      headers: { 'Authorization': authToken || '' }
    });
    return response.json();
  }, token);

  // Use the Steve Jobs file which has transcript
  const file = files.data_file_list?.find((f: any) => f.filename.includes('Steve Jobs')) || files.data_file_list?.[0];
  console.log(`Testing with: ${file.filename} (${file.id})`);
  console.log(`File type: ${file.filetype}`);
  console.log(`Full name: ${file.fullname}\n`);

  // Try various audio endpoints
  console.log('=== Testing Audio Endpoints ===\n');

  const endpoints = [
    // POST endpoints
    { method: 'POST', url: 'https://api.plaud.ai/file/ori', body: { file_id: file.id } },
    { method: 'POST', url: 'https://api.plaud.ai/file/audio', body: { file_id: file.id } },
    { method: 'POST', url: 'https://api.plaud.ai/file/download', body: { file_id: file.id } },
    { method: 'POST', url: 'https://api.plaud.ai/file/stream', body: { file_id: file.id } },
    { method: 'POST', url: 'https://api.plaud.ai/file/media', body: { file_id: file.id } },
    { method: 'POST', url: 'https://api.plaud.ai/file/url', body: { file_id: file.id } },
    { method: 'POST', url: 'https://api.plaud.ai/file/presigned', body: { file_id: file.id } },
    { method: 'POST', url: 'https://api.plaud.ai/file/get', body: { file_id: file.id } },
    // GET with query params
    { method: 'GET', url: `https://api.plaud.ai/file/ori?file_id=${file.id}` },
    { method: 'GET', url: `https://api.plaud.ai/file/audio?file_id=${file.id}` },
    { method: 'GET', url: `https://api.plaud.ai/file/download?file_id=${file.id}` },
    { method: 'GET', url: `https://api.plaud.ai/file/presigned?file_id=${file.id}` },
  ];

  for (const ep of endpoints) {
    const result = await page.evaluate(async ({ endpoint, authToken }) => {
      try {
        const options: RequestInit = {
          method: endpoint.method,
          headers: {
            'Authorization': authToken || '',
            'Content-Type': 'application/json',
          },
        };
        if (endpoint.body) {
          options.body = JSON.stringify(endpoint.body);
        }
        const resp = await fetch(endpoint.url, options);
        return { status: resp.status, data: await resp.text() };
      } catch (e) {
        return { error: String(e) };
      }
    }, { endpoint: ep, authToken: token });

    const success = result.status === 200;
    const marker = success ? '✓' : '✗';
    console.log(`${marker} ${ep.method} ${ep.url.slice(0, 60)}`);

    if (success && result.data) {
      console.log(`  Response: ${result.data.slice(0, 300)}`);

      // Check if it contains a URL
      if (result.data.includes('s3') || result.data.includes('http')) {
        try {
          const json = JSON.parse(result.data);
          if (json.data?.url) {
            console.log(`  >>> FOUND URL: ${json.data.url.slice(0, 100)}...`);
          }
        } catch (e) {}
      }
    } else if (result.status !== 404 && result.status !== 405) {
      console.log(`  Status: ${result.status}, Response: ${result.data?.slice(0, 100)}`);
    }
  }

  // Also check the file detail for audio-related fields
  console.log('\n=== Checking File Detail for Audio Fields ===');

  const detail = await page.evaluate(async ({ fileId, authToken }) => {
    const resp = await fetch(`https://api.plaud.ai/file/detail/${fileId}`, {
      headers: { 'Authorization': authToken || '' }
    });
    return resp.json();
  }, { fileId: file.id, authToken: token });

  if (detail.data) {
    const d = detail.data;
    console.log('All keys:', Object.keys(d).join(', '));

    // Check if there's a download mapping
    if (d.download_path_mapping && Object.keys(d.download_path_mapping).length > 0) {
      console.log('\ndownload_path_mapping:', JSON.stringify(d.download_path_mapping, null, 2));
    }

    // Check content_list for audio entries
    if (d.content_list && d.content_list.length > 0) {
      console.log('\nContent list:');
      for (const item of d.content_list) {
        console.log(`  - ${item.data_type}: ${item.data_link?.slice(0, 80)}...`);
      }
    }
  }

  // Try to access the audio via the S3 pattern from transcript URL
  console.log('\n=== Trying S3 URL Pattern ===');

  // The transcript URL pattern is:
  // https://prod-plaud-content-storage.s3.amazonaws.com/permanent/{user_id}/file_transcript/{file_id}/trans_result.json.gz
  // Maybe audio is at:
  // https://prod-plaud-content-storage.s3.amazonaws.com/permanent/{user_id}/file_audio/{file_id}/{filename}

  const userId = '90914eb080fd4608bc4a4c397693ad5e';
  const audioPatterns = [
    `https://prod-plaud-content-storage.s3.us-west-2.amazonaws.com/permanent/${userId}/file_ori/${file.id}/${file.fullname}`,
    `https://prod-plaud-content-storage.s3.us-west-2.amazonaws.com/permanent/${userId}/file_audio/${file.id}/${file.fullname}`,
    `https://prod-plaud-content-storage.s3.us-west-2.amazonaws.com/permanent/${userId}/audio/${file.id}/${file.fullname}`,
    `https://prod-plaud-content-storage.s3.us-west-2.amazonaws.com/permanent/${userId}/${file.fullname}`,
  ];

  for (const url of audioPatterns) {
    console.log(`Testing: ${url.slice(0, 100)}...`);
    // Note: These will fail without proper S3 auth, but we're testing the pattern
  }

  await browser.close();
  console.log('\nDone!');
}

main().catch(console.error);
