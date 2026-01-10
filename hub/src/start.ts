// Simple startup script for Railway deployment
console.log('[START] Initializing JD Agent Hub...');
console.log('[START] Environment:', process.env.NODE_ENV || 'not set');
console.log('[START] App Environment:', process.env.APP_ENV || 'not set');
console.log('[START] Port:', process.env.PORT || '3000');
console.log('[START] Database URL set:', !!process.env.DATABASE_URL);

try {
  // Import and start the main app
  console.log('[START] Loading main application...');
  await import('./index.js');
  console.log('[START] Application loaded successfully');
} catch (error) {
  console.error('[START] Failed to start application:', error);
  process.exit(1);
}
