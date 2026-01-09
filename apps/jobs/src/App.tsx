import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { ManualEntryModal } from '@/components/jobs/ManualEntryModal';
import { Dashboard } from '@/views/Dashboard';
import { Pipeline } from '@/views/Pipeline';
import { Jobs } from '@/views/Jobs';
import { Resumes } from '@/views/Resumes';
import { Profile } from '@/views/Profile';
import { Settings } from '@/views/Settings';
import { Chat } from '@/views/Chat';
import { useCreateManualJob } from '@/hooks/useJobs';

type View = 'chat' | 'dashboard' | 'pipeline' | 'jobs' | 'resumes' | 'profile' | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const createJob = useCreateManualJob();

  const handleAddJob = async (data: any) => {
    try {
      await createJob.mutateAsync(data);
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Failed to create job:', error);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'chat':
        return <Chat />;
      case 'dashboard':
        return <Dashboard />;
      case 'pipeline':
        return <Pipeline />;
      case 'jobs':
        return <Jobs />;
      case 'resumes':
        return <Resumes />;
      case 'profile':
        return <Profile />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        currentView={currentView}
        onViewChange={(view) => setCurrentView(view as View)}
        onAddJob={() => setIsAddModalOpen(true)}
      />

      {renderView()}

      <ManualEntryModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddJob}
        isSubmitting={createJob.isPending}
      />
    </div>
  );
}

export default App;
