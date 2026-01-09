/**
 * OpenAI LLM Provider
 *
 * Paid provider - used as fallback when free providers fail
 */

import OpenAI from 'openai';
import type { LLMProvider, LLMMessage, LLMTool, LLMChatOptions, LLMChatResponse } from '../llm-provider';

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: OpenAI | null = null;
  private defaultModel = 'gpt-4-turbo-preview';

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
      console.log('[OpenAIProvider] Initialized');
    } else {
      console.log('[OpenAIProvider] No API key configured');
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  getClient(): OpenAI | null {
    return this.client;
  }

  async chat(
    messages: LLMMessage[],
    tools?: LLMTool[],
    options?: LLMChatOptions
  ): Promise<LLMChatResponse> {
    if (!this.client) {
      throw new Error('OpenAI client not initialized');
    }

    const model = options?.model || this.defaultModel;

    // Convert messages to OpenAI format
    const openaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages.map(msg => {
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

    // Convert tools to OpenAI format
    const openaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] | undefined = tools?.map(tool => ({
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
        messages: openaiMessages,
        tools: openaiTools,
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
            name: (tc as any).function.name,
            arguments: (tc as any).function.arguments,
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
      if (error instanceof Error) {
        // Check for quota exceeded
        if (error.message.includes('quota') || error.message.includes('429') || error.message.includes('insufficient_quota')) {
          throw new Error(`OpenAI quota exceeded: ${error.message}`);
        }
        throw new Error(`OpenAI error: ${error.message}`);
      }
      throw error;
    }
  }
}
