/**
 * Canvas Syncer - Fetches courses and content from Canvas LMS
 */

export class CanvasSyncer {
  private apiBase: string;
  private sessionToken: string;
  private canvasToken: string;
  private canvasUrl: string;

  constructor(apiBase: string, sessionToken: string, canvasToken: string, canvasUrl?: string) {
    this.apiBase = apiBase;
    this.sessionToken = sessionToken;
    this.canvasToken = canvasToken;
    this.canvasUrl = canvasUrl || 'https://byu.instructure.com';
  }

  /**
   * Trigger full sync via backend
   */
  async sync(): Promise<{ courses: number; assignments: number; content: number }> {
    const response = await fetch(`${this.apiBase}/api/canvas/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `study_help_session=${this.sessionToken}`,
      },
    });

    const json = await response.json();

    if (!json.success) {
      throw new Error(json.error?.message || 'Canvas sync failed');
    }

    return {
      courses: json.data.courses || 0,
      assignments: json.data.assignments || 0,
      content: json.data.chunksCreated || 0,
    };
  }

  /**
   * Get sync status
   */
  async getStatus(): Promise<{ connected: boolean; courseCount: number; lastSync: string | null }> {
    const response = await fetch(`${this.apiBase}/api/canvas/status`, {
      headers: {
        'Cookie': `study_help_session=${this.sessionToken}`,
      },
    });

    const json = await response.json();

    if (!json.success) {
      throw new Error(json.error?.message || 'Failed to get Canvas status');
    }

    return json.data;
  }
}
