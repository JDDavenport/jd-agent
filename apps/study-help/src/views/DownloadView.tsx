import { useState } from 'react';

export function DownloadView() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    // In production, this would be a real download URL
    window.location.href = '/downloads/StudyAide-1.0.0.dmg';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Study Aide Desktop</h1>
          <p className="text-gray-600 mt-2">
            Sync your learning materials automatically
          </p>
        </div>

        {/* Features */}
        <div className="space-y-4 mb-8">
          <Feature
            icon="📚"
            title="Canvas LMS"
            description="Sync courses, assignments, and materials"
          />
          <Feature
            icon="🎙️"
            title="Plaud Recordings"
            description="Automatically upload lecture transcripts"
          />
          <Feature
            icon="📝"
            title="Remarkable Notes"
            description="Sync your handwritten notes"
          />
        </div>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="w-full py-4 px-6 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {downloading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Downloading...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download for macOS
            </>
          )}
        </button>

        {/* Version Info */}
        <p className="text-center text-sm text-gray-500 mt-4">
          Version 1.0.0 • macOS 12.0+
        </p>

        {/* Requirements */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">System Requirements</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• macOS 12.0 (Monterey) or later</li>
            <li>• 100 MB disk space</li>
            <li>• Internet connection for sync</li>
          </ul>
        </div>

        {/* Installation Instructions */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">How to Install</h3>
          <ol className="text-sm text-gray-600 space-y-2">
            <li>1. Open the downloaded .dmg file</li>
            <li>2. Drag Study Aide to Applications</li>
            <li>3. Open Study Aide from your menu bar</li>
            <li>4. Sign in with your Study Aide account</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <h3 className="font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
    </div>
  );
}
