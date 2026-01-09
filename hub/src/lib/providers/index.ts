/**
 * LLM Providers Index
 *
 * Exports all available providers and a factory function to create
 * the provider chain based on configuration.
 */

import { LLMProviderChain, type LLMProvider } from '../llm-provider';
import { GroqProvider } from './groq';
import { GeminiProvider } from './gemini';
import { OpenAIProvider } from './openai';

export { GroqProvider } from './groq';
export { GeminiProvider } from './gemini';
export { OpenAIProvider } from './openai';
export { LLMProviderChain } from '../llm-provider';

/**
 * Create an LLM provider chain based on environment configuration
 *
 * Priority order (configurable via LLM_PROVIDERS env var):
 * 1. Groq (free)
 * 2. Gemini (free)
 * 3. OpenAI (paid fallback)
 */
export function createLLMProviderChain(): LLMProviderChain {
  const providerOrder = (process.env.LLM_PROVIDERS || 'groq,gemini,openai')
    .split(',')
    .map(p => p.trim().toLowerCase());

  const providers: LLMProvider[] = [];

  for (const name of providerOrder) {
    switch (name) {
      case 'groq':
        providers.push(new GroqProvider());
        break;
      case 'gemini':
        providers.push(new GeminiProvider());
        break;
      case 'openai':
        providers.push(new OpenAIProvider());
        break;
      default:
        console.warn(`[LLMProviders] Unknown provider: ${name}`);
    }
  }

  return new LLMProviderChain(providers);
}

// Singleton instance
let chainInstance: LLMProviderChain | null = null;

/**
 * Get the singleton LLM provider chain
 */
export function getLLMProviderChain(): LLMProviderChain {
  if (!chainInstance) {
    chainInstance = createLLMProviderChain();
  }
  return chainInstance;
}

/**
 * Get a specific provider instance (useful for provider-specific features like vision)
 */
export function getProvider(name: 'groq' | 'gemini' | 'openai'): LLMProvider | null {
  switch (name) {
    case 'groq': {
      const provider = new GroqProvider();
      return provider.isAvailable() ? provider : null;
    }
    case 'gemini': {
      const provider = new GeminiProvider();
      return provider.isAvailable() ? provider : null;
    }
    case 'openai': {
      const provider = new OpenAIProvider();
      return provider.isAvailable() ? provider : null;
    }
    default:
      return null;
  }
}
