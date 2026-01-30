import { useMemo } from 'react';

interface FormattedCaseContentProps {
  content: string;
  chapterTitle: string;
}

/**
 * Smart formatting component that detects structure in business cases
 * and renders them with proper typography and layout
 */
export function FormattedCaseContent({ content, chapterTitle }: FormattedCaseContentProps) {
  const formattedSections = useMemo(() => {
    const lines = content.split('\n');
    const sections: Array<{ type: 'heading' | 'subheading' | 'paragraph' | 'exhibit' | 'table'; content: string }> = [];

    let currentParagraph: string[] = [];

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        sections.push({
          type: 'paragraph',
          content: currentParagraph.join('\n'),
        });
        currentParagraph = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines
      if (line.length === 0) {
        if (currentParagraph.length > 0) {
          flushParagraph();
        }
        continue;
      }

      // Detect headings (ALL CAPS, short, standalone)
      if (line === line.toUpperCase() &&
          line.length < 80 &&
          line.length > 3 &&
          !line.startsWith('EXHIBIT') &&
          !line.startsWith('TABLE') &&
          !line.match(/^\d{3}-\d{3}/) // Not case numbers
      ) {
        flushParagraph();
        sections.push({
          type: 'heading',
          content: line,
        });
        continue;
      }

      // Detect exhibits and tables
      if (line.match(/^(Exhibit|Table|Figure)\s+\d+/i)) {
        flushParagraph();
        sections.push({
          type: 'exhibit',
          content: line,
        });
        continue;
      }

      // Detect subheadings (Title Case, ends with colon or is short)
      if ((line.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]+)*:?$/) && line.length < 60) ||
          (line.endsWith(':') && line.length < 80 && !line.includes('.'))) {
        flushParagraph();
        sections.push({
          type: 'subheading',
          content: line,
        });
        continue;
      }

      // Regular paragraph text
      currentParagraph.push(line);
    }

    flushParagraph();
    return sections;
  }, [content]);

  return (
    <div className="prose prose-invert prose-lg max-w-none">
      {/* Case title */}
      <h1 className="text-3xl font-bold text-white mb-8 border-b border-gray-700 pb-4">
        {chapterTitle}
      </h1>

      {/* Formatted content */}
      <div className="space-y-6">
        {formattedSections.map((section, idx) => {
          switch (section.type) {
            case 'heading':
              return (
                <h2 key={idx} className="text-2xl font-bold text-indigo-300 mt-12 mb-4">
                  {section.content}
                </h2>
              );

            case 'subheading':
              return (
                <h3 key={idx} className="text-xl font-semibold text-indigo-200 mt-8 mb-3">
                  {section.content}
                </h3>
              );

            case 'exhibit':
              return (
                <div key={idx} className="my-6 rounded-lg bg-blue-900/20 border border-blue-500/30 p-4">
                  <p className="text-sm font-semibold text-blue-300 mb-2">
                    📊 {section.content}
                  </p>
                  <p className="text-xs text-gray-400 italic">
                    Note: Charts and tables from the original PDF are referenced in the text
                  </p>
                </div>
              );

            case 'paragraph':
              return (
                <p key={idx} className="text-gray-300 leading-relaxed text-base mb-4">
                  {section.content}
                </p>
              );

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
