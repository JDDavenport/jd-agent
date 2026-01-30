/**
 * Plaud Download Content - Download transcripts and summaries
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';

async function main() {
  console.log('=== Plaud Download Content ===\n');

  if (!existsSync(SYNC_PATH)) {
    mkdirSync(SYNC_PATH, { recursive: true });
  }

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
    const response = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=20&is_trash=2&sort_by=start_time&is_desc=true', {
      headers: { 'Authorization': authToken || '' }
    });
    return response.json();
  }, token);

  console.log(`Found ${files.data_file_total} files\n`);

  for (const file of files.data_file_list || []) {
    console.log(`\n=== ${file.filename} ===`);
    console.log(`ID: ${file.id}`);
    console.log(`Transcribed: ${file.is_trans}, Summarized: ${file.is_summary}`);

    // Create directory for this file
    const date = new Date(file.start_time).toISOString().split('T')[0];
    const safeName = file.filename.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
    const dirName = `${date}_${safeName}_${file.id.slice(0, 8)}`;
    const dirPath = join(SYNC_PATH, dirName);

    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }

    // Get file detail
    const detail = await page.evaluate(async ({ fileId, authToken }) => {
      const resp = await fetch(`https://api.plaud.ai/file/detail/${fileId}`, {
        headers: { 'Authorization': authToken || '' }
      });
      return resp.json();
    }, { fileId: file.id, authToken: token });

    if (!detail.data) {
      console.log('  No detail data');
      continue;
    }

    const d = detail.data;

    // Save metadata
    const metadata = {
      id: file.id,
      filename: file.filename,
      duration: file.duration,
      start_time: file.start_time,
      is_transcribed: file.is_trans,
      is_summarized: file.is_summary,
      file_type: file.filetype,
      file_size: file.filesize
    };
    writeFileSync(join(dirPath, 'metadata.json'), JSON.stringify(metadata, null, 2));
    console.log('  Saved metadata.json');

    // Check pre_download_content_list for already-fetched content
    if (d.pre_download_content_list && d.pre_download_content_list.length > 0) {
      for (const item of d.pre_download_content_list) {
        if (item.data_content) {
          const filename = `${item.data_type || 'content'}.md`;
          writeFileSync(join(dirPath, filename), item.data_content);
          console.log(`  Saved ${filename} (from pre_download)`);
        }
      }
    }

    // Download from content_list URLs
    if (d.content_list && d.content_list.length > 0) {
      console.log(`  Found ${d.content_list.length} content items`);

      for (const item of d.content_list) {
        if (!item.data_link) continue;

        const type = item.data_type || 'unknown';
        console.log(`  Downloading: ${type}`);

        try {
          // Download the file
          const response = await page.request.get(item.data_link);

          if (response.ok()) {
            let buffer = await response.body();
            let content: string;

            // Check if it's gzipped
            if (item.data_link.includes('.gz')) {
              try {
                const decompressed = gunzipSync(buffer);
                content = decompressed.toString('utf-8');
              } catch (e) {
                content = buffer.toString('utf-8');
              }
            } else {
              content = buffer.toString('utf-8');
            }

            // Determine filename based on type
            let filename: string;
            if (type === 'transaction') {
              filename = 'transcript.json';
              // Try to parse and extract text
              try {
                const parsed = JSON.parse(content);
                writeFileSync(join(dirPath, filename), JSON.stringify(parsed, null, 2));

                // Also save as plain text
                if (parsed.results?.utterances) {
                  const text = parsed.results.utterances
                    .map((u: any) => `[${u.speaker || 'Speaker'}]: ${u.transcript}`)
                    .join('\n\n');
                  writeFileSync(join(dirPath, 'transcript.txt'), text);
                  console.log(`    Saved transcript.txt`);
                }
              } catch (e) {
                writeFileSync(join(dirPath, filename), content);
              }
            } else if (type === 'auto_sum_note') {
              filename = 'summary.md';
              writeFileSync(join(dirPath, filename), content);
            } else if (type === 'consumer_note') {
              filename = `note_${item.data_title?.replace(/[^a-zA-Z0-9]/g, '_') || 'untitled'}.md`;
              writeFileSync(join(dirPath, filename), content);
            } else {
              filename = `${type}.txt`;
              writeFileSync(join(dirPath, filename), content);
            }

            console.log(`    Saved ${filename} (${Math.round(content.length / 1024)}KB)`);
          } else {
            console.log(`    Failed: ${response.status()}`);
          }
        } catch (e) {
          console.log(`    Error: ${e}`);
        }
      }
    }

    // List what we downloaded
    console.log(`  Files saved to: ${dirPath}`);
  }

  await browser.close();
  console.log('\n\nDone!');
}

main().catch(console.error);
