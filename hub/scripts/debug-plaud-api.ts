/**
 * Debug Plaud API to see what data is available for recordings
 */

import { chromium } from 'playwright';
import { existsSync, writeFileSync } from 'fs';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';

async function main() {
  console.log('=== Debug Plaud API ===\n');

  if (!existsSync(STORAGE_PATH)) {
    console.error('No Plaud session found.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      storageState: STORAGE_PATH,
    });

    const page = await context.newPage();
    await page.goto('https://web.plaud.ai/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const token = await page.evaluate(() => localStorage.getItem('tokenstr'));
    if (!token) {
      console.error('No auth token found. Session may have expired.');
      process.exit(1);
    }

    console.log('✅ Authenticated\n');

    // Get file list - look for transcribed files
    const filesResponse = await page.evaluate(async (authToken) => {
      const response = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=100&is_trash=2&sort_by=start_time&is_desc=true', {
        headers: { 'Authorization': authToken }
      });
      return response.json();
    }, token) as { data_file_list?: any[] };

    const files = filesResponse.data_file_list || [];
    console.log(`Found ${files.length} files\n`);
    
    // Filter to only transcribed files
    const transcribedFiles = files.filter((f: any) => f.is_trans === true);
    console.log(`Transcribed files: ${transcribedFiles.length}\n`);

    for (const file of transcribedFiles.slice(0, 2)) {
      console.log(`\n=== ${file.filename} ===`);
      console.log(`ID: ${file.id}`);
      console.log(`is_trans: ${file.is_trans}`);
      console.log(`is_summary: ${file.is_summary}`);

      // Get detailed file info
      const detail = await page.evaluate(async ({ fileId, authToken }) => {
        const resp = await fetch(`https://api.plaud.ai/file/detail/${fileId}`, {
          headers: { 'Authorization': authToken }
        });
        return resp.json();
      }, { fileId: file.id, authToken: token });

      // Write full response to file for analysis
      writeFileSync(`/tmp/plaud-detail-${file.id.slice(0, 8)}.json`, JSON.stringify(detail, null, 2));
      console.log(`\nSaved detail to /tmp/plaud-detail-${file.id.slice(0, 8)}.json`);

      // Show what we got
      if (detail.data) {
        console.log('\npre_download_content_list:');
        for (const item of detail.data.pre_download_content_list || []) {
          console.log(`  - type: ${item.data_type}, title: ${item.data_title?.slice(0, 30)}, has_content: ${!!item.data_content}`);
        }

        console.log('\ncontent_list:');
        for (const item of detail.data.content_list || []) {
          console.log(`  - type: ${item.data_type}, link: ${item.data_link?.slice(0, 50)}`);
        }
      }
    }

  } finally {
    await browser.close();
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);
