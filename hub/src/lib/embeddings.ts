/**
 * JD Agent - Embedding Utilities
 *
 * Generates and manages embeddings for semantic search:
 * - Voyage AI for high-quality embeddings (preferred)
 * - OpenAI as fallback
 * - Chunking for long documents
 */

import OpenAI from 'openai';
import { VoyageAIClient } from 'voyageai';

// ============================================
// Configuration
// ============================================

// Voyage AI config (preferred for retrieval)
const VOYAGE_MODEL = 'voyage-3'; // Best for retrieval
const VOYAGE_DIMENSIONS = 1024;

// OpenAI fallback config
const OPENAI_MODEL = 'text-embedding-3-small';
const OPENAI_DIMENSIONS = 1536;

const MAX_CHUNK_SIZE = 8000; // Characters per chunk
const CHUNK_OVERLAP = 200; // Overlap between chunks

// ============================================
// Types
// ============================================

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

export interface ChunkWithEmbedding {
  chunkIndex: number;
  content: string;
  embedding: number[];
}

type Provider = 'voyage' | 'openai';

// ============================================
// Embedding Service
// ============================================

class EmbeddingService {
  private openai: OpenAI | null = null;
  private voyage: VoyageAIClient | null = null;
  private provider: Provider | null = null;
  private dimensions: number = OPENAI_DIMENSIONS;

  constructor() {
    // Prefer Voyage AI if configured
    const voyageKey = process.env.VOYAGE_API_KEY;
    if (voyageKey) {
      this.voyage = new VoyageAIClient({ apiKey: voyageKey });
      this.provider = 'voyage';
      this.dimensions = VOYAGE_DIMENSIONS;
      console.log('[Embeddings] Initialized with Voyage AI (voyage-3)');
    } else {
      // Fall back to OpenAI
      const openaiKey = process.env.OPENAI_API_KEY;
      if (openaiKey) {
        this.openai = new OpenAI({ apiKey: openaiKey });
        this.provider = 'openai';
        this.dimensions = OPENAI_DIMENSIONS;
        console.log('[Embeddings] Initialized with OpenAI');
      } else {
        console.log('[Embeddings] Not configured - set VOYAGE_API_KEY or OPENAI_API_KEY');
      }
    }
  }

  /**
   * Check if embeddings are available
   */
  isReady(): boolean {
    return this.provider !== null;
  }

  /**
   * Get the current provider
   */
  getProvider(): Provider | null {
    return this.provider;
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<EmbeddingResult | null> {
    if (this.provider === 'voyage' && this.voyage) {
      return this.embedWithVoyage(text);
    } else if (this.provider === 'openai' && this.openai) {
      return this.embedWithOpenAI(text);
    }
    console.error('[Embeddings] Not configured');
    return null;
  }

  private async embedWithVoyage(text: string): Promise<EmbeddingResult | null> {
    try {
      const response = await this.voyage!.embed({
        input: text.trim(),
        model: VOYAGE_MODEL,
      });

      return {
        embedding: response.data![0].embedding as number[],
        tokens: response.usage?.totalTokens || 0,
      };
    } catch (error) {
      console.error('[Embeddings] Voyage AI failed:', error);
      return null;
    }
  }

  private async embedWithOpenAI(text: string): Promise<EmbeddingResult | null> {
    try {
      const response = await this.openai!.embeddings.create({
        model: OPENAI_MODEL,
        input: text.trim(),
      });

      return {
        embedding: response.data[0].embedding,
        tokens: response.usage.total_tokens,
      };
    } catch (error) {
      console.error('[Embeddings] OpenAI failed:', error);
      return null;
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(texts: string[]): Promise<(EmbeddingResult | null)[]> {
    if (this.provider === 'voyage' && this.voyage) {
      return this.embedBatchWithVoyage(texts);
    } else if (this.provider === 'openai' && this.openai) {
      return this.embedBatchWithOpenAI(texts);
    }
    return texts.map(() => null);
  }

  private async embedBatchWithVoyage(texts: string[]): Promise<(EmbeddingResult | null)[]> {
    try {
      const response = await this.voyage!.embed({
        input: texts.map(t => t.trim()),
        model: VOYAGE_MODEL,
      });

      return response.data!.map(d => ({
        embedding: d.embedding as number[],
        tokens: Math.ceil((response.usage?.totalTokens || 0) / texts.length),
      }));
    } catch (error) {
      console.error('[Embeddings] Voyage AI batch failed:', error);
      return texts.map(() => null);
    }
  }

  private async embedBatchWithOpenAI(texts: string[]): Promise<(EmbeddingResult | null)[]> {
    try {
      const response = await this.openai!.embeddings.create({
        model: OPENAI_MODEL,
        input: texts.map(t => t.trim()),
      });

      return response.data.map(d => ({
        embedding: d.embedding,
        tokens: Math.ceil(response.usage.total_tokens / texts.length),
      }));
    } catch (error) {
      console.error('[Embeddings] OpenAI batch failed:', error);
      return texts.map(() => null);
    }
  }

  /**
   * Chunk text for embedding
   */
  chunkText(text: string): string[] {
    if (text.length <= MAX_CHUNK_SIZE) {
      return [text];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + MAX_CHUNK_SIZE;

      // Try to break at a sentence boundary
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const breakPoint = Math.max(lastPeriod, lastNewline);

        if (breakPoint > start + MAX_CHUNK_SIZE / 2) {
          end = breakPoint + 1;
        }
      }

      chunks.push(text.slice(start, end).trim());
      start = end - CHUNK_OVERLAP;
    }

    return chunks.filter(c => c.length > 0);
  }

  /**
   * Embed a long document with chunking
   */
  async embedDocument(text: string): Promise<ChunkWithEmbedding[]> {
    const chunks = this.chunkText(text);
    const results: ChunkWithEmbedding[] = [];

    const embeddings = await this.embedBatch(chunks);

    for (let i = 0; i < chunks.length; i++) {
      const embedding = embeddings[i];
      if (embedding) {
        results.push({
          chunkIndex: i,
          content: chunks[i],
          embedding: embedding.embedding,
        });
      }
    }

    return results;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get embedding dimensions for current provider
   */
  getDimensions(): number {
    return this.dimensions;
  }
}

// ============================================
// Singleton instance
// ============================================

export const embeddingService = new EmbeddingService();
