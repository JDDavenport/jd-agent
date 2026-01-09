import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/24/outline';

interface Props {
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  isLastStep: boolean;
}

export function StepNavigation({
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  isLastStep,
}: Props) {
  return (
    <div className="flex items-center justify-between max-w-3xl mx-auto">
      <button
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Previous
      </button>

      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span>Press</span>
        <kbd className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
          {canGoPrevious ? '←' : ''} {canGoNext ? '→' : ''}
        </kbd>
        <span>to navigate</span>
      </div>

      {canGoNext && (
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Next
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      )}

      {isLastStep && <div className="w-[100px]" />}
    </div>
  );
}
