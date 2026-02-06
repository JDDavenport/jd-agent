/**
 * Canvas Onboarding Flow
 * 
 * Multi-step wizard:
 * 1. Enter school Canvas URL
 * 2. Instructions to generate token
 * 3. Paste token + validate
 * 4. Select courses to sync
 * 5. Sync progress + completion
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import {
  AcademicCapIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  ClipboardDocumentIcon,
  LinkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import {
  connectCanvas,
  triggerSync,
  getCanvasStatus,
  type CanvasCoursePreview,
  type CanvasProfile,
  type SyncResult,
} from '../api/canvas';
import { setCanvasTokenGetter } from '../api/canvas';

type Step = 'url' | 'instructions' | 'token' | 'courses' | 'syncing' | 'done';

export function CanvasConnectView() {
  const { getToken } = useAuth();
  const navigate = useNavigate();

  // Wire up the token getter for canvas API calls
  useEffect(() => {
    setCanvasTokenGetter(() => getToken());
  }, [getToken]);

  const [step, setStep] = useState<Step>('url');
  const [canvasUrl, setCanvasUrl] = useState('');
  const [canvasToken, setCanvasToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<CanvasProfile | null>(null);
  const [courses, setCourses] = useState<CanvasCoursePreview[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [alreadyConnected, setAlreadyConnected] = useState(false);

  // Check if already connected
  useEffect(() => {
    getCanvasStatus().then(status => {
      if (status.connected) {
        setAlreadyConnected(true);
      }
    }).catch(() => {});
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await connectCanvas(canvasUrl, canvasToken);
      setProfile(result.profile);
      setCourses(result.courses);
      // Select all courses by default
      setSelectedCourseIds(new Set(result.courses.map(c => c.id)));
      setStep('courses');
    } catch (e: any) {
      setError(e.message || 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setStep('syncing');
    setError(null);
    try {
      const courseIds = Array.from(selectedCourseIds);
      const result = await triggerSync(courseIds);
      setSyncResult(result);
      setStep('done');
    } catch (e: any) {
      setError(e.message || 'Sync failed');
      setStep('courses'); // Go back
    }
  };

  const toggleCourse = (id: string) => {
    setSelectedCourseIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Common school URLs
  const commonSchools = [
    { name: 'BYU', url: 'byu.instructure.com' },
    { name: 'Utah', url: 'utah.instructure.com' },
    { name: 'USU', url: 'usu.instructure.com' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 mb-4">
            <AcademicCapIcon className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Connect Your Canvas</h1>
          <p className="text-gray-500 mt-1">
            Import all your courses, assignments, and materials
          </p>
        </div>

        {/* Already connected banner */}
        {alreadyConnected && step === 'url' && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 flex items-start gap-3">
            <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-800">Canvas is already connected!</p>
              <p className="text-sm text-green-600 mt-1">
                You can reconnect with a new token or{' '}
                <button onClick={() => navigate('/')} className="underline font-medium">
                  go to your dashboard
                </button>.
              </p>
            </div>
          </div>
        )}

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(['url', 'instructions', 'token', 'courses', 'done'] as Step[]).map((s, i) => (
            <div
              key={s}
              className={clsx(
                'w-2.5 h-2.5 rounded-full transition-colors',
                step === s ? 'bg-blue-600 scale-125' :
                ['url', 'instructions', 'token', 'courses', 'done'].indexOf(step) > i
                  ? 'bg-blue-400'
                  : 'bg-gray-200'
              )}
            />
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Something went wrong</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        )}

        {/* Step 1: School URL */}
        {step === 'url' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Your School's Canvas URL</h2>
            <p className="text-sm text-gray-500 mb-4">
              Enter the URL you use to access Canvas at your school.
            </p>

            <div className="relative">
              <LinkIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={canvasUrl}
                onChange={e => setCanvasUrl(e.target.value)}
                placeholder="yourschool.instructure.com"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900 placeholder-gray-400"
                onKeyDown={e => e.key === 'Enter' && canvasUrl && setStep('instructions')}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {commonSchools.map(s => (
                <button
                  key={s.url}
                  onClick={() => setCanvasUrl(s.url)}
                  className={clsx(
                    'px-3 py-1 text-xs rounded-full border transition-colors',
                    canvasUrl === s.url
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep('instructions')}
              disabled={!canvasUrl.trim()}
              className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Continue
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Step 2: Instructions */}
        {step === 'instructions' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Generate an Access Token</h2>
            <p className="text-sm text-gray-500 mb-6">
              Follow these steps in Canvas to create a personal access token.
            </p>

            <div className="space-y-4">
              {[
                {
                  num: 1,
                  title: 'Log into Canvas',
                  desc: `Go to https://${canvasUrl} and log in.`,
                },
                {
                  num: 2,
                  title: 'Open Account Settings',
                  desc: 'Click on "Account" in the left sidebar, then "Settings".',
                },
                {
                  num: 3,
                  title: 'Create Access Token',
                  desc: 'Scroll to "Approved Integrations" → click "+ New Access Token".',
                },
                {
                  num: 4,
                  title: 'Name it & Generate',
                  desc: 'Type "Study Aide" as the purpose. Click "Generate Token".',
                },
                {
                  num: 5,
                  title: 'Copy the Token',
                  desc: "Copy the token shown. You won't be able to see it again!",
                },
              ].map(s => (
                <div key={s.num} className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">
                    {s.num}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.title}</p>
                    <p className="text-sm text-gray-500">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <a
              href={`https://${canvasUrl}/profile/settings`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 block w-full text-center px-4 py-2.5 rounded-xl border-2 border-blue-200 text-blue-600 font-medium hover:bg-blue-50 transition-colors"
            >
              Open Canvas Settings ↗
            </a>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setStep('url')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={() => setStep('token')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
              >
                I have my token
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Token Input */}
        {step === 'token' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Paste Your Token</h2>
            <p className="text-sm text-gray-500 mb-4">
              Paste the access token you copied from Canvas.
            </p>

            <div className="relative">
              <ClipboardDocumentIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
              <input
                type="password"
                value={canvasToken}
                onChange={e => setCanvasToken(e.target.value)}
                placeholder="Paste your Canvas access token"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-gray-900 placeholder-gray-400 font-mono text-sm"
                onKeyDown={e => e.key === 'Enter' && canvasToken && handleConnect()}
              />
            </div>

            <p className="mt-2 text-xs text-gray-400">
              🔒 Your token is encrypted and stored securely. You can revoke it anytime from Canvas.
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep('instructions')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={handleConnect}
                disabled={!canvasToken.trim() || loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    Connect
                    <ArrowRightIcon className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Course Selection */}
        {step === 'courses' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            {profile && (
              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-green-50 border border-green-200">
                <CheckCircleIcon className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-green-800">
                    Connected as {profile.name}
                  </p>
                </div>
              </div>
            )}

            <h2 className="text-lg font-semibold text-gray-900 mb-1">Select Your Courses</h2>
            <p className="text-sm text-gray-500 mb-4">
              Choose which courses to sync. We'll pull assignments, readings, files, and more.
            </p>

            {courses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No active courses found.</p>
                <p className="text-sm mt-1">Make sure you're enrolled in courses for the current term.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Select all */}
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCourseIds.size === courses.length}
                    onChange={() => {
                      if (selectedCourseIds.size === courses.length) {
                        setSelectedCourseIds(new Set());
                      } else {
                        setSelectedCourseIds(new Set(courses.map(c => c.id)));
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Select All ({courses.length})</span>
                </label>

                <div className="border-t border-gray-100" />

                {courses.map(course => (
                  <label
                    key={course.id}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCourseIds.has(course.id)}
                      onChange={() => toggleCourse(course.id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{course.name}</p>
                      <p className="text-xs text-gray-500">{course.code}</p>
                    </div>
                    <span className={clsx(
                      'text-xs px-2 py-0.5 rounded-full',
                      course.state === 'available' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    )}>
                      {course.state === 'available' ? 'Active' : 'Unpublished'}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <button
              onClick={handleSync}
              disabled={selectedCourseIds.size === 0}
              className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg"
            >
              🚀 Start Sync ({selectedCourseIds.size} course{selectedCourseIds.size !== 1 ? 's' : ''})
            </button>
          </div>
        )}

        {/* Step 5: Syncing */}
        {step === 'syncing' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 mb-4">
              <ArrowPathIcon className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Syncing Your Canvas Data</h2>
            <p className="text-sm text-gray-500 mb-4">
              Pulling assignments, modules, pages, files, discussions, quizzes, and announcements...
            </p>
            <p className="text-xs text-gray-400">This may take a minute for many courses.</p>
          </div>
        )}

        {/* Step 6: Done */}
        {step === 'done' && syncResult && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-100 mb-4">
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Sync Complete!</h2>
              <p className="text-sm text-gray-500 mt-1">
                Your Canvas data has been imported successfully.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: 'Courses', value: syncResult.courses, icon: '📚' },
                { label: 'Assignments', value: syncResult.assignments, icon: '📝' },
                { label: 'Modules', value: syncResult.modules, icon: '📦' },
                { label: 'Pages', value: syncResult.pages, icon: '📄' },
                { label: 'Files', value: syncResult.files, icon: '📎' },
                { label: 'Discussions', value: syncResult.discussions, icon: '💬' },
                { label: 'Quizzes', value: syncResult.quizzes, icon: '❓' },
                { label: 'Announcements', value: syncResult.announcements, icon: '📢' },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <span>{item.icon}</span>
                    <span className="text-lg font-bold text-gray-900">{item.value}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>

            {syncResult.errors.length > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-yellow-50 border border-yellow-200">
                <p className="text-xs font-medium text-yellow-800 mb-1">
                  {syncResult.errors.length} warning{syncResult.errors.length !== 1 ? 's' : ''}:
                </p>
                {syncResult.errors.slice(0, 3).map((err, i) => (
                  <p key={i} className="text-xs text-yellow-600 truncate">{err}</p>
                ))}
              </div>
            )}

            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors text-lg"
            >
              Go to Dashboard
              <ArrowRightIcon className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
