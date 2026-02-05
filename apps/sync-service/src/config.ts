import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load from JD Agent .env
const envPath = resolve(process.env.HOME || '', 'projects/JD Agent/.env');
if (existsSync(envPath)) {
  dotenvConfig({ path: envPath });
}

export const config = {
  canvas: {
    baseUrl: 'https://byu.instructure.com',
    token: process.env.CANVAS_TOKEN || '',
    courses: [
      { id: '33259', name: 'Entrepreneurial Innovation', code: 'ENT' },
      { id: '32991', name: 'MBA 560 Business Analytics', code: 'MBA560' },
      { id: '33202', name: 'MBA 580 Business Strategy', code: 'MBA580' },
      { id: '34634', name: 'Post-MBA Career Strategy', code: 'MBA693R' },
      { id: '34458', name: 'MBA 677R Entrepreneurship Through Acquisition', code: 'MBA677R' },
      { id: '34638', name: 'MBA 664 Venture Capital/Private Equity', code: 'MBA664' },
      { id: '34642', name: 'MBA 654 Strategic Client Acquisition/Retention', code: 'MBA654' },
    ],
  },
  plaud: {
    syncDir: resolve(process.env.HOME || '', 'Documents/PlaudSync'),
  },
  remarkable: {
    cliPath: resolve(process.env.HOME || '', 'bin/remarkable'),
    token: process.env.REMARKABLE_DEVICE_TOKEN || '',
    storageDir: resolve(process.env.HOME || '', 'projects/JD Agent/storage/remarkable'),
  },
  hub: {
    localUrl: 'http://localhost:3000',
    prodUrl: 'https://studyaide.app',
  },
  paths: {
    goldStandard: resolve(__dirname, '../gold-standard'),
    root: resolve(__dirname, '..'),
  },
  // Class schedule for matching Plaud recordings
  classSchedule: [
    { courseId: '33259', name: 'Entrepreneurial Innovation', days: ['Tu', 'Th'], time: '08:00', duration: 75 },
    { courseId: '32991', name: 'MBA 560 Business Analytics', days: ['M', 'W'], time: '09:30', duration: 75 },
    { courseId: '33202', name: 'MBA 580 Business Strategy', days: ['M', 'W'], time: '11:00', duration: 75 },
    { courseId: '34634', name: 'Post-MBA Career Strategy', days: ['F'], time: '10:00', duration: 50 },
    { courseId: '34458', name: 'MBA 677R ETA', days: ['Tu', 'Th'], time: '14:00', duration: 75 },
    { courseId: '34638', name: 'MBA 664 VC/PE', days: ['Tu', 'Th'], time: '11:00', duration: 75 },
    { courseId: '34642', name: 'MBA 654 Strategic Acquisition', days: ['M', 'W'], time: '14:00', duration: 75 },
  ],
};
