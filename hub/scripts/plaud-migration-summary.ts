#!/usr/bin/env bun

import postgres from "postgres";

const DB_URL = "postgresql://neondb_owner:npg_1sErAP7pOVvt@ep-round-frog-ah8req8z-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";
const sql = postgres(DB_URL);

async function generateMigrationSummary() {
  console.log('📊 Plaud Migration Summary Report\n');
  
  try {
    // Total recordings count
    const totalCount = await sql`SELECT COUNT(*) as count FROM recordings`;
    console.log(`✅ Total recordings in database: ${totalCount[0].count}`);
    
    // Recordings by type
    const typeBreakdown = await sql`
      SELECT recording_type, COUNT(*) as count 
      FROM recordings 
      GROUP BY recording_type 
      ORDER BY count DESC
    `;
    
    console.log('\n📋 Recordings by Type:');
    typeBreakdown.forEach(row => {
      console.log(`  - ${row.recording_type}: ${row.count} recordings`);
    });
    
    // Recordings by context (course)
    const contextBreakdown = await sql`
      SELECT context, COUNT(*) as count 
      FROM recordings 
      WHERE context IS NOT NULL
      GROUP BY context 
      ORDER BY count DESC
    `;
    
    console.log('\n📚 Class Recordings by Course:');
    contextBreakdown.forEach(row => {
      console.log(`  - ${row.context}: ${row.count} recordings`);
    });
    
    // Recordings without context
    const noContextCount = await sql`
      SELECT COUNT(*) as count 
      FROM recordings 
      WHERE context IS NULL
    `;
    console.log(`  - No context assigned: ${noContextCount[0].count} recordings`);
    
    // Duration statistics
    const durationStats = await sql`
      SELECT 
        SUM(duration_seconds) as total_seconds,
        AVG(duration_seconds) as avg_seconds,
        MIN(duration_seconds) as min_seconds,
        MAX(duration_seconds) as max_seconds
      FROM recordings
      WHERE duration_seconds > 0
    `;
    
    const stats = durationStats[0];
    const totalHours = Math.round(stats.total_seconds / 3600 * 10) / 10;
    const avgMinutes = Math.round(stats.avg_seconds / 60 * 10) / 10;
    const maxHours = Math.round(stats.max_seconds / 3600 * 10) / 10;
    
    console.log('\n⏱️  Duration Statistics:');
    console.log(`  - Total content: ${totalHours} hours`);
    console.log(`  - Average recording: ${avgMinutes} minutes`);
    console.log(`  - Longest recording: ${maxHours} hours`);
    console.log(`  - Shortest recording: ${stats.min_seconds} seconds`);
    
    // File size statistics
    const sizeStats = await sql`
      SELECT 
        SUM(file_size_bytes) as total_bytes,
        AVG(file_size_bytes) as avg_bytes,
        MAX(file_size_bytes) as max_bytes
      FROM recordings
      WHERE file_size_bytes > 0
    `;
    
    const size = sizeStats[0];
    const totalGB = Math.round(Number(size.total_bytes) / 1024 / 1024 / 1024 * 10) / 10;
    const avgMB = Math.round(Number(size.avg_bytes) / 1024 / 1024 * 10) / 10;
    const maxMB = Math.round(Number(size.max_bytes) / 1024 / 1024 * 10) / 10;
    
    console.log('\n💾 Storage Statistics:');
    console.log(`  - Total size: ${totalGB} GB`);
    console.log(`  - Average file size: ${avgMB} MB`);
    console.log(`  - Largest file: ${maxMB} MB`);
    
    // Recent recordings (last 7 days)
    const recentRecordings = await sql`
      SELECT original_filename, recording_type, context, duration_seconds, recorded_at
      FROM recordings
      WHERE recorded_at >= NOW() - INTERVAL '7 days'
      ORDER BY recorded_at DESC
      LIMIT 10
    `;
    
    if (recentRecordings.length > 0) {
      console.log('\n🕐 Recent Recordings (Last 7 days):');
      recentRecordings.forEach(rec => {
        const duration = Math.round(rec.duration_seconds / 60);
        const date = new Date(rec.recorded_at).toLocaleDateString();
        console.log(`  - ${rec.original_filename} (${rec.recording_type}${rec.context ? ` - ${rec.context}` : ''}) - ${duration}min on ${date}`);
      });
    }
    
    // Status breakdown
    const statusBreakdown = await sql`
      SELECT status, COUNT(*) as count
      FROM recordings
      GROUP BY status
      ORDER BY count DESC
    `;
    
    console.log('\n🚦 Processing Status:');
    statusBreakdown.forEach(row => {
      console.log(`  - ${row.status}: ${row.count} recordings`);
    });
    
    console.log('\n🎉 Migration Complete! All Plaud recordings are now in the hub database and ready for Class GPT integration.');
    
  } catch (error) {
    console.error('❌ Error generating summary:', error);
  } finally {
    await sql.end();
  }
}

if (import.meta.main) {
  generateMigrationSummary();
}