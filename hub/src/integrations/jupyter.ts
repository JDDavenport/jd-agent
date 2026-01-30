/**
 * JD Agent - Jupyter Integration
 *
 * Manages connection to Jupyter Lab server:
 * - Check server status
 * - Get launch URL with token
 * - Health checks
 */

import { existsSync, mkdirSync } from 'fs';

// ============================================
// Types
// ============================================

export interface JupyterStatus {
  isRunning: boolean;
  url: string;
  port: number;
  token?: string;
  version?: string;
  error?: string;
}

export interface JupyterConfig {
  url: string;
  port: number;
  token: string;
  notebookDir: string;
}

// ============================================
// Jupyter Integration
// ============================================

export class JupyterIntegration {
  private url: string;
  private port: number;
  private token: string;
  private notebookDir: string;

  constructor() {
    this.port = parseInt(process.env.JUPYTER_PORT || '8888', 10);
    this.url = process.env.JUPYTER_URL || `http://localhost:${this.port}`;
    this.token = process.env.JUPYTER_TOKEN || '';
    this.notebookDir = process.env.JUPYTER_NOTEBOOK_DIR || './storage/notebooks';

    // Ensure notebook directory exists
    if (!existsSync(this.notebookDir)) {
      mkdirSync(this.notebookDir, { recursive: true });
      console.log(`[Jupyter] Created notebook directory: ${this.notebookDir}`);
    }
  }

  /**
   * Check if Jupyter integration is configured
   */
  isConfigured(): boolean {
    return Boolean(this.url);
  }

  /**
   * Get current configuration
   */
  getConfig(): JupyterConfig {
    return {
      url: this.url,
      port: this.port,
      token: this.token,
      notebookDir: this.notebookDir,
    };
  }

  /**
   * Check if Jupyter server is running
   */
  async checkStatus(): Promise<JupyterStatus> {
    try {
      // Try to reach the Jupyter API endpoint
      const apiUrl = `${this.url}/api`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(apiUrl, {
        signal: controller.signal,
        headers: this.token ? { Authorization: `token ${this.token}` } : {},
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        return {
          isRunning: true,
          url: this.url,
          port: this.port,
          token: this.token || undefined,
          version: data.version,
        };
      } else {
        return {
          isRunning: false,
          url: this.url,
          port: this.port,
          error: `Server returned ${response.status}`,
        };
      }
    } catch (error) {
      // Server not reachable
      return {
        isRunning: false,
        url: this.url,
        port: this.port,
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /**
   * Get the launch URL for Jupyter Lab
   */
  getLaunchUrl(): string {
    let url = this.url;

    // Append token if configured
    if (this.token) {
      url += `?token=${this.token}`;
    }

    return url;
  }

  /**
   * Get the lab URL (Jupyter Lab interface)
   */
  getLabUrl(): string {
    let url = `${this.url}/lab`;

    if (this.token) {
      url += `?token=${this.token}`;
    }

    return url;
  }

  /**
   * Get URL for a specific notebook
   */
  getNotebookUrl(notebookPath: string): string {
    // Remove the base notebook directory if present
    const relativePath = notebookPath.replace(this.notebookDir, '').replace(/^\//, '');

    let url = `${this.url}/lab/tree/${encodeURIComponent(relativePath)}`;

    if (this.token) {
      url += `?token=${this.token}`;
    }

    return url;
  }

  /**
   * Get the notebook directory path
   */
  getNotebookDir(): string {
    return this.notebookDir;
  }

  /**
   * List running kernels (if server is available)
   */
  async listKernels(): Promise<{ id: string; name: string; lastActivity: string }[]> {
    try {
      const response = await fetch(`${this.url}/api/kernels`, {
        headers: this.token ? { Authorization: `token ${this.token}` } : {},
      });

      if (response.ok) {
        return await response.json();
      }

      return [];
    } catch {
      return [];
    }
  }

  /**
   * List active sessions (if server is available)
   */
  async listSessions(): Promise<
    { id: string; path: string; name: string; kernel: { id: string; name: string } }[]
  > {
    try {
      const response = await fetch(`${this.url}/api/sessions`, {
        headers: this.token ? { Authorization: `token ${this.token}` } : {},
      });

      if (response.ok) {
        return await response.json();
      }

      return [];
    } catch {
      return [];
    }
  }
}

// Export singleton instance
export const jupyterIntegration = new JupyterIntegration();
