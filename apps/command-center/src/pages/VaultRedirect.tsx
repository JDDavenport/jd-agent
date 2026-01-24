import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../components/common/Button';

/**
 * Redirect page for vault editing
 *
 * Vault note editing has been moved to the dedicated Vault app.
 * This page redirects users and provides instructions.
 */
function VaultRedirect() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  useEffect(() => {
    // Auto-redirect to Vault app after 3 seconds
    const timer = setTimeout(() => {
      window.location.href = isNew
        ? 'http://localhost:5181/vault/new'
        : `http://localhost:5181/vault/${id}`;
    }, 3000);

    return () => clearTimeout(timer);
  }, [id, isNew]);

  const handleOpenVault = () => {
    window.location.href = isNew
      ? 'http://localhost:5181/vault/new'
      : `http://localhost:5181/vault/${id}`;
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="card max-w-2xl text-center space-y-6">
        <div className="w-20 h-20 mx-auto bg-accent-purple/10 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-accent-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-2">
            Opening Vault App
          </h1>
          <p className="text-text-muted text-lg">
            {isNew
              ? 'Creating and editing vault notes happens in the dedicated Vault app.'
              : 'Editing vault notes happens in the dedicated Vault app.'}
          </p>
        </div>

        <div className="bg-dark-border/30 rounded-lg p-6 space-y-4">
          <div className="flex items-start space-x-3">
            <svg className="w-6 h-6 text-accent-cyan flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="text-left">
              <p className="font-medium">Why a separate app?</p>
              <p className="text-sm text-text-muted mt-1">
                The Vault app features a full-featured TipTap editor with Notion-style blocks,
                advanced formatting, and specialized note-taking features.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <svg className="w-6 h-6 text-accent-green flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="text-left">
              <p className="font-medium">Command Center still works</p>
              <p className="text-sm text-text-muted mt-1">
                You can browse and search your vault entries here.
                Only creation and editing happens in the Vault app.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            Redirecting in 3 seconds...
          </p>

          <div className="flex justify-center space-x-3">
            <Button onClick={handleOpenVault} size="lg">
              Open Vault App Now
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/vault')}
              size="lg"
            >
              Back to Vault Browser
            </Button>
          </div>
        </div>

        <div className="pt-4 border-t border-dark-border">
          <p className="text-xs text-text-muted">
            <strong>Tip:</strong> Keep both apps open for the best experience.
            Browse in Command Center, edit in Vault.
          </p>
        </div>
      </div>
    </div>
  );
}

export default VaultRedirect;
