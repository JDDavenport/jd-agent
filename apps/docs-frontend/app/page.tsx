import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CheckSquare,
  Brain,
  Calendar,
  Bot,
  Plug,
  Map,
  FileText,
  Zap,
} from 'lucide-react';

const features = [
  {
    icon: CheckSquare,
    title: 'Task Management',
    description: 'GTD-based workflow with inbox, projects, contexts, and recurring tasks.',
    href: '/docs/features/tasks',
  },
  {
    icon: Brain,
    title: 'Knowledge Vault',
    description: 'Notion-like knowledge base with full-text and semantic search.',
    href: '/docs/features/vault',
  },
  {
    icon: Bot,
    title: 'AI Agent',
    description: '37 specialized tools for tasks, calendar, vault, and more.',
    href: '/docs/features/agent',
  },
  {
    icon: Calendar,
    title: 'Calendar Integration',
    description: 'Bidirectional sync with Google Calendar and smart scheduling.',
    href: '/docs/features/calendar',
  },
  {
    icon: Zap,
    title: 'Ceremonies',
    description: 'Automated morning briefings, evening reviews, and weekly planning.',
    href: '/docs/features/ceremonies',
  },
  {
    icon: Plug,
    title: 'Integrations',
    description: 'Connect with Canvas, Telegram, Notion, and more.',
    href: '/docs/features/integrations',
  },
];

const quickLinks = [
  { icon: BookOpen, title: 'Quick Start', description: 'Get up and running in 5 minutes', href: '/docs/getting-started/quick-start' },
  { icon: Map, title: 'Roadmap', description: 'See what we\'re building', href: '/roadmap' },
  { icon: FileText, title: 'Changelog', description: 'Latest updates and releases', href: '/changelog' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            JD Agent{' '}
            <span className="text-primary">Documentation</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Your AI-powered personal productivity system built on GTD principles.
            Capture everything. Process to zero. Trust the system.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/docs/getting-started"
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="http://localhost:5173"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6 py-3 border border-border rounded-lg font-medium hover:bg-muted transition-colors"
            >
              Go to App
            </a>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4">
        <div className="container max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            Everything You Need
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link
                  key={feature.title}
                  href={feature.href}
                  className="group p-6 rounded-xl border border-border hover:border-primary/50 hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold group-hover:text-primary transition-colors">
                      {feature.title}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            Quick Links
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.title}
                  href={link.href}
                  className="group flex items-start gap-4 p-4 rounded-lg bg-background border border-border hover:border-primary/50 transition-all"
                >
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold group-hover:text-primary transition-colors">
                      {link.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {link.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Ready to Get Productive?
          </h2>
          <p className="text-muted-foreground mb-8">
            Follow our quick start guide to set up JD Agent and start managing
            your tasks, knowledge, and calendar in one place.
          </p>
          <Link
            href="/docs/getting-started/installation"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Start Installation
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xs">JD</span>
            </div>
            <span>JD Agent Documentation</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/docs" className="hover:text-foreground transition-colors">
              Docs
            </Link>
            <Link href="/roadmap" className="hover:text-foreground transition-colors">
              Roadmap
            </Link>
            <Link href="/changelog" className="hover:text-foreground transition-colors">
              Changelog
            </Link>
            <a
              href="http://localhost:5173"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              App
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
