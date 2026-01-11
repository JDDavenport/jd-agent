// Configuration for docs-frontend
// Uses environment variables with sensible defaults for development

export const config = {
  // URL to the main Command Center app
  appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173',

  // URL to the Hub API
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
};
