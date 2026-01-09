import { notFound } from 'next/navigation';
import { getDocBySlug, getNavigation, getAllDocPaths } from '@/lib/docs';
import { Sidebar } from '@/components/navigation/Sidebar';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { TableOfContents } from '@/components/navigation/TableOfContents';
import { Pagination } from '@/components/navigation/Pagination';
import { MarkdownContent } from '@/components/content/MarkdownContent';

interface DocPageProps {
  params: {
    slug?: string[];
  };
}

export async function generateStaticParams() {
  const paths = getAllDocPaths();
  return paths.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: DocPageProps) {
  const slug = params.slug || ['index'];
  const doc = getDocBySlug(slug);

  if (!doc) {
    return {
      title: 'Not Found',
    };
  }

  return {
    title: doc.title,
    description: doc.description || `Documentation for ${doc.title}`,
  };
}

export default function DocPage({ params }: DocPageProps) {
  const slug = params.slug || ['index'];
  const doc = getDocBySlug(slug);
  const navigation = getNavigation();

  if (!doc) {
    // Try to render the main docs index
    if (slug.length === 1 && slug[0] === 'index') {
      const indexDoc = getDocBySlug(['getting-started']);
      if (indexDoc) {
        return renderDocPage(indexDoc, navigation);
      }
    }
    notFound();
  }

  return renderDocPage(doc, navigation);
}

function renderDocPage(
  doc: NonNullable<ReturnType<typeof getDocBySlug>>,
  navigation: ReturnType<typeof getNavigation>
) {
  // Find prev/next pages
  const allPages = flattenNavigation(navigation);
  const currentIndex = allPages.findIndex((p) =>
    doc.slug.includes(p.href.replace('/docs/', ''))
  );
  const prev = currentIndex > 0 ? allPages[currentIndex - 1] : undefined;
  const next =
    currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : undefined;

  return (
    <div className="flex">
      {/* Sidebar */}
      <Sidebar items={navigation} />

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex">
          {/* Article */}
          <article className="flex-1 min-w-0 px-8 py-8 max-w-3xl mx-auto">
            <Breadcrumbs />

            <header className="mb-8">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                {doc.title}
              </h1>
              {doc.description && (
                <p className="text-lg text-muted-foreground">
                  {doc.description}
                </p>
              )}
            </header>

            <div className="prose prose-slate dark:prose-invert max-w-none">
              <MarkdownContent content={doc.content} />
            </div>

            {doc.lastUpdated && (
              <div className="mt-8 pt-4 border-t border-border text-sm text-muted-foreground">
                Last updated: {doc.lastUpdated}
              </div>
            )}

            <Pagination
              prev={prev ? { title: prev.title, href: prev.href } : undefined}
              next={next ? { title: next.title, href: next.href } : undefined}
            />
          </article>

          {/* Table of contents */}
          <TableOfContents headings={doc.headings} />
        </div>
      </div>
    </div>
  );
}

function flattenNavigation(
  items: ReturnType<typeof getNavigation>
): { title: string; href: string }[] {
  const result: { title: string; href: string }[] = [];

  for (const item of items) {
    result.push({ title: item.title, href: item.href });
    if (item.children) {
      for (const child of item.children) {
        result.push({ title: child.title, href: child.href });
        if (child.children) {
          result.push(...child.children.map((c) => ({ title: c.title, href: c.href })));
        }
      }
    }
  }

  return result;
}
