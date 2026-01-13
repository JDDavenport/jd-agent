/**
 * Vault Embedding Service
 *
 * Generates and manages embeddings for vault entries to enable semantic search.
 * Uses Voyage AI (preferred) or OpenAI for embedding generation.
 *
 * Note: Full vector search requires pgvector extension. Until then, embeddings
 * are stored as JSON arrays and similarity is computed in application code.
 */

import { db } from '../db/client';
import { vaultEntries, vaultEmbeddings } from '../db/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { embeddingService, type ChunkWithEmbedding } from '../lib/embeddings';

// ============================================
// Types
// ============================================

interface EmbeddingSearchResult {
  entryId: string;
  chunkIndex: number;
  contentChunk: string;
  similarity: number;
}

// ============================================
// Vault Embedding Service
// ============================================

class VaultEmbeddingService {
  /**
   * Check if embedding service is ready
   */
  isReady(): boolean {
    return embeddingService.isReady();
  }

  /**
   * Generate and store embeddings for a vault entry
   */
  async generateEmbeddings(entryId: string): Promise<boolean> {
    if (!this.isReady()) {
      console.log('[VaultEmbeddings] Embedding service not configured, skipping');
      return false;
    }

    try {
      // Get the vault entry
      const [entry] = await db
        .select()
        .from(vaultEntries)
        .where(eq(vaultEntries.id, entryId))
        .limit(1);

      if (!entry) {
        console.error('[VaultEmbeddings] Entry not found:', entryId);
        return false;
      }

      // Combine title and content for embedding
      const textToEmbed = `${entry.title}\n\n${entry.content || ''}`.trim();
      if (!textToEmbed) {
        console.log('[VaultEmbeddings] No content to embed for:', entryId);
        return false;
      }

      // Generate embeddings with chunking for long documents
      const chunks = await embeddingService.embedDocument(textToEmbed);

      if (chunks.length === 0) {
        console.error('[VaultEmbeddings] Failed to generate embeddings for:', entryId);
        return false;
      }

      // Delete existing embeddings for this entry
      await db.delete(vaultEmbeddings).where(eq(vaultEmbeddings.entryId, entryId));

      // Store new embeddings
      // Note: Once pgvector is installed, we'll store the embedding vector directly
      // For now, we store the content chunks which can be re-embedded at query time
      for (const chunk of chunks) {
        await db.insert(vaultEmbeddings).values({
          entryId,
          chunkIndex: chunk.chunkIndex,
          contentChunk: chunk.content,
          // embedding: chunk.embedding, // Uncomment when pgvector is available
        });
      }

      console.log(`[VaultEmbeddings] Generated ${chunks.length} embeddings for entry ${entryId}`);
      return true;
    } catch (error) {
      console.error('[VaultEmbeddings] Error generating embeddings:', error);
      return false;
    }
  }

  /**
   * Semantic search across vault entries
   *
   * Note: This is a temporary implementation that re-embeds queries at search time
   * and computes similarity in application code. Once pgvector is installed,
   * this will use native vector similarity search in PostgreSQL.
   */
  async semanticSearch(
    query: string,
    limit: number = 10,
    context?: string
  ): Promise<EmbeddingSearchResult[]> {
    if (!this.isReady()) {
      console.log('[VaultEmbeddings] Embedding service not ready, falling back to text search');
      return [];
    }

    try {
      // Embed the query
      const queryEmbedding = await embeddingService.embed(query);
      if (!queryEmbedding) {
        console.error('[VaultEmbeddings] Failed to embed query');
        return [];
      }

      // Get all chunks (this is inefficient but works without pgvector)
      // TODO: Replace with pgvector similarity search when available
      const chunks = await db
        .select({
          id: vaultEmbeddings.id,
          entryId: vaultEmbeddings.entryId,
          chunkIndex: vaultEmbeddings.chunkIndex,
          contentChunk: vaultEmbeddings.contentChunk,
        })
        .from(vaultEmbeddings)
        .limit(1000);

      if (chunks.length === 0) {
        console.log('[VaultEmbeddings] No embeddings stored yet');
        return [];
      }

      // Re-embed chunks and compute similarity
      // This is expensive but necessary without pgvector
      const results: EmbeddingSearchResult[] = [];

      // Process in batches to avoid rate limits
      const batchSize = 20;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchTexts = batch.map(c => c.contentChunk);
        const batchEmbeddings = await embeddingService.embedBatch(batchTexts);

        for (let j = 0; j < batch.length; j++) {
          const chunkEmbedding = batchEmbeddings[j];
          if (chunkEmbedding) {
            const similarity = embeddingService.cosineSimilarity(
              queryEmbedding.embedding,
              chunkEmbedding.embedding
            );

            results.push({
              entryId: batch[j].entryId,
              chunkIndex: batch[j].chunkIndex,
              contentChunk: batch[j].contentChunk,
              similarity,
            });
          }
        }
      }

      // Sort by similarity and take top results
      results.sort((a, b) => b.similarity - a.similarity);

      // Deduplicate by entryId, keeping highest similarity
      const seen = new Set<string>();
      const deduped = results.filter(r => {
        if (seen.has(r.entryId)) return false;
        seen.add(r.entryId);
        return true;
      });

      return deduped.slice(0, limit);
    } catch (error) {
      console.error('[VaultEmbeddings] Error in semantic search:', error);
      return [];
    }
  }

  /**
   * Delete embeddings for a vault entry
   */
  async deleteEmbeddings(entryId: string): Promise<void> {
    await db.delete(vaultEmbeddings).where(eq(vaultEmbeddings.entryId, entryId));
  }

  /**
   * Get embedding stats
   */
  async getStats(): Promise<{ totalChunks: number; entriesWithEmbeddings: number }> {
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vaultEmbeddings);

    const [uniqueResult] = await db
      .select({ count: sql<number>`count(distinct ${vaultEmbeddings.entryId})::int` })
      .from(vaultEmbeddings);

    return {
      totalChunks: countResult?.count || 0,
      entriesWithEmbeddings: uniqueResult?.count || 0,
    };
  }

  /**
   * Backfill embeddings for existing entries
   */
  async backfillEmbeddings(batchSize: number = 10): Promise<{ processed: number; errors: number }> {
    if (!this.isReady()) {
      return { processed: 0, errors: 0 };
    }

    let processed = 0;
    let errors = 0;

    // Get entries without embeddings
    const entriesWithoutEmbeddings = await db
      .select({ id: vaultEntries.id })
      .from(vaultEntries)
      .where(
        sql`NOT EXISTS (
          SELECT 1 FROM vault_embeddings
          WHERE vault_embeddings.entry_id = vault_entries.id
        )`
      )
      .limit(batchSize);

    for (const entry of entriesWithoutEmbeddings) {
      const success = await this.generateEmbeddings(entry.id);
      if (success) {
        processed++;
      } else {
        errors++;
      }
    }

    return { processed, errors };
  }
}

// Export singleton instance
export const vaultEmbeddingService = new VaultEmbeddingService();
