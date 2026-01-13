import { useState } from 'react';
import {
  useCeremonyStatus,
  useCeremonyConfig,
  useTestCeremony,
  usePreviewCeremony,
  useSettingsClasses,
  useAddSettingsClass,
  useDeleteClass,
} from '../hooks/useSettings';
import {
  useRemarkableCloudStatus,
  useRemarkableDocuments,
  useSyncRemarkableCloud,
  useRenderRemarkableDocument,
  useStartRemarkablePolling,
  useStopRemarkablePolling,
} from '../hooks/useIntegrations';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';

function Settings() {
  const [activeTab, setActiveTab] = useState<'ceremonies' | 'notifications' | 'classes' | 'integrations'>('ceremonies');
  const [classForm, setClassForm] = useState({ name: '', courseCode: '', professor: '' });
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [renderingDocId, setRenderingDocId] = useState<string | null>(null);

  const { data: ceremonyStatus, isLoading: loadingStatus } = useCeremonyStatus();
  const { data: ceremonyConfig } = useCeremonyConfig();
  const { data: classes } = useSettingsClasses();

  // Remarkable integration hooks
  const { data: remarkableStatus, isLoading: loadingRemarkable } = useRemarkableCloudStatus();
  const { data: remarkableDocuments } = useRemarkableDocuments();
  const syncRemarkable = useSyncRemarkableCloud();
  const renderDocument = useRenderRemarkableDocument();
  const startPolling = useStartRemarkablePolling();
  const stopPolling = useStopRemarkablePolling();

  const testCeremony = useTestCeremony();
  const previewCeremony = usePreviewCeremony();
  const addClass = useAddSettingsClass();
  const deleteClass = useDeleteClass();

  const handleTestCeremony = async (type: string) => {
    try {
      const result = await testCeremony.mutateAsync(type);
      alert(`Test ${type} ceremony sent via ${result.channel}!`);
    } catch (error) {
      alert(`Failed to send test: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handlePreviewCeremony = async (type: string) => {
    try {
      const result = await previewCeremony.mutateAsync(type);
      setPreviewContent(result.formatted);
      setShowPreview(true);
    } catch (error) {
      alert(`Failed to preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAddClass = async () => {
    if (!classForm.name || !classForm.courseCode) {
      alert('Name and course code are required');
      return;
    }
    try {
      await addClass.mutateAsync(classForm);
      setClassForm({ name: '', courseCode: '', professor: '' });
    } catch (error) {
      alert(`Failed to add class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm('Are you sure you want to delete this class?')) return;
    try {
      await deleteClass.mutateAsync(id);
    } catch (error) {
      alert(`Failed to delete class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Remarkable handlers
  const handleSyncRemarkable = async () => {
    try {
      const result = await syncRemarkable.mutateAsync();
      alert(`Sync complete! Found ${result.documentsFound} documents, ${result.changes.length} changes.`);
    } catch (error) {
      alert(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRenderDocument = async (docId: string) => {
    setRenderingDocId(docId);
    try {
      const result = await renderDocument.mutateAsync(docId);
      alert(`PDF rendered: ${result.documentName}\nPath: ${result.pdfPath}`);
    } catch (error) {
      alert(`Render failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRenderingDocId(null);
    }
  };

  const handleTogglePolling = async () => {
    try {
      if (remarkableStatus?.polling) {
        await stopPolling.mutateAsync();
        alert('Stopped automatic syncing');
      } else {
        await startPolling.mutateAsync(30);
        alert('Started automatic syncing (every 30 minutes)');
      }
    } catch (error) {
      alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-text-muted mt-1">Configure your JD Agent preferences</p>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="flex space-x-4 border-b border-dark-border pb-3">
          <button
            onClick={() => setActiveTab('ceremonies')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'ceremonies'
                ? 'bg-accent text-white'
                : 'hover:bg-dark-card-hover text-text-muted'
            }`}
          >
            Ceremonies
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'notifications'
                ? 'bg-accent text-white'
                : 'hover:bg-dark-card-hover text-text-muted'
            }`}
          >
            Notifications
          </button>
          <button
            onClick={() => setActiveTab('classes')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'classes'
                ? 'bg-accent text-white'
                : 'hover:bg-dark-card-hover text-text-muted'
            }`}
          >
            Classes
          </button>
          <button
            onClick={() => setActiveTab('integrations')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'integrations'
                ? 'bg-accent text-white'
                : 'hover:bg-dark-card-hover text-text-muted'
            }`}
          >
            Integrations
          </button>
        </div>

        {/* Ceremonies Tab */}
        {activeTab === 'ceremonies' && (
          <div className="space-y-6 pt-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Daily Ceremonies</h2>
              <p className="text-text-muted mb-6">
                Manage your daily briefings and reviews. These ceremonies help you start and end your day with clarity.
              </p>
            </div>

            <div className="space-y-4">
              {/* Morning Briefing */}
              <div className="bg-dark-card-hover p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">🌅 Morning Briefing</h3>
                    <p className="text-sm text-text-muted">
                      Daily at {ceremonyConfig?.morningTime || '6:00 AM'}
                    </p>
                    {ceremonyStatus?.lastCeremonies.morning && (
                      <p className="text-xs text-text-muted mt-1">
                        Last sent: {new Date(ceremonyStatus.lastCeremonies.morning.sentAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="ghost" onClick={() => handlePreviewCeremony('morning')}>
                      Preview
                    </Button>
                    <Button variant="secondary" onClick={() => handleTestCeremony('morning')}>
                      Test Now
                    </Button>
                  </div>
                </div>
              </div>

              {/* Evening Review */}
              <div className="bg-dark-card-hover p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">🌙 Evening Review</h3>
                    <p className="text-sm text-text-muted">
                      Daily at {ceremonyConfig?.eveningTime || '9:00 PM'}
                    </p>
                    {ceremonyStatus?.lastCeremonies.evening && (
                      <p className="text-xs text-text-muted mt-1">
                        Last sent: {new Date(ceremonyStatus.lastCeremonies.evening.sentAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="ghost" onClick={() => handlePreviewCeremony('evening')}>
                      Preview
                    </Button>
                    <Button variant="secondary" onClick={() => handleTestCeremony('evening')}>
                      Test Now
                    </Button>
                  </div>
                </div>
              </div>

              {/* Weekly Planning */}
              <div className="bg-dark-card-hover p-4 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">📅 Weekly Planning</h3>
                    <p className="text-sm text-text-muted">
                      {ceremonyConfig?.weeklyDay} at {ceremonyConfig?.weeklyTime || '4:00 PM'}
                    </p>
                    {ceremonyStatus?.lastCeremonies.weekly && (
                      <p className="text-xs text-text-muted mt-1">
                        Last sent: {new Date(ceremonyStatus.lastCeremonies.weekly.sentAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="ghost" onClick={() => handlePreviewCeremony('weekly')}>
                      Preview
                    </Button>
                    <Button variant="secondary" onClick={() => handleTestCeremony('weekly')}>
                      Test Now
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6 pt-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Notification Channels</h2>
              <p className="text-text-muted mb-6">
                Configure how you receive your ceremony notifications and alerts.
              </p>
            </div>

            <div className="space-y-4">
              {ceremonyConfig?.notificationChannels && (
                <>
                  {/* Telegram */}
                  <div className="bg-dark-card-hover p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">📱 Telegram</h3>
                        <p className="text-sm text-text-muted">
                          {ceremonyConfig.notificationChannels.telegram.configured
                            ? `Chat ID: ${ceremonyConfig.notificationChannels.telegram.chatId}`
                            : 'Not configured'}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded text-sm ${
                          ceremonyConfig.notificationChannels.telegram.configured
                            ? 'bg-success/20 text-success'
                            : 'bg-error/20 text-error'
                        }`}
                      >
                        {ceremonyConfig.notificationChannels.telegram.configured ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {/* SMS */}
                  <div className="bg-dark-card-hover p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">📲 SMS (Twilio)</h3>
                        <p className="text-sm text-text-muted">
                          {ceremonyConfig.notificationChannels.sms.configured
                            ? `Phone: ${ceremonyConfig.notificationChannels.sms.phoneNumber}`
                            : 'Not configured'}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded text-sm ${
                          ceremonyConfig.notificationChannels.sms.configured
                            ? 'bg-success/20 text-success'
                            : 'bg-error/20 text-error'
                        }`}
                      >
                        {ceremonyConfig.notificationChannels.sms.configured ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="bg-dark-card-hover p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">📧 Email (Resend)</h3>
                        <p className="text-sm text-text-muted">
                          {ceremonyConfig.notificationChannels.email.configured
                            ? `Email: ${ceremonyConfig.notificationChannels.email.email}`
                            : 'Not configured'}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded text-sm ${
                          ceremonyConfig.notificationChannels.email.configured
                            ? 'bg-success/20 text-success'
                            : 'bg-error/20 text-error'
                        }`}
                      >
                        {ceremonyConfig.notificationChannels.email.configured ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="bg-info/10 border border-info/20 p-4 rounded-lg">
              <p className="text-sm text-text-muted">
                ℹ️ To configure notification channels, update your environment variables and restart the server.
              </p>
            </div>
          </div>
        )}

        {/* Classes Tab */}
        {activeTab === 'classes' && (
          <div className="space-y-6 pt-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Your Classes</h2>
              <p className="text-text-muted mb-6">
                Manage your course schedule and link them to Canvas for automatic assignment tracking.
              </p>
            </div>

            {/* Add Class Form */}
            <div className="bg-dark-card-hover p-4 rounded-lg">
              <h3 className="font-semibold mb-4">Add New Class</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <input
                  type="text"
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  placeholder="Class name (e.g., Data Structures)"
                  className="input"
                />
                <input
                  type="text"
                  value={classForm.courseCode}
                  onChange={(e) => setClassForm({ ...classForm, courseCode: e.target.value })}
                  placeholder="Course code (e.g., CS 201)"
                  className="input"
                />
                <input
                  type="text"
                  value={classForm.professor}
                  onChange={(e) => setClassForm({ ...classForm, professor: e.target.value })}
                  placeholder="Professor (optional)"
                  className="input"
                />
              </div>
              <Button onClick={handleAddClass} disabled={addClass.isPending}>
                Add Class
              </Button>
            </div>

            {/* Class List */}
            {classes && classes.length > 0 ? (
              <div className="space-y-3">
                <h3 className="font-semibold">Current Classes ({classes.length})</h3>
                {classes.map((cls) => (
                  <div key={cls.id} className="bg-dark-card-hover p-4 rounded-lg flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold">{cls.name}</h4>
                      <p className="text-sm text-text-muted">
                        {cls.courseCode}
                        {cls.professor && ` • ${cls.professor}`}
                        {cls.canvasCourseId && ` • Linked to Canvas`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => handleDeleteClass(cls.id)}
                      disabled={deleteClass.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-dark-card-hover rounded-lg">
                <p className="text-text-muted">No classes added yet. Add your first class above!</p>
              </div>
            )}
          </div>
        )}

        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <div className="space-y-6 pt-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Integrations</h2>
              <p className="text-text-muted mb-6">
                Manage your external service connections and data sync settings.
              </p>
            </div>

            {/* Remarkable Cloud Integration */}
            <div className="bg-dark-card-hover p-4 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📝</span>
                  <div>
                    <h3 className="font-semibold text-lg">Remarkable Cloud</h3>
                    <p className="text-sm text-text-muted">
                      Sync handwritten notes from your Remarkable tablet
                    </p>
                  </div>
                </div>
                <span
                  className={`px-3 py-1 rounded text-sm ${
                    remarkableStatus?.configured
                      ? 'bg-success/20 text-success'
                      : 'bg-error/20 text-error'
                  }`}
                >
                  {remarkableStatus?.configured ? 'Connected' : 'Not Configured'}
                </span>
              </div>

              {loadingRemarkable ? (
                <div className="flex justify-center py-4">
                  <LoadingSpinner size="sm" />
                </div>
              ) : remarkableStatus?.configured ? (
                <div className="space-y-4">
                  {/* Status Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-dark-card p-3 rounded">
                      <p className="text-text-muted">Documents</p>
                      <p className="text-xl font-semibold">{remarkableStatus.documentCount}</p>
                    </div>
                    <div className="bg-dark-card p-3 rounded">
                      <p className="text-text-muted">Auto Sync</p>
                      <p className="text-xl font-semibold">{remarkableStatus.polling ? 'On' : 'Off'}</p>
                    </div>
                    <div className="bg-dark-card p-3 rounded">
                      <p className="text-text-muted">Last Sync</p>
                      <p className="text-sm font-semibold">
                        {remarkableStatus.lastSync
                          ? new Date(remarkableStatus.lastSync).toLocaleString()
                          : 'Never'}
                      </p>
                    </div>
                    <div className="bg-dark-card p-3 rounded">
                      <p className="text-text-muted">Token Valid</p>
                      <p className="text-xl font-semibold">
                        {remarkableStatus.hasValidUserToken ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={handleSyncRemarkable}
                      disabled={syncRemarkable.isPending}
                    >
                      {syncRemarkable.isPending ? 'Syncing...' : 'Sync Now'}
                    </Button>
                    <Button
                      variant={remarkableStatus.polling ? 'ghost' : 'secondary'}
                      onClick={handleTogglePolling}
                      disabled={startPolling.isPending || stopPolling.isPending}
                    >
                      {remarkableStatus.polling ? 'Stop Auto Sync' : 'Start Auto Sync'}
                    </Button>
                  </div>

                  {/* Recent Documents */}
                  {remarkableDocuments && remarkableDocuments.length > 0 && (
                    <div className="mt-4">
                      <h4 className="font-semibold mb-2">Recent Documents</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {remarkableDocuments.slice(0, 10).map((doc) => (
                          <div
                            key={doc.id}
                            className="bg-dark-card p-3 rounded flex justify-between items-center"
                          >
                            <div>
                              <p className="font-medium">{doc.name}</p>
                              <p className="text-xs text-text-muted">
                                Modified: {new Date(doc.lastModified).toLocaleString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              onClick={() => handleRenderDocument(doc.id)}
                              disabled={renderingDocId === doc.id}
                            >
                              {renderingDocId === doc.id ? 'Rendering...' : 'Render PDF'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-info/10 border border-info/20 p-4 rounded-lg">
                  <p className="text-sm text-text-muted">
                    To configure Remarkable Cloud sync, set <code className="bg-dark-card px-1 rounded">REMARKABLE_DEVICE_TOKEN</code> in your environment variables.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && previewContent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="card max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Ceremony Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-text-muted hover:text-text"
              >
                ✕
              </button>
            </div>
            <div className="bg-dark-card-hover p-4 rounded-lg">
              <pre className="whitespace-pre-wrap text-sm font-mono text-text-muted">
                {previewContent}
              </pre>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={() => setShowPreview(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
