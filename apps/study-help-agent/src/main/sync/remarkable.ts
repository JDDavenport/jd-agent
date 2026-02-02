/**
 * Remarkable Sync - Syncs notes from Remarkable Cloud
 */

export class RemarkableSync {
  private apiBase: string;
  private sessionToken: string;
  private deviceToken: string;

  constructor(apiBase: string, sessionToken: string, deviceToken: string) {
    this.apiBase = apiBase;
    this.sessionToken = sessionToken;
    this.deviceToken = deviceToken;
  }

  /**
   * Trigger sync via backend
   */
  async sync(): Promise<{ notes: number; pages: number }> {
    const response = await fetch(`${this.apiBase}/api/sync/remarkable/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `study_help_session=${this.sessionToken}`,
      },
    });

    const json = await response.json();

    if (!json.success) {
      throw new Error(json.error?.message || 'Remarkable sync failed');
    }

    return {
      notes: json.data.notes || 0,
      pages: json.data.pages || 0,
    };
  }

  /**
   * Get sync status
   */
  async getStatus(): Promise<{ connected: boolean; noteCount: number; lastSync: string | null }> {
    const response = await fetch(`${this.apiBase}/api/sync/remarkable/status`, {
      headers: {
        'Cookie': `study_help_session=${this.sessionToken}`,
      },
    });

    const json = await response.json();

    if (!json.success) {
      throw new Error(json.error?.message || 'Failed to get Remarkable status');
    }

    return json.data;
  }
}
