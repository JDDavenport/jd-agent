'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';

interface Heading {
  level: number;
  text: string;
  id: string;
}

interface TableOfContentsProps {
  headings: Heading[];
}

export function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0% -80% 0%' }
    );

    const headingElements = headings
      .map((h) => document.getElementById(h.id))
      .filter(Boolean) as HTMLElement[];

    headingElements.forEach((element) => observer.observe(element));

    return () => {
      headingElements.forEach((element) => observer.unobserve(element));
    };
  }, [headings]);

  if (headings.length === 0) return null;

  // Only show h2 and h3
  const filteredHeadings = headings.filter((h) => h.level >= 2 && h.level <= 3);

  if (filteredHeadings.length === 0) return null;

  return (
    <aside className="w-56 flex-shrink-0 hidden xl:block">
      <div className="sticky top-20 py-6 px-4">
        <h4 className="text-sm font-semibold text-foreground mb-4">
          On This Page
        </h4>
        <nav className="space-y-1">
          {filteredHeadings.map((heading) => (
            <a
              key={heading.id}
              href={`#${heading.id}`}
              className={clsx(
                'block text-sm py-1 transition-colors',
                heading.level === 3 && 'pl-4',
                activeId === heading.id
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {heading.text}
            </a>
          ))}
        </nav>
      </div>
    </aside>
  );
}
