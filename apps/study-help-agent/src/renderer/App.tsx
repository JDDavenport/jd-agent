import { useState, useEffect, useCallback } from 'react';

// Type declarations for API exposed by preload
declare global {
  interface Window {
    api: {
      login: (email: string, password: string) => Promise<{ success: boolean; user?: any; error?: string }>;
      logout: () => Promise<{ success: boolean }>;
      getStatus: () => Promise<AppStatus>;
      setCanvasToken: (token: string, url?: string) => Promise<{ success: boolean; coursesFound?: number; error?: string }>;
      selectPlaudFolder: () => Promise<{ success: boolean; path?: string; error?: string; cancelled?: boolean }>;
      setRemarkableToken: (token: string) => Promise<{ success: boolean; error?: string }>;
      triggerSync: () => Promise<{ success: boolean }>;
      openExternal: (url: string) => void;
      onSyncStatus: (callback: (status: SyncStatus) => void) => () => void;
      onLastSync: (callback: (lastSync: LastSync) => void) => () => void;
    };
  }
}

interface SyncStatus {
  canvas: 'idle' | 'syncing' | 'error' | 'connected';
  plaud: 'idle' | 'watching' | 'error' | 'syncing';
  remarkable: 'idle' | 'syncing' | 'error' | 'connected';
  lastError: string | null;
}

interface LastSync {
  canvas: string | null;
  plaud: string | null;
  remarkable: string | null;
}

interface Config {
  hasCanvasToken: boolean;
  hasPlaudPath: boolean;
  hasRemarkableToken: boolean;
  plaudPath: string | null;
  canvasUrl: string;
}

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface AppStatus {
  syncStatus: SyncStatus;
  lastSync: LastSync;
  user: User | null;
  config: Config;
}

