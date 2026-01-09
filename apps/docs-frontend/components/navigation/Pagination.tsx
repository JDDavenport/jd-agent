import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationLink {
  title: string;
  href: string;
}

interface PaginationProps {
  prev?: PaginationLink;
  next?: PaginationLink;
}

export function Pagination({ prev, next }: PaginationProps) {
  if (!prev && !next) return null;

  return (
    <nav className="flex items-center justify-between mt-12 pt-6 border-t border-border">
      {prev ? (
        <Link
          href={prev.href}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          <div>
            <div className="text-xs uppercase tracking-wider">Previous</div>
            <div className="font-medium text-foreground">{prev.title}</div>
          </div>
        </Link>
      ) : (
        <div />
      )}

      {next ? (
        <Link
          href={next.href}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-right group"
        >
          <div>
            <div className="text-xs uppercase tracking-wider">Next</div>
            <div className="font-medium text-foreground">{next.title}</div>
          </div>
          <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      ) : (
        <div />
      )}
    </nav>
  );
}
