/**
 * Groq LLM Provider
 *
 * Free tier: 14,400 requests/day
 * Uses Llama 3.3 70B with function calling support
 */

import Groq from 'groq-sdk';
import type { LLMProvider, LLMMessage, LLMTool, LLMChatOptions, LLMChatResponse } from '../llm-provider';

export class GroqProvider implements LLMProvider {
  name = 'groq';
  private client: Groq | null = null;
  private defaultModel = 'llama-3.3-70b-versatile';

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey) {
      this.client = new Groq({ apiKey });
      console.log('[GroqProvider] Initialized');
    } else {
      console.log('[GroqProvider] No API key configured');
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async chat(
    messages: LLMMessage[],
    tools?: LLMTool[],
    options?: LLMChatOptions
  ): Promise<LLMChatResponse> {
    if (!this.client) {
      throw new Error('Groq client not initialized');
    }

    const model = options?.model || this.defaultModel;

    // Convert messages to Groq format (OpenAI-compatible)
    const groqMessages = messages.map(msg => {
      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          content: msg.content || '',
          tool_call_id: msg.tool_call_id || '',
        };
      }

      if (msg.role === 'assistant' && msg.tool_calls) {
        return {
          role: 'assistant' as const,
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
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content || '',
      };
    });

    // Convert tools to Groq format (OpenAI-compatible)
    const groqTools = tools?.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: groqMessages,
        tools: groqTools,
        tool_choice: options?.toolChoice || 'auto',
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
      });

      const choice = response.choices[0];
      const message = choice.message;

      return {
        content: message.content,
        toolCalls: message.tool_calls?.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
        finishReason: choice.finish_reason || 'stop',
        provider: this.name,
        model,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      // Re-throw with more context
      if (error instanceof Error) {
        // Check for rate limit
        if (error.message.includes('rate_limit') || error.message.includes('429')) {
          throw new Error(`Groq rate limit exceeded: ${error.message}`);
        }
        throw new Error(`Groq error: ${error.message}`);
      }
      throw error;
    }
  }
}
