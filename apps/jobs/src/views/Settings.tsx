import { Header } from '@/components/layout/Header';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';

export function Settings() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Settings"
        subtitle="Configure job hunting agent"
      />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl">
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <Cog6ToothIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Settings Coming Soon</h3>
            <p className="text-gray-500">
              Agent configuration, notification preferences, and integration settings will be available here.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
