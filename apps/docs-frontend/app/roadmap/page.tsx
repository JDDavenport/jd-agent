import { getRoadmapData, getBacklog } from '@/lib/docs';
import { RoadmapBoard } from '@/components/roadmap/RoadmapBoard';
import { BacklogSection } from '@/components/roadmap/BacklogSection';
import Link from 'next/link';
import { FileText, Bug, Lightbulb } from 'lucide-react';

export const metadata = {
  title: 'Roadmap',
  description: 'See what we\'re building for JD Agent',
};

export default function RoadmapPage() {
  const roadmapData = getRoadmapData();
  const backlog = getBacklog();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4 py-12">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Product Roadmap</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Track what we're building for JD Agent. Our roadmap is transparent
            and updated regularly as we ship new features.
          </p>
          <div className="flex items-center gap-4 mt-6">
            <Link
              href="/changelog"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <FileText className="h-4 w-4" />
              View Changelog
            </Link>
          </div>
        </div>
      </div>

      {/* Status Legend */}
      <div className="container max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-muted-foreground">Status:</span>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200">
              ✅ Complete
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200">
              🚧 In Progress
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200">
              📋 Planned
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200">
              💡 Considering
            </span>
          </div>
        </div>
      </div>

      {/* Roadmap Kanban */}
      <div className="container max-w-7xl mx-auto px-4 py-6">
        <RoadmapBoard columns={roadmapData} />
      </div>

      {/* Backlog Section */}
      <div className="container max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-8">Backlog</h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Known Issues */}
          <BacklogSection
            title="Known Issues"
            icon={<Bug className="h-5 w-5 text-red-500" />}
            items={backlog.issues}
            type="issue"
          />

          {/* Enhancements */}
          <BacklogSection
            title="Enhancements"
            icon={<Lightbulb className="h-5 w-5 text-amber-500" />}
            items={backlog.enhancements}
            type="enhancement"
          />

          {/* Feature Requests */}
          <BacklogSection
            title="Feature Requests"
            icon={<FileText className="h-5 w-5 text-blue-500" />}
            items={backlog.features}
            type="feature"
          />
        </div>
      </div>

      {/* Last Updated */}
      <div className="container max-w-7xl mx-auto px-4 py-6 text-center text-sm text-muted-foreground border-t border-border">
        Last updated: January 8, 2026
      </div>
    </div>
  );
}
