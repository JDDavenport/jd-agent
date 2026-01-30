import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AcademicCapIcon,
  BookOpenIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useDueFlashcards, useReviewFlashcard, useBooks } from '../hooks/useStudy';
import type { Flashcard } from '../types';

export function FlashcardsView() {
  const { data: flashcards, isLoading, refetch } = useDueFlashcards();
  const { data: books } = useBooks();
  const reviewFlashcard = useReviewFlashcard();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);

  const currentCard = flashcards?.[currentIndex];
  const remainingCards = flashcards ? flashcards.length - currentIndex : 0;

  const handleReview = async (quality: 0 | 1 | 2 | 3 | 4 | 5) => {
    if (!currentCard) return;

    try {
      await reviewFlashcard.mutateAsync({ cardId: currentCard.id, quality });
      setReviewedCount((c) => c + 1);
      setShowAnswer(false);
      
      if (currentIndex < (flashcards?.length || 0) - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        // Finished all cards
        setCurrentIndex(0);
        refetch();
      }
    } catch (error) {
      console.error('Failed to review flashcard:', error);
    }
  };

  const getBookTitle = (bookId: string) => {
    return books?.find((b) => b.id === bookId)?.title || 'Unknown Book';
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Flashcards</h1>
        <p className="text-gray-600 mt-1">
          Review cards using spaced repetition • {reviewedCount} reviewed this session
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-blue-600">{remainingCards}</p>
          <p className="text-sm text-gray-500">Cards Due</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-green-600">{reviewedCount}</p>
          <p className="text-sm text-gray-500">Reviewed</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-2xl font-bold text-purple-600">{books?.length || 0}</p>
          <p className="text-sm text-gray-500">Books</p>
        </div>
      </div>

      {/* Flashcard area */}
      {!flashcards || flashcards.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <AcademicCapIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Cards Due</h3>
          <p className="text-gray-500 mb-6">
            All caught up! Generate flashcards from your readings to start learning.
          </p>
          <Link
            to="/readings"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <BookOpenIcon className="w-5 h-5" />
            Go to Readings
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Progress */}
          <div className="bg-gray-100 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${(currentIndex / flashcards.length) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-500 text-center">
            Card {currentIndex + 1} of {flashcards.length}
          </p>

          {/* Card */}
          <div
            onClick={() => !showAnswer && setShowAnswer(true)}
            className={clsx(
              'min-h-[300px] p-8 rounded-2xl border-2 transition-all cursor-pointer',
              showAnswer
                ? 'bg-green-50 border-green-200'
                : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-lg'
            )}
          >
            {/* Book tag */}
            <div className="mb-4">
              <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                {getBookTitle(currentCard?.bookId || '')}
              </span>
            </div>

            {showAnswer ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">
                    Question
                  </p>
                  <p className="text-gray-700">{currentCard?.front}</p>
                </div>
                <hr className="border-gray-200" />
                <div>
                  <p className="text-xs text-green-600 font-medium uppercase tracking-wide mb-2">
                    Answer
                  </p>
                  <p className="text-gray-900 text-lg">{currentCard?.back}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px]">
                <p className="text-xl text-center text-gray-900">{currentCard?.front}</p>
                <p className="text-sm text-gray-400 mt-4">Click to reveal answer</p>
              </div>
            )}
          </div>

          {/* Rating buttons */}
          {showAnswer && (
            <div className="space-y-3">
              <p className="text-center text-sm text-gray-600">How well did you know it?</p>
              <div className="flex justify-center gap-2">
                <RatingButton
                  label="Again"
                  subLabel="Forgot"
                  color="red"
                  onClick={() => handleReview(0)}
                  disabled={reviewFlashcard.isPending}
                />
                <RatingButton
                  label="Hard"
                  subLabel="Struggled"
                  color="orange"
                  onClick={() => handleReview(2)}
                  disabled={reviewFlashcard.isPending}
                />
                <RatingButton
                  label="Good"
                  subLabel="Remembered"
                  color="blue"
                  onClick={() => handleReview(3)}
                  disabled={reviewFlashcard.isPending}
                />
                <RatingButton
                  label="Easy"
                  subLabel="Instant"
                  color="green"
                  onClick={() => handleReview(5)}
                  disabled={reviewFlashcard.isPending}
                />
              </div>
            </div>
          )}

          {/* Skip button */}
          {!showAnswer && (
            <div className="flex justify-center">
              <button
                onClick={() => {
                  if (currentIndex < flashcards.length - 1) {
                    setCurrentIndex((i) => i + 1);
                  }
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Skip this card
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-8 flex justify-center">
        <button
          onClick={() => {
            setCurrentIndex(0);
            setShowAnswer(false);
            refetch();
          }}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowPathIcon className="w-4 h-4" />
          Refresh Cards
        </button>
      </div>
    </div>
  );
}

interface RatingButtonProps {
  label: string;
  subLabel: string;
  color: 'red' | 'orange' | 'blue' | 'green';
  onClick: () => void;
  disabled?: boolean;
}

function RatingButton({ label, subLabel, color, onClick, disabled }: RatingButtonProps) {
  const colors = {
    red: 'bg-red-50 hover:bg-red-100 border-red-200 text-red-700',
    orange: 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700',
    blue: 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700',
    green: 'bg-green-50 hover:bg-green-100 border-green-200 text-green-700',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'px-6 py-3 rounded-xl border-2 transition-colors disabled:opacity-50',
        colors[color]
      )}
    >
      <span className="block font-semibold">{label}</span>
      <span className="block text-xs opacity-70">{subLabel}</span>
    </button>
  );
}
