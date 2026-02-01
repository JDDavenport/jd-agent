import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBook, getChapter, getChapterSummary, getKeyConcepts, chat, generateQuiz, submitQuiz, generateFlashcards } from '../api';
import type { QuizQuestion, KeyConcept, SummaryLength } from '../types';
import { FormattedCaseContent } from '../components/FormattedCaseContent';
import { InlineChatPanel } from '../components/InlineChatPanel';
import {
  ArrowLeftIcon,
  ClockIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  AcademicCapIcon,
  LightBulbIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

type Tab = 'summary' | 'chat' | 'quiz' | 'concepts';

export function ChapterView() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [readingMode, setReadingMode] = useState<'full' | '30min' | '15min'>('full');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResults, setQuizResults] = useState<{ score: number; results: Array<{ questionId: string; correct: boolean; explanation: string }> } | null>(null);

  const { data: book } = useQuery({
    queryKey: ['book', bookId],
    queryFn: () => getBook(bookId!),
    enabled: !!bookId,
  });

  const { data: chapter, isLoading: chapterLoading } = useQuery({
    queryKey: ['chapter', chapterId],
    queryFn: () => getChapter(chapterId!),
    enabled: !!chapterId,
  });

  // Map reading mode to summary length for API
  const summaryLength: SummaryLength =
    readingMode === '15min' ? 'medium' :
    readingMode === '30min' ? 'long' :
    'long'; // fallback (not used for 'full' mode)

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['summary', chapterId, summaryLength],
    queryFn: () => getChapterSummary(chapterId!, summaryLength),
    enabled: !!chapterId && activeTab === 'summary' && readingMode !== 'full',
  });

  const { data: concepts, isLoading: conceptsLoading } = useQuery({
    queryKey: ['concepts', chapterId],
    queryFn: () => getKeyConcepts(chapterId!),
    enabled: !!chapterId && activeTab === 'concepts',
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      setChatHistory((prev) => [...prev, { role: 'user', content: message }]);
      const result = await chat(bookId!, message, {
        chapterId: chapterId!,
        conversationId: conversationId || undefined,
      });
      setConversationId(result.conversationId);
      setChatHistory((prev) => [...prev, { role: 'assistant', content: result.response }]);
      return result;
    },
  });

  const quizMutation = useMutation({
    mutationFn: () => generateQuiz(chapterId!, { questionCount: 5 }),
  });

  const submitQuizMutation = useMutation({
    mutationFn: async () => {
      if (!quizMutation.data) return null;
      const answers = Object.entries(quizAnswers).map(([questionId, answer]) => ({
        questionId,
        answer,
      }));
      const results = await submitQuiz(quizMutation.data.quizId, answers);
      setQuizSubmitted(true);
      setQuizResults(results);
      return results;
    },
  });

  const flashcardsMutation = useMutation({
    mutationFn: () => generateFlashcards(chapterId!, 10),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flashcards'] });
    },
  });

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() && !chatMutation.isPending) {
      chatMutation.mutate(chatInput.trim());
      setChatInput('');
    }
  };

  const tabs = [
    { id: 'summary' as Tab, label: 'Summary', icon: DocumentTextIcon },
    { id: 'chat' as Tab, label: 'Ask AI', icon: ChatBubbleLeftRightIcon },
    { id: 'quiz' as Tab, label: 'Quiz', icon: AcademicCapIcon },
    { id: 'concepts' as Tab, label: 'Concepts', icon: LightBulbIcon },
  ];

  if (chapterLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-gray-400">
        <DocumentTextIcon className="h-12 w-12" />
        <p>Chapter not found</p>
        <Link
          to={`/books/${bookId}`}
          className="rounded-lg bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600"
        >
          Back to Book
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800 p-4">
        <Link
          to={`/books/${bookId}`}
          className="mb-2 inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {book?.title || 'Back'}
        </Link>
        <h1 className="text-xl font-bold text-white">
          {chapter.title || `Chapter ${chapter.chapterNumber}`}
        </h1>
        <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <ClockIcon className="h-4 w-4" />
            {chapter.wordCount && Math.round(chapter.wordCount / 250)} min read
          </span>
          {chapter.startPage && chapter.endPage && (
            <span>Pages {chapter.startPage}-{chapter.endPage}</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 bg-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium transition',
              activeTab === tab.id
                ? 'border-b-2 border-indigo-500 text-white'
                : 'text-gray-400 hover:text-white'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-6 max-w-full">
        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div>
            <div className="mb-6 flex items-center gap-4">
              <span className="text-sm font-medium text-gray-400">Reading Mode:</span>
              {[
                { id: 'full' as const, label: 'Full Case', time: chapter.wordCount ? `${Math.round(chapter.wordCount / 250)} min` : '' },
                { id: '30min' as const, label: '30-Min Summary', time: '~30 min' },
                { id: '15min' as const, label: '15-Min Summary', time: '~15 min' },
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setReadingMode(mode.id)}
                  className={clsx(
                    'flex flex-col items-center rounded-lg px-4 py-2 text-sm transition-colors',
                    readingMode === mode.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  )}
                >
                  <span className="font-medium">{mode.label}</span>
                  {mode.time && <span className="text-xs opacity-75">{mode.time}</span>}
                </button>
              ))}
            </div>

            {readingMode === 'full' ? (
              <>
                <FormattedCaseContent
                  content={chapter.content}
                  chapterTitle={chapter.title || `Chapter ${chapter.chapterNumber}`}
                />
                <InlineChatPanel
                  bookId={bookId!}
                  chapterId={chapterId!}
                  chapterTitle={chapter.title || `Chapter ${chapter.chapterNumber}`}
                />
              </>
            ) : summaryLoading ? (
              <div className="flex items-center justify-center py-12">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-3 text-gray-400">Generating {readingMode === '30min' ? '30-minute' : '15-minute'} summary...</span>
              </div>
            ) : summary ? (
              <div className="prose prose-invert max-w-none">
                <div className="mb-4 rounded-lg bg-indigo-900/20 border border-indigo-500/30 p-4">
                  <p className="text-sm text-indigo-300">
                    <strong>Summary:</strong> This is a {readingMode === '30min' ? '30-minute' : '15-minute'} AI-generated summary.
                    Switch to "Full Case" to read the complete text.
                  </p>
                </div>
                <div className="whitespace-pre-wrap text-gray-300 leading-relaxed">
                  {summary.summary}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="flex h-full flex-col">
            <div className="flex-1 space-y-4 overflow-auto pb-4">
              {chatHistory.length === 0 && (
                <div className="py-12 text-center text-gray-500">
                  <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12" />
                  <p className="mt-4">Ask me anything about this chapter</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {[
                      'What are the key points?',
                      'Explain the main argument',
                      'What frameworks are discussed?',
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setChatInput(q);
                          chatMutation.mutate(q);
                        }}
                        className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-600"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={clsx(
                    'rounded-lg p-4',
                    msg.role === 'user'
                      ? 'ml-12 bg-indigo-600'
                      : 'mr-12 bg-gray-800'
                  )}
                >
                  <p className="whitespace-pre-wrap text-sm text-white">{msg.content}</p>
                </div>
              ))}

              {chatMutation.isPending && (
                <div className="mr-12 rounded-lg bg-gray-800 p-4">
                  <ArrowPathIcon className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              )}
            </div>

            <form onSubmit={handleSendChat} className="flex gap-2 pt-4">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatMutation.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </form>
          </div>
        )}

        {/* Quiz Tab */}
        {activeTab === 'quiz' && (
          <div>
            {!quizMutation.data ? (
              <div className="py-12 text-center">
                <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-500" />
                <p className="mt-4 text-gray-400">Test your understanding of this chapter</p>
                <button
                  onClick={() => quizMutation.mutate()}
                  disabled={quizMutation.isPending}
                  className="mt-4 rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {quizMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      Generating...
                    </span>
                  ) : (
                    'Generate Quiz'
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {quizMutation.data.questions.map((question, i) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    index={i}
                    answer={quizAnswers[question.id]}
                    onAnswer={(ans) =>
                      setQuizAnswers((prev) => ({ ...prev, [question.id]: ans }))
                    }
                    submitted={quizSubmitted}
                    result={quizResults?.results.find((r) => r.questionId === question.id)}
                  />
                ))}

                {!quizSubmitted && (
                  <button
                    onClick={() => submitQuizMutation.mutate()}
                    disabled={
                      Object.keys(quizAnswers).length !== quizMutation.data!.questions.length ||
                      submitQuizMutation.isPending
                    }
                    className="w-full rounded-lg bg-indigo-600 py-3 text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    Submit Answers
                  </button>
                )}

                {quizResults && (
                  <div className="rounded-lg bg-gray-800 p-6 text-center">
                    <p className="text-3xl font-bold text-white">
                      {Math.round(quizResults.score)}%
                    </p>
                    <p className="mt-2 text-gray-400">
                      You got {quizResults.results.filter((r) => r.correct).length} out of{' '}
                      {quizResults.results.length} correct
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Concepts Tab */}
        {activeTab === 'concepts' && (
          <div>
            {conceptsLoading ? (
              <div className="flex items-center justify-center py-12">
                <ArrowPathIcon className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-3 text-gray-400">Extracting concepts...</span>
              </div>
            ) : concepts && concepts.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-white">Key Concepts</h3>
                  <button
                    onClick={() => flashcardsMutation.mutate()}
                    disabled={flashcardsMutation.isPending}
                    className="rounded-lg bg-gray-700 px-3 py-1 text-sm text-gray-300 hover:bg-gray-600 disabled:opacity-50"
                  >
                    {flashcardsMutation.isPending ? 'Creating...' : 'Create Flashcards'}
                  </button>
                </div>

                {concepts.map((concept, i) => (
                  <ConceptCard key={i} concept={concept} />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500">
                <LightBulbIcon className="mx-auto h-12 w-12" />
                <p className="mt-4">No concepts extracted yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  answer,
  onAnswer,
  submitted,
  result,
}: {
  question: QuizQuestion;
  index: number;
  answer: string | undefined;
  onAnswer: (answer: string) => void;
  submitted: boolean;
  result?: { correct: boolean; explanation: string };
}) {
  return (
    <div
      className={clsx(
        'rounded-lg bg-gray-800 p-4',
        submitted && result?.correct && 'border border-green-500',
        submitted && !result?.correct && 'border border-red-500'
      )}
    >
      <p className="font-medium text-white">
        {index + 1}. {question.question}
      </p>

      <div className="mt-3 space-y-2">
        {question.type === 'multiple_choice' && question.options ? (
          question.options.map((option, i) => (
            <label
              key={i}
              className={clsx(
                'flex cursor-pointer items-center gap-3 rounded-lg p-3',
                answer === option
                  ? 'bg-indigo-600/30'
                  : 'bg-gray-700 hover:bg-gray-600',
                submitted && option === question.correctAnswer && 'bg-green-600/30',
                submitted &&
                  answer === option &&
                  option !== question.correctAnswer &&
                  'bg-red-600/30'
              )}
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={answer === option}
                onChange={() => onAnswer(option)}
                disabled={submitted}
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-200">{option}</span>
            </label>
          ))
        ) : question.type === 'true_false' ? (
          ['True', 'False'].map((option) => (
            <label
              key={option}
              className={clsx(
                'flex cursor-pointer items-center gap-3 rounded-lg p-3',
                answer === option.toLowerCase()
                  ? 'bg-indigo-600/30'
                  : 'bg-gray-700 hover:bg-gray-600'
              )}
            >
              <input
                type="radio"
                name={`q-${question.id}`}
                checked={answer === option.toLowerCase()}
                onChange={() => onAnswer(option.toLowerCase())}
                disabled={submitted}
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-200">{option}</span>
            </label>
          ))
        ) : (
          <input
            type="text"
            value={answer || ''}
            onChange={(e) => onAnswer(e.target.value)}
            disabled={submitted}
            placeholder="Your answer..."
            className="w-full rounded-lg bg-gray-700 px-4 py-2 text-white"
          />
        )}
      </div>

      {submitted && result && (
        <div className="mt-3 rounded bg-gray-700 p-3 text-sm">
          <p className={result.correct ? 'text-green-400' : 'text-red-400'}>
            {result.correct ? 'Correct!' : 'Incorrect'}
          </p>
          <p className="mt-1 text-gray-300">{result.explanation}</p>
        </div>
      )}
    </div>
  );
}

function ConceptCard({ concept }: { concept: KeyConcept }) {
  return (
    <div className="rounded-lg bg-gray-800 p-4">
      <h4 className="font-medium text-indigo-400">{concept.term}</h4>
      <p className="mt-2 text-sm text-gray-300">{concept.definition}</p>
      {concept.pageNumbers.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Pages: {concept.pageNumbers.join(', ')}
        </p>
      )}
    </div>
  );
}
