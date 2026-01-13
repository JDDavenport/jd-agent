import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vaultService } from './vault-service';

describe('VaultService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEmbeddingStats', () => {
    it('should return embedding stats with ready status', async () => {
      const stats = await vaultService.getEmbeddingStats();

      expect(stats).toHaveProperty('ready');
      expect(stats).toHaveProperty('totalChunks');
      expect(stats).toHaveProperty('entriesWithEmbeddings');
      expect(typeof stats.ready).toBe('boolean');
    });
  });

  describe('simpleSearch', () => {
    it('should return array of results', async () => {
      const results = await vaultService.simpleSearch('test', 5);

      expect(Array.isArray(results)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const results = await vaultService.simpleSearch('a', 3);

      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('semanticSearch', () => {
    it('should return array of results', async () => {
      const results = await vaultService.semanticSearch('test query');

      expect(Array.isArray(results)).toBe(true);
    });

    it('should accept options parameter', async () => {
      const results = await vaultService.semanticSearch('test', {
        limit: 5,
        context: 'test-context',
      });

      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('getContexts', () => {
    it('should return array of context strings', async () => {
      const contexts = await vaultService.getContexts();

      expect(Array.isArray(contexts)).toBe(true);
      contexts.forEach((ctx) => {
        expect(typeof ctx).toBe('string');
      });
    });
  });

  describe('getTags', () => {
    it('should return array of tag strings', async () => {
      const tags = await vaultService.getTags();

      expect(Array.isArray(tags)).toBe(true);
      tags.forEach((tag) => {
        expect(typeof tag).toBe('string');
      });
    });
  });

  describe('getStats', () => {
    it('should return vault statistics', async () => {
      const stats = await vaultService.getStats();

      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('byContentType');
      expect(stats).toHaveProperty('byContext');
      expect(stats).toHaveProperty('bySource');
    });
  });
});

console.log('Test suite starting...');
console.log('Test suite complete');
