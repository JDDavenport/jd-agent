'use client';

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

interface MarkdownContentProps {
  content: string;
}

// Code block component
function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const language = className?.replace('language-', '') || '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
        {language && (
          <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
            {language}
          </span>
        )}
        <button
          onClick={handleCopy}
          className="p-1.5 text-muted-foreground hover:text-foreground bg-background/80 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          title="Copy code"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>
      <pre className={clsx('p-4 rounded-lg bg-muted overflow-x-auto text-sm', className)}>
        <code>{children}</code>
      </pre>
    </div>
  );
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  // Remove frontmatter if present
  const cleanContent = useMemo(() => {
    return content.replace(/^---[\s\S]*?---\n*/m, '');
  }, [content]);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Headings with IDs for TOC
        h1: ({ children }) => {
          const id = String(children)
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-');
          return (
            <h1 id={id} className="scroll-mt-20">
              {children}
            </h1>
          );
        },
        h2: ({ children }) => {
          const id = String(children)
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-');
          return (
            <h2 id={id} className="scroll-mt-20">
              {children}
            </h2>
          );
        },
        h3: ({ children }) => {
          const id = String(children)
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-');
          return (
            <h3 id={id} className="scroll-mt-20">
              {children}
            </h3>
          );
        },

        // Code blocks
        pre: ({ children }) => <>{children}</>,
        code: ({ children, className, ...props }) => {
          const isBlock = className?.startsWith('language-');
          if (isBlock) {
            return (
              <CodeBlock className={className}>
                {String(children).replace(/\n$/, '')}
              </CodeBlock>
            );
          }
          return (
            <code
              className="px-1.5 py-0.5 text-sm bg-muted rounded font-mono"
              {...props}
            >
              {children}
            </code>
          );
        },

        // Tables
        table: ({ children }) => (
          <div className="overflow-x-auto my-6">
            <table className="w-full border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border px-4 py-2 text-left bg-muted font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border px-4 py-2">{children}</td>
        ),

        // Links
        a: ({ href, children }) => {
          const isExternal = href?.startsWith('http');
          return (
            <a
              href={href}
              className="text-primary hover:underline"
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
            >
              {children}
            </a>
          );
        },

        // Blockquotes - detect callout pattern
        blockquote: ({ children }) => {
          // Check for callout pattern like "> **Note:**" or "> ℹ️"
          const text = String(children);

          if (text.includes('Warning') || text.includes('⚠️')) {
            return (
              <div className="p-4 rounded-lg border-l-4 my-4 bg-amber-50 dark:bg-amber-950/50 border-amber-500">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-amber-900 dark:text-amber-100">{children}</div>
                </div>
              </div>
            );
          }

          if (text.includes('Tip') || text.includes('💡')) {
            return (
              <div className="p-4 rounded-lg border-l-4 my-4 bg-green-50 dark:bg-green-950/50 border-green-500">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="text-green-900 dark:text-green-100">{children}</div>
                </div>
              </div>
            );
          }

          if (text.includes('Danger') || text.includes('❌')) {
            return (
              <div className="p-4 rounded-lg border-l-4 my-4 bg-red-50 dark:bg-red-950/50 border-red-500">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-red-900 dark:text-red-100">{children}</div>
                </div>
              </div>
            );
          }

          // Default blockquote with info style
          return (
            <blockquote className="border-l-4 border-border pl-4 italic text-muted-foreground my-4">
              {children}
            </blockquote>
          );
        },

        // Lists
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-1 my-4">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-1 my-4">{children}</ol>
        ),
        li: ({ children }) => <li className="ml-4">{children}</li>,

        // HR
        hr: () => <hr className="my-8 border-border" />,

        // Images
        img: ({ src, alt }) => (
          <img
            src={src}
            alt={alt || ''}
            className="rounded-lg border border-border my-4 max-w-full"
          />
        ),
      }}
    >
      {cleanContent}
    </ReactMarkdown>
  );
}
