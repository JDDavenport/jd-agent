import { Link } from 'react-router-dom';
import { useSystemHealth } from '../../hooks/useSystemHealth';

function Header() {
  const { isHealthy, isLoading } = useSystemHealth();

  return (
    <header className="bg-dark-card border-b border-dark-border sticky top-0 z-50">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
            JD Agent
          </h1>
          <div className="flex items-center space-x-2">
            {isLoading ? (
              <div className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
            ) : (
              <div
                className={`w-2 h-2 rounded-full ${
                  isHealthy ? 'bg-success animate-pulse-glow' : 'bg-error'
                }`}
              />
            )}
            <span className="text-sm text-text-muted">
              {isLoading ? 'Checking...' : isHealthy ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-sm text-text-muted">
            {new Date().toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
          </div>
          <Link
            to="/settings"
            className="p-2 hover:bg-dark-card-hover rounded-lg transition-colors"
            title="Settings"
          >
            <svg
              className="w-5 h-5 text-text-muted hover:text-text"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}

export default Header;
