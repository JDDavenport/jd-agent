#!/usr/bin/env bun

import { Client } from 'pg';

// Database configuration
const dbConfig = {
  connectionString: 'postgresql://neondb_owner:npg_1sErAP7pOVvt@ep-round-frog-ah8req8z-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require',
};

// Anthropic API configuration
const ANTHROPIC_API_KEY = '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';
const CLAUDE_MODEL = 'claude-3-haiku-20240307';

interface MaterialSummary {
  overview: string;
  keyPoints: string[];
  concepts: string[];
  studyTips: string;
}

interface Material {
  id: number;
  display_name: string;
  material_type: string;
  course_id: number;
  extracted_text: string;
}

// Rate limiting delay (1 second between API calls)
const RATE_LIMIT_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateSummary(extractedText: string, materialName: string, materialType: string): Promise<MaterialSummary | null> {
  const prompt = `You are helping a student understand study materials. Analyze this ${materialType} content and create a structured summary.

Material: "${materialName}"
Content:
${extractedText}

Generate a JSON summary with:
- overview: 2-3 sentence overview of the material
- keyPoints: Array of 3-5 main points or takeaways
- concepts: Array of key concepts, terms, or ideas to remember
- studyTips: One practical tip on how to use this material for studying

Keep it concise but comprehensive. Respond with valid JSON only.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}\nBody: ${errorBody}`);
    }

    const data = await response.json();
    const summaryText = data.content[0].text;
    
    // Parse JSON response
    const summary = JSON.parse(summaryText);
    
    // Validate structure
    if (!summary.overview || !Array.isArray(summary.keyPoints) || !Array.isArray(summary.concepts) || !summary.studyTips) {
      throw new Error('Invalid summary structure from API');
    }
    
    return summary;
  } catch (error) {
    console.error(`Error generating summary for "${materialName}":`, error);
    return null;
  }
}

async function updateMaterialSummary(client: Client, materialId: number, summary: MaterialSummary): Promise<void> {
  const query = 'UPDATE canvas_materials SET ai_summary = $1 WHERE id = $2';
  await client.query(query, [JSON.stringify(summary), materialId]);
}

async function main() {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    console.log('Connected to database');

    // Get materials that need summaries
    const query = `
      SELECT cm.id, cm.display_name, cm.material_type, cm.course_id, cm.extracted_text,
             c.name as course_name
      FROM canvas_materials cm 
      LEFT JOIN classes c ON cm.course_id = c.id
      WHERE cm.extracted_text IS NOT NULL 
      AND cm.ai_summary IS NULL
      ORDER BY cm.id
    `;
    
    const result = await client.query(query);
    const materials = result.rows as Material[];
    
    console.log(`Found ${materials.length} materials needing AI summaries`);
    
    if (materials.length === 0) {
      console.log('No materials need processing. Exiting.');
      return;
    }

    // Process each material
    let processed = 0;
    let errors = 0;
    
    for (const material of materials) {
      console.log(`\nProcessing ${processed + 1}/${materials.length}: "${material.display_name}" (${material.material_type})`);
      
      // Truncate very long texts to avoid token limits
      let textToProcess = material.extracted_text;
      if (textToProcess.length > 20000) {
        textToProcess = textToProcess.substring(0, 20000) + '\n\n[Content truncated due to length]';
      }
      
      const summary = await generateSummary(textToProcess, material.display_name, material.material_type);
      
      if (summary) {
        await updateMaterialSummary(client, material.id, summary);
        console.log(`✅ Generated summary for "${material.display_name}"`);
        processed++;
      } else {
        console.log(`❌ Failed to generate summary for "${material.display_name}"`);
        errors++;
      }
      
      // Rate limiting - wait between API calls
      if (processed < materials.length) {
        await sleep(RATE_LIMIT_MS);
      }
    }
    
    console.log(`\n📊 Summary generation complete!`);
    console.log(`✅ Processed: ${processed}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📝 Total materials: ${materials.length}`);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Check if we should wait for more extractions
async function checkAndWait() {
  const client = new Client(dbConfig);
  
  try {
    await client.connect();
    
    // Check current status
    const result = await client.query(`
      SELECT 
        COUNT(*) as total_materials,
        COUNT(extracted_text) as with_text,
        COUNT(ai_summary) as with_summary,
        COUNT(CASE WHEN extracted_text IS NOT NULL AND ai_summary IS NULL THEN 1 END) as needs_summary
      FROM canvas_materials
    `);
    
    const stats = result.rows[0];
    console.log('📊 Current database status:');
    console.log(`   Total materials: ${stats.total_materials}`);
    console.log(`   With extracted text: ${stats.with_text}`);
    console.log(`   With AI summaries: ${stats.with_summary}`);
    console.log(`   Needing summaries: ${stats.needs_summary}`);
    
    // If very few materials have text, wait for the extractor
    if (parseInt(stats.with_text) < 30) {
      console.log('\n⏳ Only a few materials have extracted text. Waiting 2 minutes for text extraction to complete...');
      await sleep(120000); // Wait 2 minutes
      return checkAndWait(); // Recursive check
    }
    
    await client.end();
    return parseInt(stats.needs_summary);
    
  } catch (error) {
    console.error('Error checking database:', error);
    process.exit(1);
  }
}

// Main execution
async function run() {
  console.log('🚀 AI Material Summary Generator');
  console.log('Checking database status...\n');
  
  const needsSummary = await checkAndWait();
  
  if (needsSummary === 0) {
    console.log('✨ All materials already have AI summaries!');
    process.exit(0);
  }
  
  console.log(`\n📝 Starting summary generation for ${needsSummary} materials...\n`);
  await main();
}

run().catch(console.error);