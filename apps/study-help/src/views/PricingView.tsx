import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Get started with the basics',
    features: [
      { name: 'Up to 2 courses', included: true },
      { name: 'Task management', included: true },
      { name: 'Study timer', included: true },
      { name: '10 flashcards/day', included: true },
      { name: 'Class GPT (AI chat)', included: false },
      { name: 'Unlimited courses', included: false },
      { name: 'Unlimited flashcards', included: false },
      { name: 'Priority support', included: false },
    ],
    cta: 'Current Plan',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$8',
    period: '/month',
    description: 'Everything you need to ace your classes',
    features: [
      { name: 'Unlimited courses', included: true },
      { name: 'Task management', included: true },
      { name: 'Study timer', included: true },
      { name: 'Unlimited flashcards', included: true },
      { name: 'Class GPT (AI chat)', included: true },
      { name: 'AI-powered summaries', included: true },
      { name: 'Quiz generation', included: true },
      { name: 'Priority support', included: true },
    ],
    cta: 'Upgrade to Pro',
    popular: true,
  },
];

export function PricingView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!user) {
      navigate('/sign-up');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/stripe/create-checkout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'pro',
          successUrl: `${window.location.origin}/pricing?success=true`,
          cancelUrl: `${window.location.origin}/pricing`,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Failed to create checkout session:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
          Simple, transparent pricing
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
          Start free, upgrade when you need more. Cancel anytime.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-2xl border p-8 ${
              plan.popular
                ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 ring-2 ring-blue-500/20'
                : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900'
            }`}
          >
            {plan.popular && (
              <span className="inline-block px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-4">
                Most Popular
              </span>
            )}

            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{plan.description}</p>

            <div className="mt-4 mb-6">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
              <span className="text-gray-500 dark:text-gray-400 text-sm">{plan.period}</span>
            </div>

            <ul className="space-y-3 mb-8">
              {plan.features.map((feature) => (
                <li key={feature.name} className="flex items-center gap-3 text-sm">
                  {feature.included ? (
                    <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <XMarkIcon className="h-5 w-5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                  )}
                  <span className={feature.included ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-600'}>
                    {feature.name}
                  </span>
                </li>
              ))}
            </ul>

            {plan.popular ? (
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Redirecting...' : plan.cta}
              </button>
            ) : (
              <button
                disabled
                className="w-full rounded-xl bg-gray-100 dark:bg-gray-800 px-4 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 cursor-default"
              >
                {plan.cta}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
