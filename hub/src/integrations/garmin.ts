/**
 * JD Agent - Garmin Connect Integration
 *
 * Fetches health and fitness data from Garmin Connect via python-garminconnect.
 * Uses a Python subprocess for authentication (Garmin has no official API).
 *
 * Data available:
 * - Steps and activity metrics
 * - Heart rate (resting, max, min)
 * - Sleep data (duration, stages, score)
 * - Stress levels
 * - Body Battery
 * - Activities/workouts
 */

import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

// ============================================
// Types
// ============================================

interface GarminProfile {
  displayName: string;
  userName: string;
  email: string;
}

interface GarminSteps {
  date: string;
  totalSteps: number | null;
  stepGoal: number | null;
  totalDistance: number | null;
  activeCalories: number | null;
  totalCalories: number | null;
  floors: number | null;
  activeMinutes: number | null;
  sedentaryMinutes: number | null;
}

interface GarminHeartRate {
  date: string;
  restingHR: number | null;
  maxHR: number | null;
  minHR: number | null;
  avgHR: number | null;
}

interface GarminSleep {
  date: string;
  totalSleepSeconds: number | null;
  deepSleepSeconds: number | null;
  lightSleepSeconds: number | null;
  remSleepSeconds: number | null;
  awakeSleepSeconds: number | null;
  sleepScore: number | null;
  sleepStartTime: string | null;
  sleepEndTime: string | null;
}

interface GarminStress {
  date: string;
  overallLevel: number | null;
  restStressDuration: number | null;
  lowStressDuration: number | null;
  mediumStressDuration: number | null;
  highStressDuration: number | null;
  stressQualifier: string | null;
}

interface GarminBodyBattery {
  date: string;
  current: number | null;
  high: number | null;
  low: number | null;
  charged: number | null;
  drained: number | null;
}

interface GarminActivity {
  activityId: number;
  activityName: string;
  activityType: string | null;
  startTime: string;
  duration: number | null;
  distance: number | null;
  calories: number | null;
  avgHR: number | null;
  maxHR: number | null;
  avgSpeed: number | null;
}

interface GarminTodaySummary {
  date: string;
  steps: {
    totalSteps: number | null;
    totalDistance: number | null;
    activeCalories: number | null;
    totalCalories: number | null;
    floors: number | null;
    activeMinutes: number | null;
  } | null;
  heartRate: {
    restingHR: number | null;
    maxHR: number | null;
    minHR: number | null;
  } | null;
  stress: {
    overallLevel: number | null;
    restStress: number | null;
    lowStress: number | null;
    mediumStress: number | null;
    highStress: number | null;
  } | null;
  bodyBattery: {
    current: number | null;
    charged: number | null;
    drained: number | null;
  } | null;
  sleep: {
    totalSleepSeconds: number | null;
    deepSleepSeconds: number | null;
    lightSleepSeconds: number | null;
    remSleepSeconds: number | null;
    awakeSleepSeconds: number | null;
    sleepScore: number | null;
  } | null;
}

interface GarminFullReport {
  date: string;
  steps: GarminSteps | null;
  heartRate: GarminHeartRate | null;
  sleep: GarminSleep | null;
  stress: GarminStress | null;
  bodyBattery: GarminBodyBattery | null;
  activities: GarminActivity[];
}

interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// Garmin Integration Class
// ============================================

class GarminIntegration {
  private pythonScript: string;
  private _email: string | null = null;
  private _password: string | null = null;
  private _initialized = false;

  constructor() {
    this.pythonScript = join(__dirname, '../../scripts/garmin-client.py');
  }

  // Lazy-load credentials to ensure .env is loaded first
  private get email(): string | null {
    if (!this._initialized) {
      this._email = process.env.GARMIN_EMAIL || null;
      this._password = process.env.GARMIN_PASSWORD || null;
      this._initialized = true;
    }
    return this._email;
  }

  private get password(): string | null {
    if (!this._initialized) {
      this._email = process.env.GARMIN_EMAIL || null;
      this._password = process.env.GARMIN_PASSWORD || null;
      this._initialized = true;
    }
    return this._password;
  }

  /**
   * Check if Garmin is configured
   */
  isConfigured(): boolean {
    return !!(this.email && this.password);
  }

  /**
   * Check if Python script exists
   */
  isInstalled(): boolean {
    return existsSync(this.pythonScript);
  }