// Status badge component
function StatusBadge({ status, type }: { status: string; type: 'canvas' | 'plaud' | 'remarkable' }) {
  const labels = {
    idle: { text: 'Not connected', color: 'bg-gray-200 text-gray-600' },
    connected: { text: 'Connected', color: 'bg-green-100 text-green-700' },
    watching: { text: 'Watching', color: 'bg-green-100 text-green-700' },
    syncing: { text: 'Syncing...', color: 'bg-blue-100 text-blue-700' },
    error: { text: 'Error', color: 'bg-red-100 text-red-700' },
  };
  
  const label = labels[status as keyof typeof labels] || labels.idle;
  
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${label.color}`}>
      {label.text}
    </span>
  );
}

// Login form
function LoginForm({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="p-6">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-gray-900">Study Aide</h1>
        <p className="text-sm text-gray-500 mt-1">Sign in to sync your materials</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="your@email.edu"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="••••••••"
            required
          />
        </div>
        
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
        
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      
      <div className="mt-4 text-center">
        <button
          onClick={() => window.api.openExternal('https://www.studyaide.app/signup')}
          className="text-sm text-blue-600 hover:underline"
        >
          Don't have an account? Sign up
        </button>
      </div>
    </div>
  );
}

// Source setup card
function SourceCard({ 
  title, 
  icon, 
  status, 
  type,
  description,
  isConfigured,
  configDetails,
  onSetup,
  setupLabel = 'Connect',
}: {
  title: string;
  icon: string;
  status: string;
  type: 'canvas' | 'plaud' | 'remarkable';
  description: string;
  isConfigured: boolean;
  configDetails?: string;
  onSetup: () => void;
  setupLabel?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="font-medium text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>
        <StatusBadge status={status} type={type} />
      </div>
      
      {isConfigured && configDetails && (
        <p className="mt-2 text-xs text-gray-500 truncate">{configDetails}</p>
      )}
      
      <div className="mt-3">
        {!isConfigured ? (
          <button
            onClick={onSetup}
            className="w-full py-1.5 px-3 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
          >
            {setupLabel}
          </button>
        ) : (
          <button
            onClick={onSetup}
            className="w-full py-1.5 px-3 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Reconfigure
          </button>
        )}
      </div>
    </div>
  );
}

// Canvas setup modal
function CanvasSetupModal({ onClose, onSubmit }: { 
  onClose: () => void; 
  onSubmit: (token: string, url: string) => Promise<void>;
}) {
  const [token, setToken] = useState('');
  const [url, setUrl] = useState('https://byu.instructure.com');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await onSubmit(token, url);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-bold mb-4">Connect Canvas</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Canvas URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="https://yourschool.instructure.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Access Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder="Paste your Canvas token"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Get this from Canvas → Settings → New Access Token
            </p>
          </div>
          
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>
          )}
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !token}
              className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Main dashboard
function Dashboard({ 
  user, 
  status, 
  config,
  lastSync,
  onLogout,
  onCanvasSetup,
  onPlaudSetup,
  onRemarkableSetup,
  onSync,
}: {
  user: User;
  status: SyncStatus;
  config: Config;
  lastSync: LastSync;
  onLogout: () => void;
  onCanvasSetup: () => void;
  onPlaudSetup: () => void;
  onRemarkableSetup: () => void;
  onSync: () => void;
}) {
  const sourcesConnected = [config.hasCanvasToken, config.hasPlaudPath, config.hasRemarkableToken].filter(Boolean).length;
  const isSyncing = status.canvas === 'syncing' || status.plaud === 'syncing' || status.remarkable === 'syncing';
  
  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">Study Aide</h1>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      </div>
      
      {/* Sources */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Connected Sources</span>
          <span className="text-xs text-gray-500">{sourcesConnected}/3</span>
        </div>
        
        <SourceCard
          title="Canvas LMS"
          icon="📚"
          status={status.canvas}
          type="canvas"
          description="Courses, assignments, materials"
          isConfigured={config.hasCanvasToken}
          configDetails={config.canvasUrl}
          onSetup={onCanvasSetup}
        />
        
        <SourceCard
          title="Plaud"
          icon="🎙️"
          status={status.plaud}
          type="plaud"
          description="Lecture recordings & transcripts"
          isConfigured={config.hasPlaudPath}
          configDetails={config.plaudPath || undefined}
          onSetup={onPlaudSetup}
          setupLabel="Select Folder"
        />
        
        <SourceCard
          title="Remarkable"
          icon="📝"
          status={status.remarkable}
          type="remarkable"
          description="Handwritten notes"
          isConfigured={config.hasRemarkableToken}
          onSetup={onRemarkableSetup}
        />
        
        {status.lastError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {status.lastError}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-white space-y-2">
        <button
          onClick={onSync}
          disabled={sourcesConnected === 0 || isSyncing}
          className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSyncing ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Syncing...
            </>
          ) : (
            'Sync Now'
          )}
        </button>
        
        <button
          onClick={() => window.api.openExternal('https://www.studyaide.app')}
          className="w-full py-2 px-4 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
        >
          Open Study Aide Web →
        </button>
      </div>
    </div>
  );
}

// Main App
export default function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCanvasModal, setShowCanvasModal] = useState(false);
  
  // Load initial status
  useEffect(() => {
    window.api.getStatus().then((s) => {
      setStatus(s);
      setLoading(false);
    });
    
    // Listen for updates
    const unsubStatus = window.api.onSyncStatus((syncStatus) => {
      setStatus((prev) => prev ? { ...prev, syncStatus } : null);
    });
    
    const unsubLastSync = window.api.onLastSync((lastSync) => {
      setStatus((prev) => prev ? { ...prev, lastSync } : null);
    });
    
    return () => {
      unsubStatus();
      unsubLastSync();
    };
  }, []);
  
  const handleLogin = useCallback(async (email: string, password: string) => {
    const result = await window.api.login(email, password);
    if (!result.success) {
      throw new Error(result.error || 'Login failed');
    }
    // Refresh status
    const newStatus = await window.api.getStatus();
    setStatus(newStatus);
  }, []);
  
  const handleLogout = useCallback(async () => {
    await window.api.logout();
    const newStatus = await window.api.getStatus();
    setStatus(newStatus);
  }, []);
  
  const handleCanvasSetup = useCallback(async (token: string, url: string) => {
    const result = await window.api.setCanvasToken(token, url);
    if (!result.success) {
      throw new Error(result.error || 'Failed to connect Canvas');
    }
    const newStatus = await window.api.getStatus();
    setStatus(newStatus);
  }, []);
  
  const handlePlaudSetup = useCallback(async () => {
    const result = await window.api.selectPlaudFolder();
    if (!result.success && !result.cancelled) {
      alert(result.error || 'Failed to select folder');
    }
    if (result.success) {
      const newStatus = await window.api.getStatus();
      setStatus(newStatus);
    }
  }, []);
  
  const handleRemarkableSetup = useCallback(async () => {
    // For now, open web setup
    window.api.openExternal('https://www.studyaide.app/settings/remarkable');
  }, []);
  
  const handleSync = useCallback(async () => {
    await window.api.triggerSync();
  }, []);
  
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }
  
  // Not logged in
  if (!status?.user) {
    return <LoginForm onLogin={handleLogin} />;
  }
  
  return (
    <>
      <Dashboard
        user={status.user}
        status={status.syncStatus}
        config={status.config}
        lastSync={status.lastSync}
        onLogout={handleLogout}
        onCanvasSetup={() => setShowCanvasModal(true)}
        onPlaudSetup={handlePlaudSetup}
        onRemarkableSetup={handleRemarkableSetup}
        onSync={handleSync}
      />
      
      {showCanvasModal && (
        <CanvasSetupModal
          onClose={() => setShowCanvasModal(false)}
          onSubmit={handleCanvasSetup}
        />
      )}
    </>
  );
}
