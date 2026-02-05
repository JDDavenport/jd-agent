#!/usr/bin/env bun

import postgres from "postgres";

const DB_URL = "postgresql://neondb_owner:npg_1sErAP7pOVvt@ep-round-frog-ah8req8z-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = postgres(DB_URL);

async function testConnection() {
  try {
    console.log('🔗 Testing database connection...');
    
    // Test basic connection
    const result = await sql`SELECT current_database(), current_user, now()`;
    console.log('✅ Connection successful!');
    console.log('Database:', result[0].current_database);
    console.log('User:', result[0].current_user);
    console.log('Time:', result[0].now);
    
    // Check if recordings table exists
    const tablesResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('recordings', 'transcripts')
    `;
    
    console.log('\n📋 Available tables:');
    tablesResult.forEach(row => console.log(`  - ${row.table_name}`));
    
    // Check recordings table schema
    if (tablesResult.some(row => row.table_name === 'recordings')) {
      const recordingsSchema = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'recordings'
        ORDER BY ordinal_position
      `;
      
      console.log('\n🗂️  Recordings table schema:');
      recordingsSchema.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}${col.column_default ? ` default: ${col.column_default}` : ''}`);
      });
    }
    
    // Check transcripts table schema
    if (tablesResult.some(row => row.table_name === 'transcripts')) {
      const transcriptsSchema = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transcripts'
        ORDER BY ordinal_position
      `;
      
      console.log('\n📝 Transcripts table schema:');
      transcriptsSchema.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'}${col.column_default ? ` default: ${col.column_default}` : ''}`);
      });
    }
    
    // Count existing records
    if (tablesResult.some(row => row.table_name === 'recordings')) {
      const countResult = await sql`SELECT COUNT(*) as count FROM recordings`;
      console.log(`\n📊 Current recordings count: ${countResult[0].count}`);
    }
    
    if (tablesResult.some(row => row.table_name === 'transcripts')) {
      const transcriptCountResult = await sql`SELECT COUNT(*) as count FROM transcripts`;
      console.log(`📊 Current transcripts count: ${transcriptCountResult[0].count}`);
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

if (import.meta.main) {
  testConnection();
}