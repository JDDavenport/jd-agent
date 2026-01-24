/**
 * iOS Simulator Bridge
 *
 * Provides utilities for interacting with iOS Simulator via xcrun simctl.
 * Used by the iOS Testing Agent for screenshot capture and basic interactions.
 */

import { execSync, exec } from 'child_process';
import { readFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

export interface SimulatorDevice {
  udid: string;
  name: string;
  state: 'Booted' | 'Shutdown' | string;
  runtime: string;
}

export interface ScreenshotResult {
  success: boolean;
  base64?: string;
  path?: string;
  error?: string;
}

export interface SimulatorInfo {
  booted: SimulatorDevice | null;
  available: SimulatorDevice[];
}

export class iOSSimulatorBridge {
  private screenshotDir: string;
  private currentDevice: SimulatorDevice | null = null;

  constructor(screenshotDir?: string) {
    this.screenshotDir = screenshotDir || join(process.cwd(), 'storage', 'ios-screenshots');

    // Ensure screenshot directory exists
    if (!existsSync(this.screenshotDir)) {
      mkdirSync(this.screenshotDir, { recursive: true });
    }
  }

  /**
   * Get list of available simulators and currently booted one
   */
  getSimulators(): SimulatorInfo {
    try {
      const output = execSync('xcrun simctl list devices available -j', { encoding: 'utf-8' });
      const data = JSON.parse(output);

      const devices: SimulatorDevice[] = [];
      let booted: SimulatorDevice | null = null;

      for (const [runtime, runtimeDevices] of Object.entries(data.devices)) {
        if (!Array.isArray(runtimeDevices)) continue;

        for (const device of runtimeDevices as any[]) {
          const sim: SimulatorDevice = {
            udid: device.udid,
            name: device.name,
            state: device.state,
            runtime: runtime.replace('com.apple.CoreSimulator.SimRuntime.', ''),
          };

          devices.push(sim);

          if (device.state === 'Booted') {
            booted = sim;
          }
        }
      }

      return { booted, available: devices };
    } catch (error) {
      console.error('[iOSSimulatorBridge] Failed to get simulators:', error);
      return { booted: null, available: [] };
    }
  }

  /**
   * Get the currently booted simulator
   */
  getBootedSimulator(): SimulatorDevice | null {
    if (this.currentDevice?.state === 'Booted') {
      return this.currentDevice;
    }

    const { booted } = this.getSimulators();
    this.currentDevice = booted;
    return booted;
  }

  /**
   * Boot a simulator by name or UDID
   */
  async bootSimulator(nameOrUdid: string): Promise<boolean> {
    try {
      const { available } = this.getSimulators();
      const device = available.find(d => d.name === nameOrUdid || d.udid === nameOrUdid);

      if (!device) {
        console.error(`[iOSSimulatorBridge] Device not found: ${nameOrUdid}`);
        return false;
      }

      if (device.state === 'Booted') {
        this.currentDevice = device;
        return true;
      }

      execSync(`xcrun simctl boot ${device.udid}`);

      // Wait for boot
      await new Promise(resolve => setTimeout(resolve, 2000));

      this.currentDevice = { ...device, state: 'Booted' };
      return true;
    } catch (error) {
      console.error('[iOSSimulatorBridge] Failed to boot simulator:', error);
      return false;
    }
  }

  /**
   * Take a screenshot of the booted simulator
   */
  async takeScreenshot(filename?: string): Promise<ScreenshotResult> {
    const device = this.getBootedSimulator();

    if (!device) {
      return { success: false, error: 'No simulator is currently booted' };
    }

    try {
      const timestamp = Date.now();
      const screenshotPath = join(
        this.screenshotDir,
        filename || `ios-screenshot-${timestamp}.png`
      );

      // Take screenshot
      execSync(`xcrun simctl io ${device.udid} screenshot "${screenshotPath}"`, {
        timeout: 10000,
      });

      // Read as base64
      const buffer = readFileSync(screenshotPath);
      const base64 = buffer.toString('base64');

      return {
        success: true,
        base64,
        path: screenshotPath,
      };
    } catch (error) {
      return {
        success: false,
        error: `Screenshot failed: ${error}`,
      };
    }
  }

  /**
   * Open a URL in the simulator (useful for deep links)
   */
  async openURL(url: string): Promise<boolean> {
    const device = this.getBootedSimulator();

    if (!device) {
      console.error('[iOSSimulatorBridge] No simulator booted');
      return false;
    }

    try {
      execSync(`xcrun simctl openurl ${device.udid} "${url}"`);
      return true;
    } catch (error) {
      console.error('[iOSSimulatorBridge] Failed to open URL:', error);
      return false;
    }
  }

  /**
   * Launch an app by bundle ID
   */
  async launchApp(bundleId: string): Promise<boolean> {
    const device = this.getBootedSimulator();

    if (!device) {
      console.error('[iOSSimulatorBridge] No simulator booted');
      return false;
    }

    try {
      execSync(`xcrun simctl launch ${device.udid} ${bundleId}`);
      return true;
    } catch (error) {
      console.error('[iOSSimulatorBridge] Failed to launch app:', error);
      return false;
    }
  }

  /**
   * Terminate an app by bundle ID
   */
  async terminateApp(bundleId: string): Promise<boolean> {
    const device = this.getBootedSimulator();

    if (!device) {
      return false;
    }

    try {
      execSync(`xcrun simctl terminate ${device.udid} ${bundleId}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Simulate a tap at specific coordinates
   */
  async tap(x: number, y: number): Promise<boolean> {
    const device = this.getBootedSimulator();

    if (!device) {
      return false;
    }

    try {
      // Use AppleScript to interact with Simulator app
      const script = `
        tell application "Simulator"
          activate
        end tell
        delay 0.2
        tell application "System Events"
          click at {${x}, ${y}}
        end tell
      `;
      execSync(`osascript -e '${script}'`);
      return true;
    } catch (error) {
      console.error('[iOSSimulatorBridge] Tap failed:', error);
      return false;
    }
  }

  /**
   * Type text (requires app to have focus on input)
   */
  async typeText(text: string): Promise<boolean> {
    const device = this.getBootedSimulator();

    if (!device) {
      return false;
    }

    try {
      // Use pbcopy and simctl to paste
      execSync(`echo "${text}" | pbcopy`);
      execSync(`xcrun simctl io ${device.udid} paste`);
      return true;
    } catch (error) {
      // Fallback to AppleScript keystroke
      try {
        const escapedText = text.replace(/"/g, '\\"');
        const script = `
          tell application "Simulator" to activate
          delay 0.2
          tell application "System Events"
            keystroke "${escapedText}"
          end tell
        `;
        execSync(`osascript -e '${script}'`);
        return true;
      } catch {
        console.error('[iOSSimulatorBridge] Type text failed:', error);
        return false;
      }
    }
  }

  /**
   * Press home button
   */
  async pressHome(): Promise<boolean> {
    const device = this.getBootedSimulator();

    if (!device) {
      return false;
    }

    try {
      execSync(`xcrun simctl io ${device.udid} keyevent homebutton`);
      return true;
    } catch (error) {
      console.error('[iOSSimulatorBridge] Press home failed:', error);
      return false;
    }
  }

  /**
   * Get app status (running/installed)
   */
  async getAppStatus(bundleId: string): Promise<{ installed: boolean; running: boolean }> {
    const device = this.getBootedSimulator();

    if (!device) {
      return { installed: false, running: false };
    }

    try {
      // Check if installed
      const listOutput = execSync(`xcrun simctl listapps ${device.udid}`, { encoding: 'utf-8' });
      const installed = listOutput.includes(bundleId);

      // Check if running (approximate - check if process exists)
      let running = false;
      try {
        const psOutput = execSync(`xcrun simctl spawn ${device.udid} launchctl list`, { encoding: 'utf-8' });
        running = psOutput.includes(bundleId);
      } catch {
        // Ignore - just means we couldn't check
      }

      return { installed, running };
    } catch (error) {
      return { installed: false, running: false };
    }
  }

  /**
   * Clean up old screenshots
   */
  cleanupScreenshots(olderThanMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    try {
      const files = require('fs').readdirSync(this.screenshotDir);
      for (const file of files) {
        if (!file.endsWith('.png')) continue;

        const filePath = join(this.screenshotDir, file);
        const stats = require('fs').statSync(filePath);

        if (now - stats.mtimeMs > olderThanMs) {
          unlinkSync(filePath);
          cleaned++;
        }
      }
    } catch (error) {
      console.error('[iOSSimulatorBridge] Cleanup failed:', error);
    }

    return cleaned;
  }
}

export function createiOSSimulatorBridge(screenshotDir?: string): iOSSimulatorBridge {
  return new iOSSimulatorBridge(screenshotDir);
}
