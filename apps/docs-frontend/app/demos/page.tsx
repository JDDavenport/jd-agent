import Link from 'next/link';
import { Play, ExternalLink, CheckSquare, Brain, Bot, Calendar } from 'lucide-react';

export const metadata = {
  title: 'Demos',
  description: 'Interactive demos and walkthroughs of JD Agent features',
};

const demos = [
  {
    icon: CheckSquare,
    title: 'Task Management',
    description: 'See how to capture, organize, and complete tasks using GTD methodology.',
    duration: '5 min',
    status: 'available',
    href: '/docs/features/tasks',
  },
  {
    icon: Brain,
    title: 'Knowledge Vault',
    description: 'Learn how to store, search, and connect your knowledge.',
    duration: '4 min',
    status: 'available',
    href: '/docs/features/vault',
  },
  {
    icon: Bot,
    title: 'AI Agent',
    description: 'Discover the 37 tools available to your personal AI assistant.',
    duration: '6 min',
    status: 'available',
    href: '/docs/features/agent',
  },
  {
    icon: Calendar,
    title: 'Calendar Integration',
    description: 'See how calendar sync and time blocking work together.',
    duration: '3 min',
    status: 'coming-soon',
    href: '/docs/features/calendar',
  },
];

export default function DemosPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-muted/30">
        <div className="container max-w-5xl mx-auto px-4 py-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Feature Demos</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Interactive walkthroughs and demonstrations of JD Agent's key features.
            Learn by example and see the system in action.
          </p>
        </div>
      </div>

      {/* Demos Grid */}
      <div className="container max-w-5xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {demos.map((demo) => {
            const Icon = demo.icon;
            const isAvailable = demo.status === 'available';

            return (
              <Link
                key={demo.title}
                href={demo.href}
                className={`group relative p-6 rounded-xl border border-border transition-all ${
                  isAvailable
                    ? 'hover:border-primary/50 hover:shadow-lg'
                    : 'opacity-60 cursor-not-allowed'
                }`}
              >
                {/* Status badge */}
                {demo.status === 'coming-soon' && (
                  <span className="absolute top-4 right-4 text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                    Coming Soon
                  </span>
                )}

                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="p-3 rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                      {demo.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {demo.description}
                    </p>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Play className="h-4 w-4" />
                        {demo.duration}
                      </span>
                      {isAvailable && (
                        <span className="flex items-center gap-1 text-primary">
                          View Demo
                          <ExternalLink className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Quick Start CTA */}
      <div className="container max-w-5xl mx-auto px-4 py-12">
        <div className="text-center p-8 rounded-xl bg-muted/50 border border-border">
          <h2 className="text-2xl font-bold mb-4">Ready to Try It Yourself?</h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            The best way to learn is by doing. Follow our quick start guide to
            set up JD Agent and start being productive.
          </p>
          <Link
            href="/docs/getting-started/quick-start"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <Play className="h-4 w-4" />
            Quick Start Guide
          </Link>
        </div>
      </div>
    </div>
  );
}
