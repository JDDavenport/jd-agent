import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileApi } from '@/lib/api';

export function Profile() {
  const queryClient = useQueryClient();
  const { data: profileData, isLoading } = useQuery({
    queryKey: ['job-profile'],
    queryFn: () => profileApi.get(),
  });

  const updateProfile = useMutation({
    mutationFn: (data: any) => profileApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-profile'] });
    },
  });

  const [formData, setFormData] = useState({
    targetTitles: '',
    targetCompanies: '',
    excludeCompanies: '',
    minSalary: '',
    maxSalary: '',
    preferredLocations: '',
    remotePreference: 'remote_only',
    willingToRelocate: false,
    yearsExperience: '',
    skills: '',
    industries: '',
    autoApplyEnabled: false,
    autoApplyThreshold: '85',
    dailyApplicationLimit: '10',
  });

  useEffect(() => {
    if (profileData?.data) {
      const p = profileData.data;
      setFormData({
        targetTitles: p.targetTitles?.join(', ') || '',
        targetCompanies: p.targetCompanies?.join(', ') || '',
        excludeCompanies: p.excludeCompanies?.join(', ') || '',
        minSalary: p.minSalary?.toString() || '',
        maxSalary: p.maxSalary?.toString() || '',
        preferredLocations: p.preferredLocations?.join(', ') || '',
        remotePreference: p.remotePreference || 'remote_only',
        willingToRelocate: p.willingToRelocate || false,
        yearsExperience: p.yearsExperience?.toString() || '',
        skills: p.skills?.join(', ') || '',
        industries: p.industries?.join(', ') || '',
        autoApplyEnabled: p.autoApplyEnabled || false,
        autoApplyThreshold: p.autoApplyThreshold?.toString() || '85',
        dailyApplicationLimit: p.dailyApplicationLimit?.toString() || '10',
      });
    }
  }, [profileData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parseList = (str: string) =>
      str.split(',').map((s) => s.trim()).filter(Boolean);

    updateProfile.mutate({
      targetTitles: parseList(formData.targetTitles),
      targetCompanies: parseList(formData.targetCompanies),
      excludeCompanies: parseList(formData.excludeCompanies),
      minSalary: formData.minSalary ? parseInt(formData.minSalary) : undefined,
      maxSalary: formData.maxSalary ? parseInt(formData.maxSalary) : undefined,
      preferredLocations: parseList(formData.preferredLocations),
      remotePreference: formData.remotePreference,
      willingToRelocate: formData.willingToRelocate,
      yearsExperience: formData.yearsExperience ? parseInt(formData.yearsExperience) : undefined,
      skills: parseList(formData.skills),
      industries: parseList(formData.industries),
      autoApplyEnabled: formData.autoApplyEnabled,
      autoApplyThreshold: parseInt(formData.autoApplyThreshold),
      dailyApplicationLimit: parseInt(formData.dailyApplicationLimit),
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Job Profile"
        subtitle="Configure your job search preferences"
      />

      <main className="flex-1 overflow-y-auto p-6">
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
          {/* Target Preferences */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Target Preferences</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Job Titles
                </label>
                <input
                  type="text"
                  name="targetTitles"
                  value={formData.targetTitles}
                  onChange={handleChange}
                  placeholder="Software Engineer, Product Manager, etc."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated list</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Companies
                </label>
                <input
                  type="text"
                  name="targetCompanies"
                  value={formData.targetCompanies}
                  onChange={handleChange}
                  placeholder="Google, Meta, Stripe, etc."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exclude Companies
                </label>
                <input
                  type="text"
                  name="excludeCompanies"
                  value={formData.excludeCompanies}
                  onChange={handleChange}
                  placeholder="Companies to avoid"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Compensation */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Compensation</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Min Salary ($k)
                </label>
                <input
                  type="number"
                  name="minSalary"
                  value={formData.minSalary}
                  onChange={handleChange}
                  placeholder="100"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Salary ($k)
                </label>
                <input
                  type="number"
                  name="maxSalary"
                  value={formData.maxSalary}
                  onChange={handleChange}
                  placeholder="200"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Location</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remote Preference
                </label>
                <select
                  name="remotePreference"
                  value={formData.remotePreference}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="remote_only">Remote Only</option>
                  <option value="hybrid_ok">Hybrid OK</option>
                  <option value="onsite_ok">On-site OK</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Locations
                </label>
                <input
                  type="text"
                  name="preferredLocations"
                  value={formData.preferredLocations}
                  onChange={handleChange}
                  placeholder="San Francisco, New York, Austin"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="willingToRelocate"
                  checked={formData.willingToRelocate}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Willing to relocate</span>
              </label>
            </div>
          </div>

          {/* Skills & Experience */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Skills & Experience</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Years of Experience
                </label>
                <input
                  type="number"
                  name="yearsExperience"
                  value={formData.yearsExperience}
                  onChange={handleChange}
                  placeholder="5"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Key Skills
                </label>
                <input
                  type="text"
                  name="skills"
                  value={formData.skills}
                  onChange={handleChange}
                  placeholder="React, TypeScript, Node.js, etc."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industries
                </label>
                <input
                  type="text"
                  name="industries"
                  value={formData.industries}
                  onChange={handleChange}
                  placeholder="Tech, Fintech, Healthcare"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Automation */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Automation Settings</h2>

            <div className="space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="autoApplyEnabled"
                  checked={formData.autoApplyEnabled}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enable auto-apply</span>
              </label>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Match Score to Auto-Apply
                  </label>
                  <input
                    type="number"
                    name="autoApplyThreshold"
                    value={formData.autoApplyThreshold}
                    onChange={handleChange}
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Daily Application Limit
                  </label>
                  <input
                    type="number"
                    name="dailyApplicationLimit"
                    value={formData.dailyApplicationLimit}
                    onChange={handleChange}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={updateProfile.isPending}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {updateProfile.isPending ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
