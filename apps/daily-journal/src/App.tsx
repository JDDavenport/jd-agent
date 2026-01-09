import { useState, useCallback } from 'react';
import { ReviewWorkflow } from './components/ReviewWorkflow';
import { HistoryView } from './views/HistoryView';
import { format } from 'date-fns';

type ViewMode = 'review' | 'history';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('review');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleViewHistory = useCallback(() => {
    setViewMode('history');
  }, []);

  const handleStartReview = useCallback((date?: string) => {
    setSelectedDate(date || format(new Date(), 'yyyy-MM-dd'));
    setViewMode('review');
  }, []);

  const handleReviewComplete = useCallback(() => {
    setViewMode('history');
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      {viewMode === 'review' ? (
        <ReviewWorkflow
          date={selectedDate}
          onViewHistory={handleViewHistory}
          onComplete={handleReviewComplete}
        />
      ) : (
        <HistoryView onStartReview={handleStartReview} />
      )}
    </div>
  );
}

export default App;
