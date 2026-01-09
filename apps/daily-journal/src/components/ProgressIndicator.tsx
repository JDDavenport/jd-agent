import { clsx } from 'clsx';
import { CheckIcon } from '@heroicons/react/24/solid';

interface Step {
  id: number;
  title: string;
  icon: string;
}

interface Props {
  steps: Step[];
  currentStep: number;
  onStepClick: (stepId: number) => void;
}

export function ProgressIndicator({ steps, currentStep, onStepClick }: Props) {
  return (
    <nav aria-label="Progress" className="flex items-center justify-between">
      <ol className="flex items-center w-full">
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.id}
              className={clsx('flex items-center', !isLast && 'flex-1')}
            >
              <button
                onClick={() => onStepClick(step.id)}
                className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
                  'hover:bg-gray-100',
                  isCurrent && 'bg-blue-50 ring-2 ring-blue-500',
                  isCompleted && 'text-green-600'
                )}
              >
                <span
                  className={clsx(
                    'flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium',
                    isCompleted && 'bg-green-100 text-green-600',
                    isCurrent && 'bg-blue-500 text-white',
                    !isCompleted && !isCurrent && 'bg-gray-100 text-gray-500'
                  )}
                >
                  {isCompleted ? (
                    <CheckIcon className="w-4 h-4" />
                  ) : (
                    <span>{step.icon}</span>
                  )}
                </span>
                <span
                  className={clsx(
                    'hidden sm:block text-sm font-medium',
                    isCurrent && 'text-blue-600',
                    isCompleted && 'text-green-600',
                    !isCompleted && !isCurrent && 'text-gray-500'
                  )}
                >
                  {step.title}
                </span>
              </button>

              {!isLast && (
                <div
                  className={clsx(
                    'flex-1 h-0.5 mx-2',
                    isCompleted ? 'bg-green-400' : 'bg-gray-200'
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
