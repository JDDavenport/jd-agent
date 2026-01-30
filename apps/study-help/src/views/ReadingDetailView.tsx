import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  AcademicCapIcon,
  SparklesIcon,
  PaperAirplaneIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useBook, useChapters, useChapter, useSummary, useChat, useGenerateFlashcards, useGenerateQuiz } from '../hooks/useStudy';
import type { SummaryLength, Chapter } from '../types';

type ViewMode = 'summary' | 'chat' | 'flashcards' | 'quiz';

export function ReadingDetailView() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId?: string }>();
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(chapterId || null);
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('medium');
  const [viewMode, setViewMode] = useState<ViewMode>('summary');
  
  const { data: book, isLoading: bookLoading } = useBook(bookId!);
  const { data: chapters, isLoading: chaptersLoading } = useChapters(bookId!);

  // Set first chapter if none selected
  useEffect(() => {
    if (chapters && chapters.length > 0 && !selectedChapterId) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [chapters, selectedChapterId]);

  if (bookLoading || chaptersLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 bg-gray-200 rounded" />
          <div className="h-10 w-64 bg-gray-200 rounded" />
          <div className="h-96 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="text-center py-12">
          <p className="text-gray-500">Book not found</p>
          <Link to="/readings" className="text-blue-600 hover:underline mt-2 inline-block">
            Back to library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <Link to="/readings" className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-2">
            <ArrowLeftIcon className="w-4 h-4" />
            Back to library
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{book.title}</h1>
          {book.author && <p className="text-gray-500">{book.author}</p>}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex gap-6">
          {/* Chapters sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-32">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <h2 className="font-semibold text-gray-900">Chapters</h2>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {chapters && chapters.length > 0 ? (
                  chapters.map((chapter) => (
                    <button
                      key={chapter.id}
                      onClick={() => setSelectedChapterId(chapter.id)}
                      className={clsx(
                        'w-full text-left px-4 py-3 border-b border-gray-100 transition-colors',
                        selectedChapterId === chapter.id
                          ? 'bg-blue-50 text-blue-700'
                          : 'hover:bg-gray-50 text-gray-700'
                      )}
                    >
                      <p className="text-sm font-medium line-clamp-2">
                        {chapter.title || `Chapter ${chapter.chapterNumber}`}
                      </p>
                      {chapter.wordCount && (
                        <p className="text-xs text-gray-400 mt-1">
                          ~{Math.ceil(chapter.wordCount / 250)} min read
                        </p>
                      )}
                    </button>
                  ))
                ) : (
                  <p className="p-4 text-sm text-gray-500 text-center">No chapters found</p>
                )}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1">
            {selectedChapterId ? (
              <ChapterContent
                bookId={bookId!}
                chapterId={selectedChapterId}
                summaryLength={summaryLength}
                setSummaryLength={setSummaryLength}
                viewMode={viewMode}
                setViewMode={setViewMode}
              />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <BookOpenIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Select a chapter to start reading</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ChapterContentProps {
  bookId: string;
  chapterId: string;
  summaryLength: SummaryLength;
  setSummaryLength: (length: SummaryLength) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

function ChapterContent({
  bookId,
  chapterId,
  summaryLength,
  setSummaryLength,
  viewMode,
  setViewMode,
}: ChapterContentProps) {
  const { data: chapter } = useChapter(chapterId);
  const { data: summaryData, isLoading: summaryLoading, error: summaryError } = useSummary(chapterId, summaryLength);

  const modes = [
    { id: 'summary' as const, label: 'Summary', icon: DocumentTextIcon },
    { id: 'chat' as const, label: 'Chat', icon: ChatBubbleLeftRightIcon },
    { id: 'flashcards' as const, label: 'Flashcards', icon: AcademicCapIcon },
    { id: 'quiz' as const, label: 'Quiz', icon: SparklesIcon },
  ];

  return (
    <div className="space-y-4">
      {/* Chapter header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-lg font-bold text-gray-900">
          {chapter?.title || `Chapter ${chapter?.chapterNumber}`}
        </h2>
        {chapter?.wordCount && (
          <p className="text-sm text-gray-500 mt-1">
            {chapter.wordCount.toLocaleString()} words • 
            ~{Math.ceil(chapter.wordCount / 250)} min to read full text
          </p>
        )}
      </div>

      {/* Mode tabs */}
      <div className="bg-white rounded-xl border border-gray-200 p-2 flex gap-2">
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setViewMode(mode.id)}
            className={clsx(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors',
              viewMode === mode.id
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <mode.icon className="w-4 h-4" />
            {mode.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {viewMode === 'summary' && (
        <SummaryView
          chapterId={chapterId}
          summaryLength={summaryLength}
          setSummaryLength={setSummaryLength}
          summaryData={summaryData}
          summaryLoading={summaryLoading}
          summaryError={summaryError}
        />
      )}

      {viewMode === 'chat' && (
        <ChatView bookId={bookId} chapterId={chapterId} chapterTitle={chapter?.title} />
      )}

      {viewMode === 'flashcards' && (
        <FlashcardsView chapterId={chapterId} />
      )}

      {viewMode === 'quiz' && (
        <QuizView chapterId={chapterId} />
      )}
    </div>
  );
}

// Summary View
interface SummaryViewProps {
  chapterId: string;
  summaryLength: SummaryLength;
  setSummaryLength: (length: SummaryLength) => void;
  summaryData: { summary: string; length: SummaryLength } | undefined;
  summaryLoading: boolean;
  summaryError: Error | null;
}

function SummaryView({ summaryLength, setSummaryLength, summaryData, summaryLoading, summaryError }: SummaryViewProps) {
  const lengths: { id: SummaryLength; label: string; time: string }[] = [
    { id: 'short', label: 'Quick Overview', time: '~2 min' },
    { id: 'medium', label: '15-min Summary', time: '~15 min' },
    { id: 'long', label: '30-min Deep Dive', time: '~30 min' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Length selector */}
      <div className="flex border-b border-gray-200">
        {lengths.map((len) => (
          <button
            key={len.id}
            onClick={() => setSummaryLength(len.id)}
            className={clsx(
              'flex-1 px-4 py-3 text-sm font-medium transition-colors',
              summaryLength === len.id
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            )}
          >
            <span className="block">{len.label}</span>
            <span className="text-xs opacity-70">{len.time}</span>
          </button>
        ))}
      </div>

      {/* Summary content */}
      <div className="p-6">
        {summaryLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Generating {summaryLength} summary...</p>
            <p className="text-sm text-gray-400 mt-1">This may take a minute</p>
          </div>
        ) : summaryError ? (
          <div className="text-center py-12 text-red-600">
            <p>Failed to generate summary</p>
            <p className="text-sm mt-1">{summaryError.message}</p>
          </div>
        ) : summaryData?.summary ? (
          <div className="prose-study max-w-none">
            {summaryData.summary.split('\n').map((line, i) => {
              if (line.startsWith('## ')) {
                return <h2 key={i}>{line.replace('## ', '')}</h2>;
              }
              if (line.startsWith('### ')) {
                return <h3 key={i}>{line.replace('### ', '')}</h3>;
              }
              if (line.startsWith('- ')) {
                return <li key={i}>{line.replace('- ', '')}</li>;
              }
              if (line.trim() === '') return <br key={i} />;
              return <p key={i}>{line}</p>;
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <SparklesIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Click a summary length to generate</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Chat View
interface ChatViewProps {
  bookId: string;
  chapterId: string;
  chapterTitle?: string | null;
}

function ChatView({ bookId, chapterId, chapterTitle }: ChatViewProps) {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chat = useChat();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || chat.isPending) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

    try {
      const result = await chat.mutateAsync({
        bookId,
        message: userMessage,
        chapterId,
        conversationId,
      });

      setConversationId(result.conversationId);
      setMessages((prev) => [...prev, { role: 'assistant', content: result.response }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col h-[500px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h3 className="font-medium text-gray-900">Ask about this chapter</h3>
        {chapterTitle && <p className="text-sm text-gray-500">{chapterTitle}</p>}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <ChatBubbleLeftRightIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>Ask any question about this chapter</p>
            <p className="text-sm mt-1">I'll help you understand the content</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={clsx(
                'max-w-[80%] p-3 rounded-xl',
                msg.role === 'user'
                  ? 'ml-auto bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-900'
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))
        )}
        {chat.isPending && (
          <div className="flex gap-2 text-gray-400">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask a question..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || chat.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Flashcards View
function FlashcardsView({ chapterId }: { chapterId: string }) {
  const generateFlashcards = useGenerateFlashcards();
  const [flashcards, setFlashcards] = useState<Array<{ id: string; front: string; back: string }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const handleGenerate = async () => {
    try {
      const cards = await generateFlashcards.mutateAsync({ chapterId, count: 10 });
      setFlashcards(cards);
      setCurrentIndex(0);
      setShowAnswer(false);
    } catch (error) {
      console.error('Failed to generate flashcards:', error);
    }
  };

  const currentCard = flashcards[currentIndex];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {flashcards.length === 0 ? (
        <div className="text-center py-12">
          <AcademicCapIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Generate Flashcards</h3>
          <p className="text-gray-500 mb-4">Create flashcards from this chapter for spaced repetition learning</p>
          <button
            onClick={handleGenerate}
            disabled={generateFlashcards.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {generateFlashcards.isPending ? 'Generating...' : 'Generate 10 Cards'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center text-sm text-gray-500">
            Card {currentIndex + 1} of {flashcards.length}
          </div>

          {/* Card */}
          <div
            className="min-h-[200px] p-6 rounded-xl border-2 border-gray-200 cursor-pointer transition-all hover:border-blue-300"
            onClick={() => setShowAnswer(!showAnswer)}
          >
            {showAnswer ? (
              <div>
                <p className="text-xs text-green-600 font-medium mb-2">ANSWER</p>
                <p className="text-gray-900">{currentCard?.back}</p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-blue-600 font-medium mb-2">QUESTION</p>
                <p className="text-gray-900 text-lg">{currentCard?.front}</p>
              </div>
            )}
          </div>

          <p className="text-center text-sm text-gray-400">Click card to flip</p>

          {/* Navigation */}
          <div className="flex justify-center gap-2">
            <button
              onClick={() => { setCurrentIndex(Math.max(0, currentIndex - 1)); setShowAnswer(false); }}
              disabled={currentIndex === 0}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => { setCurrentIndex(Math.min(flashcards.length - 1, currentIndex + 1)); setShowAnswer(false); }}
              disabled={currentIndex === flashcards.length - 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Quiz View
function QuizView({ chapterId }: { chapterId: string }) {
  const generateQuiz = useGenerateQuiz();
  const [quiz, setQuiz] = useState<{
    quizId: string;
    questions: Array<{
      id: string;
      type: string;
      question: string;
      options?: string[];
      correctAnswer: string;
      explanation: string;
    }>;
  } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);

  const handleGenerate = async () => {
    try {
      const result = await generateQuiz.mutateAsync({
        chapterId,
        questionCount: 5,
        difficulty: 'medium',
      });
      setQuiz(result);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setShowResult(false);
      setScore(0);
    } catch (error) {
      console.error('Failed to generate quiz:', error);
    }
  };

  const handleAnswer = () => {
    if (!selectedAnswer || !quiz) return;
    
    const currentQuestion = quiz.questions[currentIndex];
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    if (isCorrect) setScore((s) => s + 1);
    setShowResult(true);
  };

  const handleNext = () => {
    if (currentIndex < quiz!.questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };

  const currentQuestion = quiz?.questions[currentIndex];
  const isLastQuestion = quiz && currentIndex === quiz.questions.length - 1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {!quiz ? (
        <div className="text-center py-12">
          <SparklesIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Test Your Knowledge</h3>
          <p className="text-gray-500 mb-4">Generate a quiz to test your understanding</p>
          <button
            onClick={handleGenerate}
            disabled={generateQuiz.isPending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {generateQuiz.isPending ? 'Generating...' : 'Start Quiz (5 Questions)'}
          </button>
        </div>
      ) : showResult && isLastQuestion ? (
        // Final score
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-2xl font-bold text-gray-900">Quiz Complete!</h3>
          <p className="text-4xl font-bold text-blue-600 mt-4">
            {score}/{quiz.questions.length}
          </p>
          <p className="text-gray-500 mt-2">
            {score === quiz.questions.length ? 'Perfect!' : score >= quiz.questions.length / 2 ? 'Good job!' : 'Keep studying!'}
          </p>
          <button
            onClick={handleGenerate}
            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Another Quiz
          </button>
        </div>
      ) : currentQuestion ? (
        <div className="space-y-4">
          <div className="text-sm text-gray-500">
            Question {currentIndex + 1} of {quiz.questions.length}
          </div>

          <p className="text-lg font-medium text-gray-900">{currentQuestion.question}</p>

          {currentQuestion.options && (
            <div className="space-y-2">
              {currentQuestion.options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => !showResult && setSelectedAnswer(option)}
                  disabled={showResult}
                  className={clsx(
                    'w-full text-left p-4 rounded-lg border-2 transition-colors',
                    selectedAnswer === option
                      ? showResult
                        ? option === currentQuestion.correctAnswer
                          ? 'border-green-500 bg-green-50'
                          : 'border-red-500 bg-red-50'
                        : 'border-blue-500 bg-blue-50'
                      : showResult && option === currentQuestion.correctAnswer
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {showResult && (
            <div className={clsx(
              'p-4 rounded-lg',
              selectedAnswer === currentQuestion.correctAnswer
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            )}>
              <p className="font-medium">
                {selectedAnswer === currentQuestion.correctAnswer ? '✓ Correct!' : '✗ Incorrect'}
              </p>
              <p className="text-sm mt-1">{currentQuestion.explanation}</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            {!showResult ? (
              <button
                onClick={handleAnswer}
                disabled={!selectedAnswer}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Check Answer
              </button>
            ) : !isLastQuestion ? (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Next Question
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
