#!/usr/bin/env bun
/**
 * Vault iOS Physical Device Test
 *
 * Tests the Vault app on a connected physical iOS device.
 *
 * Usage:
 *   bun run scripts/vault-ios-device-test.ts
 */

import { execSync, exec } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';

const CONFIG = {
  bundleId: 'com.jdagent.vault',
  screenshotDir: join(dirname(__dirname), 'storage/ios-test-screenshots'),
  reportDir: join(dirname(__dirname), 'storage/ios-test-reports'),
};

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
  screenshot?: string;
}

class PhysicalDeviceTest {
  private deviceId: string | null = null;
  private deviceName: string = 'Unknown';
  private results: TestResult[] = [];
  private screenshots: string[] = [];

  async run(): Promise<void> {
    console.log('\n📱 Vault iOS Physical Device Test\n');
    console.log('═'.repeat(50));

    // Ensure directories exist
    for (const dir of [CONFIG.screenshotDir, CONFIG.reportDir]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    // Find connected device
    await this.findDevice();
    if (!this.deviceId) {
      console.log('❌ No physical device connected');
      console.log('   Connect your iPhone via USB and unlock it');
      return;
    }

    console.log(`\n✅ Found device: ${this.deviceName}`);
    console.log(`   Device ID: ${this.deviceId}\n`);

    // Run tests
    await this.testAppInstalled();
    await this.testLaunchApp();
    await this.testTakeScreenshot('initial', 2000);
    await this.testNetworkReachability();
    await this.testTakeScreenshot('after-load', 3000);

    // Print summary
    this.printSummary();
    this.saveReport();
  }

  private async findDevice(): Promise<void> {
    try {
      const output = execSync('xcrun devicectl list devices 2>&1', { encoding: 'utf-8' });
      const lines = output.split('\n');

      for (const line of lines) {
        if (line.includes('connected') && line.includes('iPhone')) {
          const match = line.match(/([A-F0-9-]{36})\s+connected/);
          if (match) {
            this.deviceId = match[1];
            const nameMatch = line.match(/^(\S+)/);
            this.deviceName = nameMatch ? nameMatch[1].replace(/-/g, ' ') : 'iPhone';
            return;
          }
        }
      }
    } catch (error) {
      console.error('Failed to list devices:', error);
    }
  }

  private async testAppInstalled(): Promise<void> {
    console.log('🔍 Checking if app is installed...');

    try {
      const output = execSync(
        `xcrun devicectl device info apps --device ${this.deviceId} 2>&1`,
        { encoding: 'utf-8', timeout: 30000 }
      );

      if (output.includes(CONFIG.bundleId)) {
        this.addResult('App Installed', 'pass', 'Vault app is installed on device');
      } else {
        this.addResult('App Installed', 'fail', 'Vault app NOT found on device');
      }
    } catch (error: any) {
      // Try alternative method
      try {
        const result = execSync(
          `xcrun devicectl device info --device ${this.deviceId} 2>&1`,
          { encoding: 'utf-8', timeout: 10000 }
        );
        // If we can query the device, assume app might be installed
        this.addResult('App Installed', 'warn', 'Could not verify app installation - check manually');
      } catch {
        this.addResult('App Installed', 'fail', `Device query failed: ${error.message}`);
      }
    }
  }

  private async testLaunchApp(): Promise<void> {
    console.log('🚀 Launching app on device...');

    try {
      execSync(
        `xcrun devicectl device process launch --device ${this.deviceId} ${CONFIG.bundleId} 2>&1`,
        { encoding: 'utf-8', timeout: 30000 }
      );
      this.addResult('App Launch', 'pass', 'App launched successfully');
      await this.wait(2000);
    } catch (error: any) {
      if (error.message?.includes('already running')) {
        this.addResult('App Launch', 'pass', 'App was already running');
      } else {
        this.addResult('App Launch', 'fail', `Launch failed: ${error.message?.substring(0, 100)}`);
      }
    }
  }

  private async testTakeScreenshot(name: string, delayMs: number): Promise<void> {
    console.log(`📸 Taking screenshot (${name})...`);
    await this.wait(delayMs);

    const filename = `device-${name}-${Date.now()}.png`;
    const filepath = join(CONFIG.screenshotDir, filename);

    try {
      // Use xcrun devicectl for screenshot on physical device
      execSync(
        `xcrun devicectl device screenshot --device ${this.deviceId} --output "${filepath}" 2>&1`,
        { encoding: 'utf-8', timeout: 30000 }
      );

      if (existsSync(filepath)) {
        this.screenshots.push(filepath);
        this.addResult(`Screenshot: ${name}`, 'pass', `Saved: ${filename}`, filepath);
      } else {
        this.addResult(`Screenshot: ${name}`, 'fail', 'Screenshot file not created');
      }
    } catch (error: any) {
      this.addResult(`Screenshot: ${name}`, 'fail', `Screenshot failed: ${error.message?.substring(0, 100)}`);
    }
  }

  private async testNetworkReachability(): Promise<void> {
    console.log('🌐 Testing network reachability from device perspective...');

    // Get current network IP
    let networkIp = '';
    try {
      networkIp = execSync('ipconfig getifaddr en0', { encoding: 'utf-8' }).trim();
    } catch {
      this.addResult('Network Config', 'fail', 'Could not determine Mac network IP');
      return;
    }

    // Check if Hub is running on that IP
    try {
      const response = await fetch(`http://${networkIp}:3000/api/health`, {
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        this.addResult('Hub Reachable', 'pass', `Hub accessible at ${networkIp}:3000`);
      } else {
        this.addResult('Hub Reachable', 'warn', `Hub returned ${response.status}`);
      }
    } catch (error: any) {
      this.addResult('Hub Reachable', 'fail', `Hub not reachable at ${networkIp}:3000 - ensure same WiFi network`);
    }

    // Check .env.production has correct IP
    const envPath = join(dirname(dirname(__dirname)), 'apps/vault/.env.production');
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf-8');
      if (content.includes(networkIp)) {
        this.addResult('API URL Config', 'pass', `Build configured for ${networkIp}`);
      } else {
        const match = content.match(/VITE_API_URL=(.+)/);
        const configuredUrl = match?.[1]?.trim() || 'unknown';
        if (configuredUrl.includes(networkIp)) {
          this.addResult('API URL Config', 'pass', `Correct IP in config`);
        } else {
          this.addResult('API URL Config', 'warn', `Config has ${configuredUrl}, current IP is ${networkIp}`);
        }
      }
    }
  }

  private addResult(name: string, status: TestResult['status'], message: string, screenshot?: string): void {
    this.results.push({ name, status, message, screenshot });
    const icons = { pass: '✅', fail: '❌', warn: '⚠️', skip: '⏭️' };
    console.log(`   ${icons[status]} ${name}: ${message}\n`);
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private printSummary(): void {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warn').length;

    console.log('\n' + '═'.repeat(50));
    console.log('📊 DEVICE TEST SUMMARY');
    console.log('═'.repeat(50));
    console.log(`   Device: ${this.deviceName}`);
    console.log(`   ✅ Passed:  ${passed}`);
    console.log(`   ❌ Failed:  ${failed}`);
    console.log(`   ⚠️  Warnings: ${warnings}`);
    console.log('═'.repeat(50));

    if (failed > 0) {
      console.log('\n❌ FAILURES:');
      for (const r of this.results.filter(r => r.status === 'fail')) {
        console.log(`   - ${r.name}: ${r.message}`);
      }
    }

    if (warnings > 0) {
      console.log('\n⚠️  WARNINGS:');
      for (const r of this.results.filter(r => r.status === 'warn')) {
        console.log(`   - ${r.name}: ${r.message}`);
      }
    }

    if (this.screenshots.length > 0) {
      console.log('\n📸 Screenshots:');
      for (const s of this.screenshots) {
        console.log(`   - ${s}`);
      }
    }
  }

  private saveReport(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const report = {
      timestamp: new Date().toISOString(),
      device: {
        name: this.deviceName,
        id: this.deviceId,
      },
      results: this.results,
      screenshots: this.screenshots,
    };

    const jsonPath = join(CONFIG.reportDir, `device-test-${timestamp}.json`);
    writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved: ${jsonPath}`);
  }
}

// Run
new PhysicalDeviceTest().run().catch(console.error);
