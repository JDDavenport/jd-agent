import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  BookOpenIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { search, listBooks } from '../api';
import clsx from 'clsx';

export function SearchView() {
  const [query, setQuery] = useState('');
  const [selectedBookId, setSelectedBookId] = useState<string | undefined>();

  const { data: books } = useQuery({
    queryKey: ['books'],
    queryFn: () => listBooks({ archived: false }),
  });

  const { data: results, isLoading, isFetching } = useQuery({
    queryKey: ['search', query, selectedBookId],
    queryFn: () => search(query, { bookId: selectedBookId }),
    enabled: query.length >= 2,
    staleTime: 1000 * 60,
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-white">Search Books</h1>

      {/* Search form */}
      <div className="mb-6 flex gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all books..."
            className="w-full rounded-lg bg-gray-800 py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={selectedBookId || ''}
          onChange={(e) => setSelectedBookId(e.target.value || undefined)}
          className="rounded-lg bg-gray-800 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Books</option>
          {books?.map((book) => (
            <option key={book.id} value={book.id}>
              {book.title}
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      {query.length < 2 ? (
        <div className="py-12 text-center text-gray-500">
          <MagnifyingGlassIcon className="mx-auto h-12 w-12" />
          <p className="mt-4">Enter at least 2 characters to search</p>
        </div>
      ) : isLoading || isFetching ? (
        <div className="py-12 text-center text-gray-500">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-indigo-500" />
          <p className="mt-4">Searching...</p>
        </div>
      ) : results && results.length > 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </p>

          {results.map((result, i) => (
            <Link
              key={i}
              to={
                result.chapterId
                  ? `/books/${result.bookId}/chapters/${result.chapterId}`
                  : `/books/${result.bookId}`
              }
              className={clsx(
                'block rounded-lg bg-gray-800 p-4 transition',
                'hover:bg-gray-750'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 rounded bg-gray-700 p-2">
                  {result.chapterId ? (
                    <DocumentTextIcon className="h-5 w-5 text-indigo-400" />
                  ) : (
                    <BookOpenIcon className="h-5 w-5 text-indigo-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-white">
                      {result.bookTitle}
                    </span>
                    {result.chapterTitle && (
                      <>
                        <span className="text-gray-600">/</span>
                        <span className="truncate text-gray-400">
                          {result.chapterTitle}
                        </span>
                      </>
                    )}
                  </div>
                  {result.pageNumber && (
                    <p className="mt-1 text-xs text-gray-500">
                      Page {result.pageNumber}
                    </p>
                  )}
                  <p
                    className="mt-2 text-sm text-gray-300"
                    dangerouslySetInnerHTML={{
                      __html: result.highlightedContent
                        .replace(/\*\*(.*?)\*\*/g, '<mark class="bg-yellow-500/30 text-yellow-200">$1</mark>'),
                    }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-gray-500">
          <MagnifyingGlassIcon className="mx-auto h-12 w-12" />
          <p className="mt-4">No results found for "{query}"</p>
          <p className="mt-2 text-sm">Try different keywords or search all books</p>
        </div>
      )}
    </div>
  );
}