  /**
   * Execute Python command and return result
   */
  private async executeCommand<T>(command: string, args: string[] = []): Promise<CommandResult<T>> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Garmin not configured. Set GARMIN_EMAIL and GARMIN_PASSWORD in .env',
      };
    }

    if (!this.isInstalled()) {
      return {
        success: false,
        error: `Python script not found at ${this.pythonScript}`,
      };
    }

    return new Promise((resolve) => {
      const pythonProcess = spawn('python3', [this.pythonScript, command, ...args], {
        env: {
          ...process.env,
          GARMIN_EMAIL: this.email!,
          GARMIN_PASSWORD: this.password!,
        },
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0 && !stdout) {
          resolve({
            success: false,
            error: stderr || `Process exited with code ${code}`,
          });
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          resolve({
            success: false,
            error: `Failed to parse response: ${stdout.slice(0, 200)}`,
          });
        }
      });

      pythonProcess.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to spawn Python process: ${error.message}`,
        });
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        pythonProcess.kill();
        resolve({
          success: false,
          error: 'Command timed out after 60 seconds',
        });
      }, 60000);
    });
  }

  /**
   * Test login and get profile
   */
  async login(): Promise<CommandResult<GarminProfile>> {
    console.log('[Garmin] Testing login...');
    const result = await this.executeCommand<GarminProfile>('login');

    if (result.success) {
      console.log('[Garmin] Login successful');
    } else {
      console.error('[Garmin] Login failed:', result.error);
    }

    return result;
  }

  /**
   * Get authentication status
   */
  async getStatus(): Promise<{
    configured: boolean;
    installed: boolean;
    authenticated: boolean;
    displayName: string | null;
    error: string | null;
  }> {
    if (!this.isConfigured()) {
      return {
        configured: false,
        installed: this.isInstalled(),
        authenticated: false,
        displayName: null,
        error: 'Garmin credentials not configured',
      };
    }

    // Python script returns { success, authenticated, hasSession, displayName } directly
    const result = await this.executeCommand<{
      authenticated?: boolean;
      displayName?: string;
      hasSession?: boolean;
    }>('status');

    return {
      configured: true,
      installed: this.isInstalled(),
      // Check both result.data (if wrapped) and result directly (Python returns at top level)
      authenticated: result.success && (result.data?.authenticated ?? (result as any).authenticated ?? false),
      displayName: result.data?.displayName || (result as any).displayName || null,
      error: result.error || null,
    };
  }

  /**
   * Get today's summary data
   */
  async getToday(): Promise<CommandResult<GarminTodaySummary>> {
    console.log('[Garmin] Fetching today\'s data...');
    return this.executeCommand<GarminTodaySummary>('today');
  }

  /**
   * Get sleep data for a specific date
   */
  async getSleep(date?: string): Promise<CommandResult<GarminSleep>> {
    console.log(`[Garmin] Fetching sleep data for ${date || 'today'}...`);
    return this.executeCommand<GarminSleep>('sleep', date ? [date] : []);
  }

  /**
   * Get heart rate data for a specific date
   */
  async getHeartRate(date?: string): Promise<CommandResult<GarminHeartRate>> {
    console.log(`[Garmin] Fetching heart rate data for ${date || 'today'}...`);
    return this.executeCommand<GarminHeartRate>('heart_rate', date ? [date] : []);
  }

  /**
   * Get step data for a specific date
   */
  async getSteps(date?: string): Promise<CommandResult<GarminSteps>> {
    console.log(`[Garmin] Fetching step data for ${date || 'today'}...`);
    return this.executeCommand<GarminSteps>('steps', date ? [date] : []);
  }

  /**
   * Get stress data for a specific date
   */
  async getStress(date?: string): Promise<CommandResult<GarminStress>> {
    console.log(`[Garmin] Fetching stress data for ${date || 'today'}...`);
    return this.executeCommand<GarminStress>('stress', date ? [date] : []);
  }

  /**
   * Get body battery data for a specific date
   */
  async getBodyBattery(date?: string): Promise<CommandResult<GarminBodyBattery>> {
    console.log(`[Garmin] Fetching body battery data for ${date || 'today'}...`);
    return this.executeCommand<GarminBodyBattery>('body_battery', date ? [date] : []);
  }

  /**
   * Get recent activities
   */
  async getActivities(limit: number = 10): Promise<CommandResult<GarminActivity[]>> {
    console.log(`[Garmin] Fetching ${limit} recent activities...`);
    return this.executeCommand<GarminActivity[]>('activities', [limit.toString()]);
  }

  /**
   * Get full health report for a specific date
   */
  async getFullReport(date?: string): Promise<CommandResult<GarminFullReport>> {
    console.log(`[Garmin] Fetching full report for ${date || 'today'}...`);
    return this.executeCommand<GarminFullReport>('full_report', date ? [date] : []);
  }

  /**
   * Get simplified daily metrics (for dashboard)
   */
  async getDailyMetrics(date?: string): Promise<{
    steps: number | null;
    restingHR: number | null;
    sleepHours: number | null;
    sleepScore: number | null;
    stressLevel: number | null;
    bodyBattery: number | null;
  }> {
    const report = await this.getFullReport(date);

    if (!report.success || !report.data) {
      return {
        steps: null,
        restingHR: null,
        sleepHours: null,
        sleepScore: null,
        stressLevel: null,
        bodyBattery: null,
      };
    }

    const data = report.data;

    return {
      steps: data.steps?.totalSteps || null,
      restingHR: data.heartRate?.restingHR || null,
      sleepHours: data.sleep?.totalSleepSeconds
        ? Math.round((data.sleep.totalSleepSeconds / 3600) * 10) / 10
        : null,
      sleepScore: data.sleep?.sleepScore || null,
      stressLevel: data.stress?.overallLevel || null,
      bodyBattery: data.bodyBattery?.current || null,
    };
  }
}

// ============================================
// Singleton Instance
// ============================================

let garminInstance: GarminIntegration | null = null;

export function getGarminIntegration(): GarminIntegration {
  if (!garminInstance) {
    garminInstance = new GarminIntegration();
  }
  return garminInstance;
}

export const garminIntegration = getGarminIntegration();

// Export types
export type {
  GarminProfile,
  GarminSteps,
  GarminHeartRate,
  GarminSleep,
  GarminStress,
  GarminBodyBattery,
  GarminActivity,
  GarminTodaySummary,
  GarminFullReport,
};
