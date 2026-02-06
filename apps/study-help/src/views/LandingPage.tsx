import { useNavigate, Link } from 'react-router-dom';
import {
  AcademicCapIcon,
  ClipboardDocumentListIcon,
  ChatBubbleLeftRightIcon,
  RectangleStackIcon,
  ClockIcon,
  CalendarDaysIcon,
  SparklesIcon,
  ArrowRightIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

const features = [
  {
    name: 'Task Management',
    description: 'Track assignments, readings, and deadlines across all your courses in one place.',
    icon: ClipboardDocumentListIcon,
  },
  {
    name: 'Class GPT',
    description: 'AI chat trained on your course materials. Ask questions, get explanations, prep for exams.',
    icon: ChatBubbleLeftRightIcon,
  },
  {
    name: 'Flashcards',
    description: 'Auto-generated flashcards from lectures and readings. Spaced repetition built in.',
    icon: RectangleStackIcon,
  },
  {
    name: 'Study Timer',
    description: 'Pomodoro timer with session tracking. See exactly where your study time goes.',
    icon: ClockIcon,
  },
  {
    name: 'Smart Scheduling',
    description: 'Syncs with Canvas. Knows what\'s due, what\'s overdue, and what to work on next.',
    icon: CalendarDaysIcon,
  },
  {
    name: 'AI-Powered Insights',
    description: 'Get personalized study recommendations based on your progress and upcoming deadlines.',
    icon: SparklesIcon,
  },
];

const stats = [
  { value: '10x', label: 'Faster exam prep' },
  { value: '100%', label: 'Canvas synced' },
  { value: '0', label: 'Missed deadlines' },
];

export function LandingPage() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/sign-up');
  };

  const handleSignIn = () => {
    navigate('/sign-in');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AcademicCapIcon className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-semibold tracking-tight">Study Aide</span>
          </div>
          <button
            onClick={handleSignIn}
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Sign in
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium mb-8">
            <SparklesIcon className="h-4 w-4" />
            Built for BYU students
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Your AI
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Study Partner
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Stop juggling Canvas tabs. Study Aide syncs your courses, tracks your tasks,
            and gives you an AI tutor for every class — so you can focus on actually learning.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleGetStarted}
              className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-lg shadow-gray-900/10 dark:shadow-black/20"
            >
              Get Started Free
              <ArrowRightIcon className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <a
              href="#features"
              className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              See how it works →
            </a>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-3 gap-8 rounded-2xl bg-gray-50 dark:bg-gray-900 p-8 border border-gray-100 dark:border-gray-800">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Everything you need to ace your classes
            </h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
              One app that replaces your scattered workflow of Canvas, Google Docs, Quizlet, and sticky notes.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.name}
                className="group p-6 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-lg hover:shadow-gray-100/50 dark:hover:shadow-black/20 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-base font-semibold mb-2">{feature.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-6 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-12">
            Students love it
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                quote: "Finally, one app that actually understands my class schedule.",
                name: "MBA Student",
                detail: "BYU Marriott",
              },
              {
                quote: "Class GPT is like having a TA available 24/7. Game changer for exam prep.",
                name: "Graduate Student",
                detail: "BYU",
              },
              {
                quote: "I haven't missed a deadline since I started using Study Aide.",
                name: "MBA Student",
                detail: "BYU Marriott",
              },
            ].map((testimonial, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-left"
              >
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                  "{testimonial.quote}"
                </p>
                <div>
                  <p className="text-sm font-medium">{testimonial.name}</p>
                  <p className="text-xs text-gray-400">{testimonial.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BYU Callout */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 p-10 sm:p-14 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Built for BYU students,
                <br />by a BYU student
              </h2>
              <p className="text-blue-100 max-w-lg mx-auto mb-8 leading-relaxed">
                Study Aide integrates directly with BYU Canvas, understands your course structure,
                and is designed for the way Marriott MBA students actually study.
              </p>
              <div className="flex flex-wrap justify-center gap-4 mb-8">
                {['Canvas Integration', 'Course-specific AI', 'MBA-optimized', 'Free for BYU'].map(
                  (item) => (
                    <div key={item} className="flex items-center gap-2 text-sm">
                      <CheckCircleIcon className="h-5 w-5 text-blue-200" />
                      <span>{item}</span>
                    </div>
                  )
                )}
              </div>
              <button
                onClick={handleGetStarted}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-blue-700 text-sm font-semibold hover:bg-blue-50 transition-colors shadow-lg"
              >
                Get Started Free
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <AcademicCapIcon className="h-5 w-5 text-gray-400" />
            <span className="text-sm text-gray-400">Study Aide</span>
          </div>
          <p className="text-sm text-gray-400">
            © {new Date().getFullYear()} Study Aide. Made with ☕ in Provo.
          </p>
        </div>
      </footer>
    </div>
  );
}
