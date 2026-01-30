import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const loadEnvFile = (path: string) => {
  if (!existsSync(path)) return;
  const envContent = readFileSync(path, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
};

const envPaths = [
  join(import.meta.dir, '../../.env'),
  join(import.meta.dir, '../../../.env'),
  join(import.meta.dir, '../../../hub/.env'),
];

envPaths.forEach(loadEnvFile);

export const getEnv = () => {
  const databaseUrl = process.env.SOS_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('SOS_DATABASE_URL is required');
  }

  return {
    databaseUrl,
    port: parseInt(process.env.SOS_API_PORT || '3180', 10),
    corsOrigins: process.env.SOS_CORS_ORIGINS?.split(',').map((origin) => origin.trim()) || [],
  };
};
