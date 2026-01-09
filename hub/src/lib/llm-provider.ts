/**
 * LLM Provider Abstraction Layer
 *
 * Provides a unified interface for multiple LLM providers with automatic
 * fallback when one provider fails (rate limits, errors, etc.)
 */

import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

// ============================================
// Types
// ============================================

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: LLMToolCall[];
  tool_call_id?: string;
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  toolChoice?: 'auto' | 'none' | 'required';
}

export interface LLMChatResponse {
  content: string | null;
  toolCalls?: LLMToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | string;
  provider: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMProvider {
  name: string;
  isAvailable(): boolean;
  chat(
    messages: LLMMessage[],
    tools?: LLMTool[],
    options?: LLMChatOptions
  ): Promise<LLMChatResponse>;
}

// ============================================
// Provider Chain
// ============================================

export class LLMProviderChain {
  private providers: LLMProvider[] = [];
  private lastSuccessfulProvider: string | null = null;

  constructor(providers: LLMProvider[] = []) {
    this.providers = providers.filter(p => p.isAvailable());
    console.log(`[LLMChain] Initialized with ${this.providers.length} providers: ${this.providers.map(p => p.name).join(', ')}`);
  }

  addProvider(provider: LLMProvider): void {
    if (provider.isAvailable()) {
      this.providers.push(provider);
      console.log(`[LLMChain] Added provider: ${provider.name}`);
    }
  }

  getProviders(): string[] {
    return this.providers.map(p => p.name);
  }

  getLastSuccessfulProvider(): string | null {
    return this.lastSuccessfulProvider;
  }

  async chat(
    messages: LLMMessage[],
    tools?: LLMTool[],
    options?: LLMChatOptions
  ): Promise<LLMChatResponse> {
    if (this.providers.length === 0) {
      throw new Error('No LLM providers available. Please configure at least one provider.');
    }

    const errors: Array<{ provider: string; error: string }> = [];

    for (const provider of this.providers) {
      try {
        console.log(`[LLMChain] Trying provider: ${provider.name}`);
        const response = await provider.chat(messages, tools, options);
        this.lastSuccessfulProvider = provider.name;
        console.log(`[LLMChain] Success with ${provider.name}`);
        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`[LLMChain] ${provider.name} failed: ${errorMessage}`);
        errors.push({ provider: provider.name, error: errorMessage });

        // Check if this is a non-retryable error
        if (this.isNonRetryableError(error)) {
          console.log(`[LLMChain] Non-retryable error, not trying other providers`);
          throw error;
        }

        // Continue to next provider
      }
    }

    // All providers failed
    throw new Error(
      `All LLM providers failed:\n${errors.map(e => `- ${e.provider}: ${e.error}`).join('\n')}`
    );
  }

  private isNonRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Don't retry on auth errors or invalid requests
      return message.includes('invalid api key') ||
             message.includes('authentication') ||
             message.includes('invalid_api_key') ||
             message.includes('unauthorized');
    }
    return false;
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * Convert OpenAI message format to our LLMMessage format
 */
export function fromOpenAIMessages(messages: ChatCompletionMessageParam[]): LLMMessage[] {
  return messages.map(msg => {
    const base: LLMMessage = {
      role: msg.role as LLMMessage['role'],
      content: typeof msg.content === 'string' ? msg.content : null,
    };

    if ('tool_calls' in msg && msg.tool_calls) {
      base.tool_calls = msg.tool_calls.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: (tc as any).function.name,
          arguments: (tc as any).function.arguments,
        },
      }));
    }

    if ('tool_call_id' in msg && msg.tool_call_id) {
      base.tool_call_id = msg.tool_call_id;
    }

    return base;
  });
}

/**
 * Convert OpenAI tool format to our LLMTool format
 */
export function fromOpenAITools(tools: ChatCompletionTool[]): LLMTool[] {
  return tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: (tool as any).function.name,
      description: (tool as any).function.description || '',
      parameters: (tool as any).function.parameters as Record<string, unknown>,
    },
  }));
}

/**
 * Convert our LLMMessage format to OpenAI format
 */
export function toOpenAIMessages(messages: LLMMessage[]): ChatCompletionMessageParam[] {
  return messages.map(msg => {
    if (msg.role === 'tool') {
      return {
        role: 'tool',
        content: msg.content || '',
        tool_call_id: msg.tool_call_id || '',
      };
    }

    if (msg.role === 'assistant' && msg.tool_calls) {
      return {
        role: 'assistant',
        content: msg.content,
        tool_calls: msg.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      };
    }

    return {
      role: msg.role,
      content: msg.content || '',
    } as ChatCompletionMessageParam;
  });
}
