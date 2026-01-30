import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BookOpenIcon,
  DocumentTextIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { getBook, getChapters, getProgress, getHighlights } from '../api';
import clsx from 'clsx';

export function BookView() {
  const { bookId } = useParams<{ bookId: string }>();

  const { data: book, isLoading: bookLoading } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => getBook(bookId!),
    enabled: !!bookId,
  });

  const { data: chapters, isLoading: chaptersLoading } = useQuery({
    queryKey: ['chapters', bookId],
    queryFn: () => getChapters(bookId!),
    enabled: !!bookId && book?.status === 'ready',
  });

  const { data: progress } = useQuery({
    queryKey: ['progress', bookId],
    queryFn: () => getProgress(bookId!),
    enabled: !!bookId && book?.status === 'ready',
  });

  const { data: highlights } = useQuery({
    queryKey: ['highlights', bookId],
    queryFn: () => getHighlights(bookId!),
    enabled: !!bookId && book?.status === 'ready',
  });

  if (bookLoading || chaptersLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-gray-400">
        <BookOpenIcon className="h-12 w-12" />
        <p>Book not found</p>
        <Link
          to="/"
          className="rounded-lg bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600"
        >
          Back to Library
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Library
        </Link>

        <div className="flex items-start gap-6">
          <div className="flex h-32 w-24 flex-shrink-0 items-center justify-center rounded-lg bg-gray-800">
            <BookOpenIcon className="h-12 w-12 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{book.title}</h1>
            {book.author && (
              <p className="mt-1 text-lg text-gray-400">{book.author}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
              {book.pageCount && <span>{book.pageCount} pages</span>}
              {book.totalWordCount && (
                <span>{Math.round(book.totalWordCount / 1000)}k words</span>
              )}
              {chapters && <span>{chapters.length} chapters</span>}
            </div>

            {/* Progress bar */}
            {progress && (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-gray-400">
                    {Math.round(progress.percentComplete)}% complete
                  </span>
                  <span className="text-gray-500">
                    {progress.totalReadingTimeMinutes} min read
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-700">
                  <div
                    className="h-2 rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${progress.percentComplete}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <DocumentTextIcon className="h-8 w-8 text-indigo-400" />
            <div>
              <p className="text-2xl font-bold text-white">
                {highlights?.length || 0}
              </p>
              <p className="text-sm text-gray-400">Highlights</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <ClockIcon className="h-8 w-8 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-white">
                {progress?.totalReadingTimeMinutes || 0}
              </p>
              <p className="text-sm text-gray-400">Minutes Read</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <BookOpenIcon className="h-8 w-8 text-yellow-400" />
            <div>
              <p className="text-2xl font-bold text-white">
                {progress?.pagesRead || 0}
              </p>
              <p className="text-sm text-gray-400">Pages Read</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chapters */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-white">Chapters</h2>
        {book.status !== 'ready' ? (
          <div className="rounded-lg bg-gray-800 p-6 text-center">
            <ArrowPathIcon className="mx-auto h-8 w-8 animate-spin text-gray-400" />
            <p className="mt-2 text-gray-400">
              Processing book... {book.processingProgress}%
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {chapters?.map((chapter) => (
              <Link
                key={chapter.id}
                to={`/books/${bookId}/chapters/${chapter.id}`}
                className={clsx(
                  'block rounded-lg bg-gray-800 p-4 transition',
                  'hover:bg-gray-750'
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-500">
                      Chapter {chapter.chapterNumber}
                    </span>
                    <h3 className="font-medium text-white">
                      {chapter.title || `Chapter ${chapter.chapterNumber}`}
                    </h3>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    {chapter.wordCount && (
                      <span>{Math.round(chapter.wordCount / 250)} min read</span>
                    )}
                    {chapter.summaryShort && (
                      <span className="ml-2 text-green-400">Summary ready</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
