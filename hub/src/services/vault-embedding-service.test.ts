import { describe, it, expect, beforeEach, vi } from 'vitest';
import { vaultEmbeddingService } from './vault-embedding-service';

describe('VaultEmbeddingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isReady', () => {
    it('should return boolean indicating if embedding service is configured', () => {
      const result = vaultEmbeddingService.isReady();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getStats', () => {
    it('should return embedding statistics', async () => {
      const stats = await vaultEmbeddingService.getStats();

      expect(stats).toHaveProperty('totalChunks');
      expect(stats).toHaveProperty('entriesWithEmbeddings');
      expect(typeof stats.totalChunks).toBe('number');
      expect(typeof stats.entriesWithEmbeddings).toBe('number');
    });
  });
});

console.log('Test suite starting...');
console.log('Test suite complete');
