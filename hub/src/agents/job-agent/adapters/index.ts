export * from './base-adapter';
export * from './mba-exchange-adapter';
export * from './linkedin-adapter';

import { getMBAExchangeAdapter, MBAExchangeAdapter } from './mba-exchange-adapter';
import { getLinkedInAdapter, LinkedInAdapter } from './linkedin-adapter';
import { BaseJobAdapter, AdapterConfig } from './base-adapter';

export type Platform = 'linkedin' | 'mbaexchange' | 'indeed' | 'greenhouse' | 'lever' | 'manual';

// Adapter factory
export function getAdapter(platform: Platform, config?: AdapterConfig): BaseJobAdapter | null {
  switch (platform.toLowerCase()) {
    case 'linkedin':
      return getLinkedInAdapter(config);
    case 'mbaexchange':
      return getMBAExchangeAdapter(config);
    default:
      console.warn(`[AdapterFactory] Unknown platform: ${platform}`);
      return null;
  }
}

// Get all available adapters
export function getAvailableAdapters(): Platform[] {
  return ['linkedin', 'mbaexchange'];
}
