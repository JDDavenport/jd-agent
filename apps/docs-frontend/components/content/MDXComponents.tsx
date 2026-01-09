'use client';

import { useState, ReactNode } from 'react';
import { Check, Copy, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import clsx from 'clsx';

// Code block with copy button
export function CodeBlock({
  children,
  className,
  ...props
}: {
  children: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const language = className?.replace('language-', '') || 'text';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      <div className="absolute top-2 right-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="p-1.5 text-muted-foreground hover:text-foreground bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Copy code"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
      <pre className={clsx('p-4 rounded-lg bg-muted overflow-x-auto', className)} {...props}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

// Callout components
interface CalloutProps {
  type?: 'info' | 'warning' | 'success' | 'danger';
  title?: string;
  children: ReactNode;
}

const calloutIcons = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  danger: XCircle,
};

const calloutStyles = {
  info: 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-900 dark:text-blue-100',
  warning: 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 text-amber-900 dark:text-amber-100',
  success: 'bg-green-50 dark:bg-green-950/50 border-green-500 text-green-900 dark:text-green-100',
  danger: 'bg-red-50 dark:bg-red-950/50 border-red-500 text-red-900 dark:text-red-100',
};

export function Callout({ type = 'info', title, children }: CalloutProps) {
  const Icon = calloutIcons[type];

  return (
    <div className={clsx('p-4 rounded-lg border-l-4 my-4', calloutStyles[type])}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div>
          {title && <div className="font-semibold mb-1">{title}</div>}
          <div className="text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}

// Tabs component
interface TabsProps {
  items: { label: string; content: ReactNode }[];
}

export function Tabs({ items }: TabsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="my-4">
      <div className="flex border-b border-border">
        {items.map((item, index) => (
          <button
            key={item.label}
            onClick={() => setActiveIndex(index)}
            className={clsx(
              'px-4 py-2 text-sm font-medium transition-colors',
              activeIndex === index
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-4">{items[activeIndex]?.content}</div>
    </div>
  );
}

// Keyboard shortcut badge
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-mono bg-muted border border-border rounded shadow-sm min-w-[1.5rem]">
      {children}
    </kbd>
  );
}

// Status badge
interface StatusBadgeProps {
  status: 'complete' | 'in-progress' | 'planned' | 'considering';
  children?: ReactNode;
}

const statusStyles = {
  complete: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
  'in-progress': 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200',
  planned: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
  considering: 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200',
};

const statusLabels = {
  complete: '✅ Complete',
  'in-progress': '🚧 In Progress',
  planned: '📋 Planned',
  considering: '💡 Considering',
};

export function StatusBadge({ status, children }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-1 text-xs font-medium rounded-full',
        statusStyles[status]
      )}
    >
      {children || statusLabels[status]}
    </span>
  );
}

// Table wrapper for responsive tables
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto my-4">
      <table className="w-full">{children}</table>
    </div>
  );
}

// All MDX components
export const mdxComponents = {
  // Override default elements
  pre: ({ children }: { children: ReactNode }) => <>{children}</>,
  code: ({ children, className }: { children: string; className?: string }) => {
    // If it has a language class, it's a code block
    if (className?.startsWith('language-')) {
      return <CodeBlock className={className}>{children}</CodeBlock>;
    }
    // Otherwise, it's inline code
    return (
      <code className="px-1.5 py-0.5 text-sm bg-muted rounded font-mono">
        {children}
      </code>
    );
  },
  table: Table,

  // Custom components
  Callout,
  Tabs,
  Kbd,
  StatusBadge,
};
