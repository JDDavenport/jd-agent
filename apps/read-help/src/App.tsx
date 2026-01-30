import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  BookOpenIcon,
  MagnifyingGlassIcon,
  AcademicCapIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { LibraryView } from './views/LibraryView';
import { BookView } from './views/BookView';
import { ChapterView } from './views/ChapterView';
import { SearchView } from './views/SearchView';
import { FlashcardsView } from './views/FlashcardsView';
import clsx from 'clsx';

const navigation = [
  { name: 'Library', href: '/', icon: BookOpenIcon },
  { name: 'Search', href: '/search', icon: MagnifyingGlassIcon },
  { name: 'Study', href: '/flashcards', icon: AcademicCapIcon },
];

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="h-full bg-gray-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 transform bg-gray-800 transition-transform duration-300 lg:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <span className="text-xl font-bold text-white">Read Help</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-400 hover:text-white"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <nav className="mt-4 px-2">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                  isActive
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-gray-800">
          <div className="flex h-16 items-center px-4">
            <BookOpenIcon className="h-8 w-8 text-indigo-400" />
            <span className="ml-2 text-xl font-bold text-white">Read Help</span>
          </div>
          <nav className="mt-4 flex-1 px-2">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                    isActive
                      ? 'bg-gray-700 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:pl-64">
        {/* Mobile header */}
        <div className="sticky top-0 z-10 flex h-16 items-center gap-4 bg-gray-800 px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <span className="text-lg font-semibold text-white">
            {navigation.find((n) => n.href === location.pathname)?.name || 'Read Help'}
          </span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<LibraryView />} />
            <Route path="/books/:bookId" element={<BookView />} />
            <Route path="/books/:bookId/chapters/:chapterId" element={<ChapterView />} />
            <Route path="/search" element={<SearchView />} />
            <Route path="/flashcards" element={<FlashcardsView />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
