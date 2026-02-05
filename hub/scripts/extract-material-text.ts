#!/usr/bin/env bun

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import path from 'path';
import os from 'os';

// Database connection
const DB_URL = "postgresql://neondb_owner:npg_1sErAP7pOVvt@ep-round-frog-ah8req8z-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

// Canvas API settings
const CANVAS_BASE_URL = "https://byu.instructure.com";
const CANVAS_TOKEN = "7407~aeC3XyPNVFCa6X2RaBwkAh3hzc2WuyNNY2VvGX3RcTNBeQKeZynU78H3n2ZrtWh6";

interface Material {
  id: string;
  material_type: string;
  file_type: string;
  display_name: string;
  canvas_url: string;
  download_url: string;
  canvas_course_id: string;
  canvas_file_id?: string;
}

/**
 * Execute database query using psql
 */
function executeQuery(query: string): any[] {
  const tempFile = path.join(os.tmpdir(), `query_${Date.now()}.sql`);
  writeFileSync(tempFile, query);
  
  try {
    const result = execSync(
      `/opt/homebrew/opt/postgresql@16/bin/psql "${DB_URL}" -f "${tempFile}" --csv`,
      { encoding: 'utf-8' }
    );
    unlinkSync(tempFile);
    
    const lines = result.trim().split('\n');
    if (lines.length <= 1) return [];
    
    const headers = lines[0].split(',');
    return lines.slice(1).map(line => {
      const values = line.split(',');
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || null;
      });
      return row;
    });
  } catch (error) {
    unlinkSync(tempFile);
    throw error;
  }
}

/**
 * Update material with extracted text
 */
