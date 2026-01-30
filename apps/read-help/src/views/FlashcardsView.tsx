import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AcademicCapIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import { getDueFlashcards, reviewFlashcard, listBooks } from '../api';
import type { Flashcard } from '../types';
import clsx from 'clsx';

export function FlashcardsView() {
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<string | undefined>();

  const { data: books } = useQuery({
    queryKey: ['books'],
    queryFn: () => listBooks({ archived: false }),
  });

  const { data: flashcards, isLoading, refetch } = useQuery({
    queryKey: ['flashcards', 'due', selectedBookId],
    queryFn: () => getDueFlashcards(selectedBookId, 20),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ cardId, quality }: { cardId: string; quality: 0 | 1 | 2 | 3 | 4 | 5 }) =>
      reviewFlashcard(cardId, quality),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards'] });
    },
  });

  const handleReview = (quality: 0 | 1 | 2 | 3 | 4 | 5) => {
    if (!flashcards || currentIndex >= flashcards.length) return;

    const card = flashcards[currentIndex];
    reviewMutation.mutate(
      { cardId: card.id, quality },
      {
        onSuccess: () => {
          setShowAnswer(false);
          if (currentIndex < flashcards.length - 1) {
            setCurrentIndex((i) => i + 1);
          } else {
            // All cards reviewed
            refetch();
            setCurrentIndex(0);
          }
        },
      }
    );
  };

  const currentCard = flashcards?.[currentIndex];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Study Flashcards</h1>

        <select
          value={selectedBookId || ''}
          onChange={(e) => {
            setSelectedBookId(e.target.value || undefined);
            setCurrentIndex(0);
            setShowAnswer(false);
          }}
          className="rounded-lg bg-gray-800 px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All Books</option>
          {books?.map((book) => (
            <option key={book.id} value={book.id}>
              {book.title}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : !flashcards || flashcards.length === 0 ? (
        <div className="py-12 text-center">
          <AcademicCapIcon className="mx-auto h-16 w-16 text-gray-600" />
          <h2 className="mt-4 text-xl font-medium text-white">No flashcards due</h2>
          <p className="mt-2 text-gray-400">
            Generate flashcards from chapter concepts to start studying
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-2xl">
          {/* Progress */}
          <div className="mb-4 flex items-center justify-between text-sm text-gray-400">
            <span>
              Card {currentIndex + 1} of {flashcards.length}
            </span>
            <span>{flashcards.length - currentIndex - 1} remaining</span>
          </div>

          {/* Progress bar */}
          <div className="mb-6 h-1 rounded-full bg-gray-700">
            <div
              className="h-1 rounded-full bg-indigo-500 transition-all"
              style={{
                width: `${((currentIndex + 1) / flashcards.length) * 100}%`,
              }}
            />
          </div>

          {/* Flashcard */}
          {currentCard && (
            <FlashcardDisplay
              card={currentCard}
              showAnswer={showAnswer}
              onFlip={() => setShowAnswer(!showAnswer)}
            />
          )}

          {/* Review buttons */}
          {showAnswer && (
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => handleReview(1)}
                disabled={reviewMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-red-600/20 px-4 py-3 text-red-400 hover:bg-red-600/30"
              >
                <XCircleIcon className="h-5 w-5" />
                Again
              </button>
              <button
                onClick={() => handleReview(2)}
                disabled={reviewMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-orange-600/20 px-4 py-3 text-orange-400 hover:bg-orange-600/30"
              >
                Hard
              </button>
              <button
                onClick={() => handleReview(3)}
                disabled={reviewMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-yellow-600/20 px-4 py-3 text-yellow-400 hover:bg-yellow-600/30"
              >
                Good
              </button>
              <button
                onClick={() => handleReview(5)}
                disabled={reviewMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-green-600/20 px-4 py-3 text-green-400 hover:bg-green-600/30"
              >
                <CheckCircleIcon className="h-5 w-5" />
                Easy
              </button>
            </div>
          )}

          {!showAnswer && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowAnswer(true)}
                className="rounded-lg bg-indigo-600 px-8 py-3 text-white hover:bg-indigo-500"
              >
                Show Answer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FlashcardDisplay({
  card,
  showAnswer,
  onFlip,
}: {
  card: Flashcard;
  showAnswer: boolean;
  onFlip: () => void;
}) {
  return (
    <div
      onClick={onFlip}
      className={clsx(
        'cursor-pointer rounded-xl bg-gray-800 p-8 transition-all duration-300',
        'hover:bg-gray-750',
        showAnswer ? 'min-h-[300px]' : 'min-h-[200px]'
      )}
    >
      <div className="text-center">
        {!showAnswer ? (
          <>
            <p className="text-xs uppercase tracking-wide text-gray-500">Question</p>
            <p className="mt-4 text-xl text-white">{card.front}</p>
            <p className="mt-8 text-sm text-gray-500">Click to reveal answer</p>
          </>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wide text-gray-500">Question</p>
            <p className="mt-2 text-lg text-gray-300">{card.front}</p>

            <div className="my-6 border-t border-gray-700" />

            <p className="text-xs uppercase tracking-wide text-indigo-400">Answer</p>
            <p className="mt-4 text-xl text-white">{card.back}</p>
          </>
        )}
      </div>
    </div>
  );
}
