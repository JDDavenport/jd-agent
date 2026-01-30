import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import {
  BookOpenIcon,
  MagnifyingGlassIcon,
  DocumentArrowUpIcon,
  TagIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useBooks } from '../hooks/useStudy';
import type { Book } from '../types';

export function ReadingsView() {
  const { data: books, isLoading, error } = useBooks();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Get unique tags from all books
  const allTags = books
    ? [...new Set(books.flatMap((b) => b.tags || []))]
    : [];

  const filteredBooks = books?.filter((book) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!book.title.toLowerCase().includes(query) &&
          !book.author?.toLowerCase().includes(query)) {
        return false;
      }
    }
    // Tag filter
    if (selectedTag && !book.tags?.includes(selectedTag)) {
      return false;
    }
    // Hide archived
    if (book.isArchived) return false;
    return true;
  }) || [];

  // Group by status
  const processing = filteredBooks.filter((b) => b.status === 'processing');
  const ready = filteredBooks.filter((b) => b.status === 'ready');
  const errored = filteredBooks.filter((b) => b.status === 'error');

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-800">Failed to load books. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Readings</h1>
          <p className="text-gray-600 mt-1">
            {ready.length} books ready • {processing.length} processing
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          onClick={() => {
            // TODO: Implement upload modal
            alert('Upload feature coming soon! For now, use the Read Help app directly.');
          }}
        >
          <DocumentArrowUpIcon className="w-5 h-5" />
          Upload PDF
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search books..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => setSelectedTag(null)}
              className={clsx(
                'text-xs px-3 py-1.5 rounded-full border transition-colors',
                selectedTag === null
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              )}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                className={clsx(
                  'text-xs px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1',
                  selectedTag === tag
                    ? 'bg-blue-100 border-blue-300 text-blue-800'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                )}
              >
                <TagIcon className="w-3 h-3" />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Processing books */}
      {processing.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Processing ({processing.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {processing.map((book) => (
              <ProcessingBookCard key={book.id} book={book} />
            ))}
          </div>
        </div>
      )}

      {/* Error books */}
      {errored.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-3">
            Failed ({errored.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {errored.map((book) => (
              <ErrorBookCard key={book.id} book={book} />
            ))}
          </div>
        </div>
      )}

      {/* Ready books */}
      {ready.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Your Library ({ready.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ready.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <BookOpenIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No books yet</h3>
          <p className="text-gray-500 mt-1">Upload a PDF to get started with AI-powered reading help.</p>
        </div>
      )}
    </div>
  );
}

function BookCard({ book }: { book: Book }) {
  return (
    <Link
      to={`/readings/${book.id}`}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-md transition-all"
    >
      <div className="flex gap-4">
        {/* Book icon */}
        <div className="flex-shrink-0 w-16 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
          <BookOpenIcon className="w-8 h-8 text-white" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 line-clamp-2">{book.title}</h3>
          {book.author && (
            <p className="text-sm text-gray-500 mt-1">{book.author}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {book.pageCount && (
              <span className="text-xs text-gray-400">{book.pageCount} pages</span>
            )}
            {book.lastReadAt && (
              <span className="text-xs text-gray-400">
                Read {format(parseISO(book.lastReadAt), 'MMM d')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tags */}
      {book.tags && book.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {book.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600"
            >
              {tag}
            </span>
          ))}
          {book.tags.length > 3 && (
            <span className="text-xs text-gray-400">+{book.tags.length - 3}</span>
          )}
        </div>
      )}
    </Link>
  );
}

function ProcessingBookCard({ book }: { book: Book }) {
  return (
    <div className="bg-white rounded-xl border border-blue-200 p-4">
      <div className="flex gap-4">
        <div className="flex-shrink-0 w-16 h-20 bg-blue-100 rounded-lg flex items-center justify-center">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 line-clamp-2">{book.title}</h3>
          <p className="text-sm text-blue-600 mt-2">Processing...</p>
          <p className="text-xs text-gray-500 mt-1">This may take a few minutes</p>
        </div>
      </div>
    </div>
  );
}

function ErrorBookCard({ book }: { book: Book }) {
  return (
    <div className="bg-white rounded-xl border border-red-200 p-4">
      <div className="flex gap-4">
        <div className="flex-shrink-0 w-16 h-20 bg-red-100 rounded-lg flex items-center justify-center">
          <span className="text-2xl">❌</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 line-clamp-2">{book.title}</h3>
          <p className="text-sm text-red-600 mt-2">Processing failed</p>
          <button className="text-xs text-blue-600 hover:underline mt-1">
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