function updateMaterialText(materialId: string, extractedText: string) {
  const query = `
    UPDATE canvas_materials 
    SET extracted_text = $1, updated_at = NOW()
    WHERE id = '${materialId}';
  `;
  
  // Escape single quotes in the text
  const escapedText = extractedText.replace(/'/g, "''");
  const finalQuery = query.replace('$1', `'${escapedText}'`);
  
  executeQuery(finalQuery);
  console.log(`✅ Updated material ${materialId}`);
}

/**
 * Make Canvas API request
 */
async function canvasApiRequest(endpoint: string): Promise<any> {
  const url = `${CANVAS_BASE_URL}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${CANVAS_TOKEN}`,
    'Accept': 'application/json'
  };
  
  console.log(`📡 Canvas API: ${endpoint}`);
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Extract course_id and item_id from Canvas URL
 */
function parseCanvasUrl(canvasUrl: string): { courseId?: string, itemId?: string } {
  const patterns = [
    /courses\/(\d+)\/modules\/items\/(\d+)/,
    /courses\/(\d+)\/files\/(\d+)/,
    /courses\/(\d+)\/pages\/([^/?]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = canvasUrl.match(pattern);
    if (match) {
      return { courseId: match[1], itemId: match[2] };
    }
  }
  
  console.warn(`⚠️  Could not parse Canvas URL: ${canvasUrl}`);
  return {};
}

/**
 * Process Canvas pages (reading/page)
 */
async function processPage(material: Material): Promise<string> {
  const { courseId, itemId } = parseCanvasUrl(material.canvas_url);
  
  if (!courseId || !itemId) {
    throw new Error(`Cannot parse course/item from URL: ${material.canvas_url}`);
  }
  
  try {
    // First try to get the module item to resolve the page URL
    const moduleItem = await canvasApiRequest(`/api/v1/courses/${courseId}/module_item_redirect/${itemId}`);
    
    // Extract page URL from the redirect or use item ID as page URL
    let pageUrl = itemId;
    if (moduleItem && moduleItem.url) {
      const pageMatch = moduleItem.url.match(/pages\/([^/?]+)/);
      if (pageMatch) {
        pageUrl = pageMatch[1];
      }
    }
    
    // Fetch the actual page content
    const page = await canvasApiRequest(`/api/v1/courses/${courseId}/pages/${pageUrl}`);
    
    if (!page.body) {
      throw new Error('No body content found in page');
    }
    
    // Strip HTML tags and return plain text
    const textContent = page.body
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log(`📄 Extracted ${textContent.length} characters from page`);
    return textContent;
    
  } catch (error) {
    console.error(`❌ Failed to process page: ${error.message}`);
    throw error;
  }
}

/**
 * Process Canvas files (file/file)
 */
async function processFile(material: Material): Promise<string> {
  const { courseId, itemId } = parseCanvasUrl(material.canvas_url);
  
  if (!courseId || !itemId) {
    throw new Error(`Cannot parse course/item from URL: ${material.canvas_url}`);
  }
  
  try {
    // Get the module item to find the actual file
    const moduleItem = await canvasApiRequest(`/api/v1/courses/${courseId}/module_item_redirect/${itemId}`);
    
    // Extract file ID from the response
    let fileId = material.canvas_file_id;
    if (!fileId && moduleItem && moduleItem.url) {
      const fileMatch = moduleItem.url.match(/files\/(\d+)/);
      if (fileMatch) {
        fileId = fileMatch[1];
      }
    }
    
    if (!fileId) {
      throw new Error('Could not determine file ID');
    }
    
    // Get file details and download URL
    const fileInfo = await canvasApiRequest(`/api/v1/files/${fileId}`);
    
    if (!fileInfo.url) {
      throw new Error('No download URL found for file');
    }
    
    // Download the file
    console.log(`⬇️  Downloading file: ${fileInfo.display_name}`);
    const fileResponse = await fetch(fileInfo.url);
    
    if (!fileResponse.ok) {
      throw new Error(`Failed to download file: ${fileResponse.status}`);
    }
    
    const buffer = await fileResponse.arrayBuffer();
    const tempFile = path.join(os.tmpdir(), `canvas_file_${Date.now()}.${fileInfo.display_name?.split('.').pop() || 'tmp'}`);
    
    // Write to temporary file
    writeFileSync(tempFile, new Uint8Array(buffer));
    
    try {
      let extractedText = '';
      
      // Extract text based on file type
      if (fileInfo.content_type?.includes('pdf') || tempFile.toLowerCase().endsWith('.pdf')) {
        // Use pdftotext for PDF files
        try {
          extractedText = execSync(`/opt/homebrew/bin/pdftotext -layout "${tempFile}" -`, { encoding: 'utf-8' });
          console.log(`📄 Extracted ${extractedText.length} characters from PDF`);
        } catch (error) {
          console.warn(`⚠️  pdftotext failed, trying alternative extraction`);
          // Fallback: try to read as text
          extractedText = readFileSync(tempFile, 'utf-8');
        }
      } else if (fileInfo.content_type?.includes('text') || tempFile.toLowerCase().match(/\.(txt|md|csv)$/)) {
        // Plain text files
        extractedText = readFileSync(tempFile, 'utf-8');
        console.log(`📄 Extracted ${extractedText.length} characters from text file`);
      } else {
        // Try to extract any readable text
        try {
          extractedText = execSync(`strings "${tempFile}"`, { encoding: 'utf-8' });
          console.log(`📄 Extracted ${extractedText.length} characters using strings`);
        } catch (error) {
          extractedText = `[Binary file: ${fileInfo.display_name}, type: ${fileInfo.content_type}]`;
        }
      }
      
      // Clean up and return
      unlinkSync(tempFile);
      return extractedText.trim();
      
    } catch (error) {
      unlinkSync(tempFile);
      throw error;
    }
    
  } catch (error) {
    console.error(`❌ Failed to process file: ${error.message}`);
    throw error;
  }
}

/**
 * Process external links (file/link)
 */
async function processLink(material: Material): Promise<string> {
  try {
    let url = material.download_url || material.canvas_url;
    
    // If it's a Canvas module item URL, resolve it first
    if (url.includes('/modules/items/')) {
      const { courseId, itemId } = parseCanvasUrl(url);
      if (courseId && itemId) {
        try {
          const moduleItem = await canvasApiRequest(`/api/v1/courses/${courseId}/module_item_redirect/${itemId}`);
          if (moduleItem && moduleItem.url) {
            url = moduleItem.url;
          }
        } catch (error) {
          console.warn(`⚠️  Could not resolve module item, using original URL`);
        }
      }
    }
    
    console.log(`🔗 Fetching link: ${url}`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch link: ${response.status} ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    let content = await response.text();
    
    // If it's HTML, strip tags
    if (contentType.includes('text/html')) {
      content = content
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    console.log(`🔗 Extracted ${content.length} characters from link`);
    return content;
    
  } catch (error) {
    console.error(`❌ Failed to process link: ${error.message}`);
    throw error;
  }
}

/**
 * Main extraction function
 */
async function extractMaterialText(material: Material): Promise<string> {
  console.log(`\n🔄 Processing: ${material.display_name} (${material.material_type}/${material.file_type})`);
  
  try {
    let extractedText = '';
    
    if (material.file_type === 'page') {
      extractedText = await processPage(material);
    } else if (material.file_type === 'file') {
      extractedText = await processFile(material);
    } else if (material.file_type === 'link' || material.file_type === 'url') {
      extractedText = await processLink(material);
    } else {
      // For other types, try to treat as link first, then file
      try {
        extractedText = await processLink(material);
      } catch (error) {
        console.warn(`⚠️  Link processing failed, trying as file`);
        extractedText = await processFile(material);
      }
    }
    
    if (!extractedText || extractedText.length < 10) {
      throw new Error('Extracted text is too short or empty');
    }
    
    return extractedText;
    
  } catch (error) {
    console.error(`❌ Failed to extract text: ${error.message}`);
    // Return error message as extracted text so we don't retry this material
    return `[Extraction failed: ${error.message}]`;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Material Text Extraction Pipeline');
  console.log('Database:', DB_URL);
  console.log('Canvas API:', CANVAS_BASE_URL);
  
  // Get materials missing extracted_text
  const materials = executeQuery(`
    SELECT 
      id, material_type, file_type, display_name, canvas_url, download_url,
      SPLIT_PART(canvas_url, '/courses/', 2)::text as canvas_course_id,
      canvas_file_id
    FROM canvas_materials 
    WHERE extracted_text IS NULL
    ORDER BY material_type, file_type, display_name;
  `);
  
  console.log(`\n📊 Found ${materials.length} materials missing extracted_text:`);
  
  // Group by type for summary
  const summary: Record<string, number> = {};
  materials.forEach(m => {
    const key = `${m.material_type}/${m.file_type}`;
    summary[key] = (summary[key] || 0) + 1;
  });
  
  Object.entries(summary).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}`);
  });
  
  // Process each material
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < materials.length; i++) {
    const material = materials[i];
    console.log(`\n[${i + 1}/${materials.length}] ${material.display_name}`);
    
    try {
      const extractedText = await extractMaterialText(material);
      updateMaterialText(material.id, extractedText);
      successCount++;
      
      // Small delay to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ Failed to process material ${material.id}: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log(`\n🎉 Extraction complete!`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  
  // Final summary
  const finalCount = executeQuery(`
    SELECT COUNT(*) as count 
    FROM canvas_materials 
    WHERE extracted_text IS NOT NULL;
  `)[0];
  
  console.log(`📊 Total materials with extracted_text: ${finalCount.count}`);
}

// Run the script
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});