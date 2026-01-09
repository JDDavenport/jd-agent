/**
 * Ollama Local LLM Provider
 *
 * Free, runs locally, no rate limits
 * Requires: brew install ollama && ollama pull llama3.1:8b
 */

import type { LLMProvider, LLMMessage, LLMTool, LLMChatOptions, LLMChatResponse } from '../llm-provider';

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export class OllamaProvider implements LLMProvider {
  name = 'ollama';
  private baseUrl: string;
  private defaultModel = 'llama3.1:8b';
  private available: boolean | null = null;

  constructor() {
    this.baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    console.log(`[OllamaProvider] Configured with base URL: ${this.baseUrl}`);

    // Check availability on startup (async, non-blocking)
    this.checkAvailability();
  }

  private async checkAvailability(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      this.available = response.ok;
      if (this.available) {
        console.log('[OllamaProvider] Ollama is running and available');
      }
    } catch {
      this.available = false;
      console.log('[OllamaProvider] Ollama not available (start with: ollama serve)');
    }
  }

  isAvailable(): boolean {
    // Return true to allow the provider to be tried
    // Actual availability is checked during chat()
    // This ensures Ollama is always in the fallback chain
    return true;
  }

  async chat(
    messages: LLMMessage[],
    tools?: LLMTool[],
    options?: LLMChatOptions
  ): Promise<LLMChatResponse> {
    const model = options?.model || this.defaultModel;

    // Convert messages to Ollama format
    const ollamaMessages: OllamaMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system' || msg.role === 'user' || msg.role === 'assistant') {
        if (msg.content) {
          ollamaMessages.push({
            role: msg.role,
            content: msg.content,
          });
        }

        // For assistant messages with tool calls, add a summary
        if (msg.role === 'assistant' && msg.tool_calls) {
          const toolSummary = msg.tool_calls
            .map(tc => `[Called ${tc.function.name}]`)
            .join(' ');
          if (toolSummary && !msg.content) {
            ollamaMessages.push({
              role: 'assistant',
              content: toolSummary,
            });
          }
        }
      } else if (msg.role === 'tool') {
        // Convert tool response to user message for context
        let summary: string;
        try {
          const data = JSON.parse(msg.content || '{}');
          summary = data.success
            ? `[Tool result: ${JSON.stringify(data.data || {}).slice(0, 300)}]`
            : `[Tool error: ${data.error}]`;
        } catch {
          summary = `[Tool result: ${(msg.content || '').slice(0, 300)}]`;
        }
        ollamaMessages.push({
          role: 'user',
          content: summary,
        });
      }
    }

    // Convert tools to Ollama format (if supported by model)
    const ollamaTools: OllamaTool[] | undefined = tools?.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: ollamaMessages,
          tools: ollamaTools,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.7,
            num_predict: options?.maxTokens ?? 4096,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        message: {
          content?: string;
          tool_calls?: Array<{
            function: { name: string; arguments?: object };
          }>;
        };
        prompt_eval_count?: number;
        eval_count?: number;
      };
      const message = data.message;

      // Check for tool calls in the response
      const toolCalls = message.tool_calls?.map((tc, index: number) => ({
        id: `ollama_call_${Date.now()}_${index}`,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: JSON.stringify(tc.function.arguments || {}),
        },
      }));

      return {
        content: message.content || null,
        toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: toolCalls && toolCalls.length > 0 ? 'tool_calls' : 'stop',
        provider: this.name,
        model,
        usage: data.prompt_eval_count && data.eval_count ? {
          promptTokens: data.prompt_eval_count,
          completionTokens: data.eval_count,
          totalTokens: data.prompt_eval_count + data.eval_count,
        } : undefined,
      };
    } catch (error) {
      if (error instanceof Error) {
        // Check if Ollama is not running
        if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
          this.available = false;
          throw new Error('Ollama not running. Start with: ollama serve');
        }
        throw new Error(`Ollama error: ${error.message}`);
      }
      throw error;
    }
  }
}
