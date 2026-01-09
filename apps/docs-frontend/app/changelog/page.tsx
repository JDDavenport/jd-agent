import { getChangelog } from '@/lib/docs';
import Link from 'next/link';
import { ArrowLeft, Plus, RefreshCw, Wrench, Trash, AlertTriangle, Shield } from 'lucide-react';
import clsx from 'clsx';

export const metadata = {
  title: 'Changelog',
  description: 'All notable changes to JD Agent',
};

const typeIcons: Record<string, React.ReactNode> = {
  added: <Plus className="h-4 w-4 text-green-500" />,
  changed: <RefreshCw className="h-4 w-4 text-blue-500" />,
  fixed: <Wrench className="h-4 w-4 text-amber-500" />,
  removed: <Trash className="h-4 w-4 text-red-500" />,
  deprecated: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  security: <Shield className="h-4 w-4 text-purple-500" />,
};

const typeColors: Record<string, string> = {
  added: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
  changed: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
  fixed: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200',
  removed: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200',
  deprecated: 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200',
  security: 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200',
};

export default function ChangelogPage() {
  const changelog = getChangelog();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-muted/30">
        <div className="container max-w-4xl mx-auto px-4 py-12">
          <Link
            href="/roadmap"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Roadmap
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Changelog</h1>
          <p className="text-lg text-muted-foreground">
            All notable changes to JD Agent. This changelog follows the{' '}
            <a
              href="https://keepachangelog.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Keep a Changelog
            </a>{' '}
            format.
          </p>
        </div>
      </div>

      {/* Changelog entries */}
      <div className="container max-w-4xl mx-auto px-4 py-12">
        {changelog.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            No changelog entries yet.
          </p>
        ) : (
          <div className="space-y-12">
            {changelog.map((entry) => (
              <article
                key={entry.version}
                className="relative pl-8 border-l-2 border-border"
              >
                {/* Version badge */}
                <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground text-xs font-bold">
                    {entry.version.split('.')[1] || 'v'}
                  </span>
                </div>

                {/* Version header */}
                <header className="mb-6">
                  <h2 className="text-2xl font-bold">
                    Version {entry.version}
                  </h2>
                  <time className="text-sm text-muted-foreground">
                    {new Date(entry.date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                </header>

                {/* Changes by type */}
                <div className="space-y-6">
                  {entry.changes.map((changeGroup) => (
                    <div key={changeGroup.type}>
                      <h3 className="flex items-center gap-2 font-semibold mb-3">
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-sm capitalize',
                            typeColors[changeGroup.type]
                          )}
                        >
                          {typeIcons[changeGroup.type]}
                          {changeGroup.type}
                        </span>
                      </h3>
                      <ul className="space-y-2">
                        {changeGroup.items.map((item, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-2 text-sm"
                          >
                            <span className="text-muted-foreground mt-1.5">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
