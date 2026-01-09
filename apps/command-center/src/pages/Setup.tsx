import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useServices,
  useTestService,
  useAddBrainDumpTask,
  useNextInboxItem,
  useProcessInboxItem,
  useCeremonies,
  useTestCeremony,
  useClasses,
  useAddClass,
  useSetupSummary,
  useMarkSetupComplete,
} from '../hooks/useSetup';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';

function Setup() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [taskInput, setTaskInput] = useState('');
  const [classForm, setClassForm] = useState({ name: '', courseCode: '', professor: '' });

  const { data: services, isLoading: loadingServices } = useServices();
  const { data: ceremonies } = useCeremonies();
  const { data: classes } = useClasses();
  const { data: nextItem, refetch: refetchNext } = useNextInboxItem();
  const { data: summary } = useSetupSummary();

  const testService = useTestService();
  const addTask = useAddBrainDumpTask();
  const processItem = useProcessInboxItem();
  const testCeremony = useTestCeremony();
  const addClass = useAddClass();
  const markComplete = useMarkSetupComplete();

  const steps = [
    'Welcome',
    'Service Check',
    'Brain Dump',
    'Inbox Processing',
    'Ceremonies',
    'Classes',
    'Complete',
  ];

  const handleTestService = async (serviceName: string) => {
    try {
      const result = await testService.mutateAsync(serviceName);
      alert(result.message);
    } catch (error) {
      alert(`Failed to test service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAddTask = async () => {
    if (!taskInput.trim()) return;
    try {
      await addTask.mutateAsync({ title: taskInput });
      setTaskInput('');
    } catch (error) {
      alert(`Failed to add task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleProcessInbox = async (action: 'today' | 'upcoming' | 'someday' | 'waiting' | 'delete') => {
    if (!nextItem?.data) return;
    try {
      await processItem.mutateAsync({ id: nextItem.data.id, action });
      await refetchNext();
    } catch (error) {
      alert(`Failed to process item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleTestCeremony = async (type: string) => {
    try {
      const result = await testCeremony.mutateAsync(type);
      alert(`Test ${type} ceremony sent via ${result.channel}!`);
    } catch (error) {
      alert(`Failed to send test: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAddClass = async () => {
    if (!classForm.name || !classForm.courseCode) {
      alert('Name and course code are required');
      return;
    }
    try {
      await addClass.mutateAsync(classForm);
      setClassForm({ name: '', courseCode: '', professor: '' });
    } catch (error) {
      alert(`Failed to add class: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleComplete = async () => {
    try {
      await markComplete.mutateAsync();
      navigate('/');
    } catch (error) {
      alert(`Failed to complete setup: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loadingServices) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Progress Bar */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Setup Progress</h2>
          <span className="text-text-muted">
            Step {currentStep + 1} of {steps.length}
          </span>
        </div>
        <div className="flex space-x-2">
          {steps.map((step, index) => (
            <div
              key={step}
              className={`flex-1 h-2 rounded-full transition-colors ${
                index <= currentStep ? 'bg-accent' : 'bg-dark-card-hover'
              }`}
            />
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-text-muted">
          {steps.map((step, index) => (
            <span key={step} className={index === currentStep ? 'text-accent font-medium' : ''}>
              {step}
            </span>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="card min-h-96">
        {/* Step 0: Welcome */}
        {currentStep === 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-4">Welcome to JD Agent</h1>
              <p className="text-lg text-text-muted">
                Your AI-powered productivity system for managing tasks, schedules, and goals.
              </p>
            </div>

            <div className="bg-dark-card-hover p-6 rounded-lg space-y-4">
              <h3 className="text-lg font-semibold">What we'll set up:</h3>
              <ul className="space-y-2 text-text-muted">
                <li className="flex items-center space-x-2">
                  <span className="text-accent">✓</span>
                  <span>Connect your tools (Telegram, Canvas, Linear, etc.)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-accent">✓</span>
                  <span>Capture all your tasks in a brain dump</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-accent">✓</span>
                  <span>Process your inbox and organize your work</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-accent">✓</span>
                  <span>Configure daily ceremonies and notifications</span>
                </li>
                <li className="flex items-center space-x-2">
                  <span className="text-accent">✓</span>
                  <span>Add your classes and schedule</span>
                </li>
              </ul>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setCurrentStep(1)}>Get Started →</Button>
            </div>
          </div>
        )}

        {/* Step 1: Service Check */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Service Connections</h2>
              <p className="text-text-muted">Test your integrations to ensure everything is working.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services?.map((service) => (
                <div key={service.name} className="bg-dark-card-hover p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{service.displayName}</h3>
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        service.connected
                          ? 'bg-success/20 text-success'
                          : service.configured
                          ? 'bg-warning/20 text-warning'
                          : 'bg-error/20 text-error'
                      }`}
                    >
                      {service.connected ? 'Connected' : service.configured ? 'Configured' : 'Not Set'}
                    </span>
                  </div>

                  {service.configured && !service.connected && (
                    <Button
                      variant="secondary"
                      onClick={() => handleTestService(service.name)}
                      disabled={testService.isPending}
                      className="w-full"
                    >
                      Test Connection
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setCurrentStep(0)}>
                ← Back
              </Button>
              <Button onClick={() => setCurrentStep(2)}>Continue →</Button>
            </div>
          </div>
        )}

        {/* Step 2: Brain Dump */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Brain Dump</h2>
              <p className="text-text-muted">
                Get everything out of your head. Add all your tasks, ideas, and to-dos here.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                  placeholder="What's on your mind?"
                  className="input flex-1"
                />
                <Button onClick={handleAddTask} disabled={!taskInput.trim() || addTask.isPending}>
                  Add
                </Button>
              </div>

              <p className="text-sm text-text-muted">
                Press Enter to quickly add items. We'll organize them in the next step.
              </p>
            </div>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setCurrentStep(1)}>
                ← Back
              </Button>
              <Button onClick={() => setCurrentStep(3)}>Continue →</Button>
            </div>
          </div>
        )}

        {/* Step 3: Inbox Processing */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Process Your Inbox</h2>
              <p className="text-text-muted">
                Let's organize your tasks. {nextItem?.remaining || 0} items remaining.
              </p>
            </div>

            {nextItem?.data ? (
              <div className="bg-dark-card-hover p-6 rounded-lg space-y-4">
                <div>
                  <h3 className="text-xl font-semibold mb-2">{nextItem.data.title}</h3>
                  {nextItem.data.description && (
                    <p className="text-text-muted">{nextItem.data.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => handleProcessInbox('today')}>Add to Today</Button>
                  <Button variant="secondary" onClick={() => handleProcessInbox('upcoming')}>
                    Upcoming
                  </Button>
                  <Button variant="secondary" onClick={() => handleProcessInbox('someday')}>
                    Someday
                  </Button>
                  <Button variant="secondary" onClick={() => handleProcessInbox('waiting')}>
                    Waiting
                  </Button>
                  <Button variant="ghost" onClick={() => handleProcessInbox('delete')}>
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-2xl mb-2">🎉</p>
                <p className="text-lg font-semibold">Inbox Zero!</p>
                <p className="text-text-muted">All tasks have been processed.</p>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setCurrentStep(2)}>
                ← Back
              </Button>
              <Button onClick={() => setCurrentStep(4)}>Continue →</Button>
            </div>
          </div>
        )}

        {/* Step 4: Ceremonies */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Daily Ceremonies</h2>
              <p className="text-text-muted">
                Configure when you want to receive your daily briefings and reviews.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-dark-card-hover p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">🌅 Morning Briefing</h3>
                    <p className="text-sm text-text-muted">
                      Time: {ceremonies?.morningTime || '6:00 AM'}
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => handleTestCeremony('morning')}>
                    Test
                  </Button>
                </div>
              </div>

              <div className="bg-dark-card-hover p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">🌙 Evening Review</h3>
                    <p className="text-sm text-text-muted">
                      Time: {ceremonies?.eveningTime || '9:00 PM'}
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => handleTestCeremony('evening')}>
                    Test
                  </Button>
                </div>
              </div>

              <div className="bg-dark-card-hover p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">📅 Weekly Planning</h3>
                    <p className="text-sm text-text-muted">
                      {ceremonies?.weeklyDay} at {ceremonies?.weeklyTime}
                    </p>
                  </div>
                  <Button variant="secondary" onClick={() => handleTestCeremony('weekly')}>
                    Test
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setCurrentStep(3)}>
                ← Back
              </Button>
              <Button onClick={() => setCurrentStep(5)}>Continue →</Button>
            </div>
          </div>
        )}

        {/* Step 5: Classes */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Your Classes</h2>
              <p className="text-text-muted">Add your courses to track assignments and deadlines.</p>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={classForm.name}
                  onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                  placeholder="Class name (e.g., Data Structures)"
                  className="input"
                />
                <input
                  type="text"
                  value={classForm.courseCode}
                  onChange={(e) => setClassForm({ ...classForm, courseCode: e.target.value })}
                  placeholder="Course code (e.g., CS 201)"
                  className="input"
                />
                <input
                  type="text"
                  value={classForm.professor}
                  onChange={(e) => setClassForm({ ...classForm, professor: e.target.value })}
                  placeholder="Professor (optional)"
                  className="input"
                />
              </div>
              <Button onClick={handleAddClass} disabled={addClass.isPending}>
                Add Class
              </Button>
            </div>

            {classes && classes.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold">Added Classes:</h3>
                {classes.map((cls) => (
                  <div key={cls.id} className="bg-dark-card-hover p-3 rounded flex justify-between">
                    <div>
                      <span className="font-medium">{cls.name}</span>
                      <span className="text-text-muted ml-2">({cls.courseCode})</span>
                      {cls.professor && (
                        <span className="text-text-muted ml-2">• {cls.professor}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setCurrentStep(4)}>
                ← Back
              </Button>
              <Button onClick={() => setCurrentStep(6)}>Continue →</Button>
            </div>
          </div>
        )}

        {/* Step 6: Complete */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">You're All Set!</h2>
              <p className="text-text-muted">Here's what we've configured:</p>
            </div>

            <div className="space-y-4">
              <div className="bg-dark-card-hover p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Connected Services</h3>
                <p className="text-text-muted">
                  {summary?.connectedServices.join(', ') || 'None yet'}
                </p>
              </div>

              <div className="bg-dark-card-hover p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Tasks</h3>
                <p className="text-text-muted">
                  {summary?.taskCounts?.total || 0} tasks ready to organize
                </p>
              </div>

              <div className="bg-dark-card-hover p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Classes</h3>
                <p className="text-text-muted">{summary?.classCount || 0} classes added</p>
              </div>

              <div className="bg-dark-card-hover p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Next Steps</h3>
                <ul className="space-y-1 text-text-muted">
                  {summary?.nextSteps.map((step, i) => (
                    <li key={i}>• {step}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setCurrentStep(5)}>
                ← Back
              </Button>
              <Button onClick={handleComplete} disabled={markComplete.isPending}>
                Complete Setup →
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Setup;
