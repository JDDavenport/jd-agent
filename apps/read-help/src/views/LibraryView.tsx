import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  PlusIcon,
  BookOpenIcon,
  TrashIcon,
  ArrowPathIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { listBooks, uploadBook, deleteBook, getBookStatus } from '../api';
import type { Book } from '../types';
import clsx from 'clsx';

export function LibraryView() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);

  const { data: books, isLoading, error } = useQuery({
    queryKey: ['books'],
    queryFn: () => listBooks({ archived: false }),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);
      setUploadProgress('Uploading...');
      const book = await uploadBook(file);

      // Poll for processing status
      setUploadProgress('Processing...');
      let status = await getBookStatus(book.id);
      while (status.status === 'processing') {
        await new Promise((r) => setTimeout(r, 2000));
        status = await getBookStatus(book.id);
        setUploadProgress(`Processing... ${status.progress}%`);
      }

      return book;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
      setUploading(false);
      setUploadProgress(null);
    },
    onError: (error) => {
      console.error('Upload failed:', error);
      setUploading(false);
      setUploadProgress(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.pdf')) {
      uploadMutation.mutate(file);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-gray-400">
        <ExclamationCircleIcon className="h-12 w-12" />
        <p>Failed to load library</p>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['books'] })}
          className="rounded-lg bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">My Library</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          <PlusIcon className="h-5 w-5" />
          Add Book
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Upload progress */}
      {uploading && uploadProgress && (
        <div className="mb-6 rounded-lg bg-gray-800 p-4">
          <div className="flex items-center gap-3">
            <ArrowPathIcon className="h-5 w-5 animate-spin text-indigo-400" />
            <span className="text-sm text-gray-300">{uploadProgress}</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {books?.length === 0 && !uploading && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex h-64 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-600 bg-gray-800/50"
        >
          <BookOpenIcon className="h-12 w-12 text-gray-500" />
          <p className="mt-4 text-gray-400">No books yet</p>
          <p className="mt-2 text-sm text-gray-500">
            Click "Add Book" or drag and drop a PDF to get started
          </p>
        </div>
      )}

      {/* Book grid */}
      {books && books.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onDelete={() => {
                if (confirm(`Delete "${book.title}"?`)) {
                  deleteMutation.mutate(book.id);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookCard({ book, onDelete }: { book: Book; onDelete: () => void }) {
  const isProcessing = book.status === 'processing';
  const hasError = book.status === 'error';

  return (
    <div className="group relative rounded-lg bg-gray-800 p-4 transition hover:bg-gray-750">
      <Link to={`/books/${book.id}`} className="block">
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-14 flex-shrink-0 items-center justify-center rounded bg-gray-700">
            <BookOpenIcon className="h-8 w-8 text-gray-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium text-white">{book.title}</h3>
            {book.author && (
              <p className="mt-1 truncate text-sm text-gray-400">{book.author}</p>
            )}
            <div className="mt-2 flex items-center gap-2">
              {isProcessing && (
                <span className="flex items-center gap-1 text-xs text-yellow-400">
                  <ArrowPathIcon className="h-3 w-3 animate-spin" />
                  Processing {book.processingProgress}%
                </span>
              )}
              {hasError && (
                <span className="flex items-center gap-1 text-xs text-red-400">
                  <ExclamationCircleIcon className="h-3 w-3" />
                  Error
                </span>
              )}
              {book.status === 'ready' && book.pageCount && (
                <span className="text-xs text-gray-500">{book.pageCount} pages</span>
              )}
            </div>
          </div>
        </div>
      </Link>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className={clsx(
          'absolute right-2 top-2 rounded p-1 text-gray-500 transition',
          'opacity-0 group-hover:opacity-100 hover:bg-gray-700 hover:text-red-400'
        )}
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
