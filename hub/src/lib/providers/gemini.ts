/**
 * Google Gemini LLM Provider
 *
 * Free tier: 15 req/min on gemini-1.5-flash
 * Supports function calling and vision
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { LLMProvider, LLMMessage, LLMTool, LLMChatOptions, LLMChatResponse, LLMToolCall } from '../llm-provider';

export class GeminiProvider implements LLMProvider {
  name = 'gemini';
  private client: GoogleGenerativeAI | null = null;
  private defaultModel = 'gemini-2.0-flash';

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
      console.log('[GeminiProvider] Initialized');
    } else {
      console.log('[GeminiProvider] No API key configured');
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
      throw new Error('Gemini client not initialized');
    }

    const modelName = options?.model || this.defaultModel;

    // Convert tools to Gemini format
    const geminiTools = tools && tools.length > 0 ? [{
      functionDeclarations: tools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: this.convertJsonSchemaToGemini(tool.function.parameters),
      })),
    }] as any : undefined;

    // Get the model
    const model = this.client.getGenerativeModel({
      model: modelName,
      tools: geminiTools,
    });

    // Convert messages to Gemini format
    const { systemInstruction, history, lastUserMessage } = this.convertMessages(messages);

    // Start chat with history
    // Gemini expects systemInstruction as a Content object with parts
    const chat = model.startChat({
      history,
      ...(systemInstruction ? {
        systemInstruction: {
          role: 'user',
          parts: [{ text: systemInstruction }]
        }
      } : {}),
    });

    try {
      // Send the last user message
      const result = await chat.sendMessage(lastUserMessage);
      const response = result.response;
      const candidate = response.candidates?.[0];

      if (!candidate) {
        throw new Error('No response candidate from Gemini');
      }

      // Extract content and function calls
      let content: string | null = null;
      const toolCalls: LLMToolCall[] = [];

      for (const part of candidate.content.parts) {
        if ('text' in part && part.text) {
          content = (content || '') + part.text;
        }
        if ('functionCall' in part && part.functionCall) {
          toolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'function',
            function: {
              name: part.functionCall.name,
              arguments: JSON.stringify(part.functionCall.args || {}),
            },
          });
        }
      }

      // Determine finish reason
      let finishReason: string = 'stop';
      if (toolCalls.length > 0) {
        finishReason = 'tool_calls';
      } else if (candidate.finishReason) {
        finishReason = candidate.finishReason.toLowerCase();
      }

      return {
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason,
        provider: this.name,
        model: modelName,
        usage: response.usageMetadata ? {
          promptTokens: response.usageMetadata.promptTokenCount || 0,
          completionTokens: response.usageMetadata.candidatesTokenCount || 0,
          totalTokens: response.usageMetadata.totalTokenCount || 0,
        } : undefined,
      };
    } catch (error) {
      if (error instanceof Error) {
        // Check for quota/rate limit errors
        if (error.message.includes('quota') || error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
          throw new Error(`Gemini rate limit exceeded: ${error.message}`);
        }
        throw new Error(`Gemini error: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Convert our message format to Gemini's format
   *
   * Gemini has specific requirements for function calling in history.
   * To avoid compatibility issues, we convert tool calls to text summaries
   * when building conversation history.
   */
  private convertMessages(messages: LLMMessage[]): {
    systemInstruction?: string;
    history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
    lastUserMessage: string;
  } {
    let systemInstruction: string | undefined;
    const history: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    let lastUserMessage = '';

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isLast = i === messages.length - 1;

      if (msg.role === 'system') {
        systemInstruction = msg.content || '';
        continue;
      }

      if (msg.role === 'user') {
        if (isLast) {
          lastUserMessage = msg.content || '';
        } else {
          history.push({
            role: 'user',
            parts: [{ text: msg.content || '' }],
          });
        }
        continue;
      }

      if (msg.role === 'assistant') {
        // For assistant messages with tool calls, create a text summary
        let textContent = msg.content || '';

        if (msg.tool_calls && msg.tool_calls.length > 0) {
          const toolSummary = msg.tool_calls
            .map(tc => `[Called ${tc.function.name}]`)
            .join(' ');
          textContent = textContent ? `${textContent} ${toolSummary}` : toolSummary;
        }

        if (textContent) {
          history.push({
            role: 'model',
            parts: [{ text: textContent }],
          });
        }
        continue;
      }

      if (msg.role === 'tool') {
        // Convert tool response to a text summary for history
        // This ensures Gemini can understand the context without
        // using the problematic functionResponse format
        let resultSummary: string;
        try {
          const data = JSON.parse(msg.content || '{}');
          if (data.success !== undefined) {
            resultSummary = data.success
              ? `[Tool succeeded: ${JSON.stringify(data.data || {}).slice(0, 200)}]`
              : `[Tool failed: ${data.error || 'unknown error'}]`;
          } else {
            resultSummary = `[Tool result: ${JSON.stringify(data).slice(0, 200)}]`;
          }
        } catch {
          resultSummary = `[Tool result: ${(msg.content || '').slice(0, 200)}]`;
        }

        // Add as user message (representing the tool execution context)
        history.push({
          role: 'user',
          parts: [{ text: resultSummary }],
        });
        continue;
      }
    }

    // If no user message at end, use a placeholder
    if (!lastUserMessage && history.length === 0) {
      lastUserMessage = 'Hello';
    }

    return { systemInstruction, history, lastUserMessage };
  }

  /**
   * Convert JSON Schema to Gemini's schema format
   */
  private convertJsonSchemaToGemini(schema: Record<string, unknown>): Record<string, unknown> {
    const type = schema.type as string;

    const result: Record<string, unknown> = {
      type: this.mapSchemaType(type),
    };

    if (schema.description) {
      result.description = schema.description as string;
    }

    if (schema.properties) {
      result.properties = {};
      const props = schema.properties as Record<string, Record<string, unknown>>;
      for (const [key, value] of Object.entries(props)) {
        (result.properties as Record<string, unknown>)[key] = this.convertJsonSchemaToGemini(value);
      }
    }

    if (schema.required) {
      result.required = schema.required as string[];
    }

    if (schema.items) {
      result.items = this.convertJsonSchemaToGemini(schema.items as Record<string, unknown>);
    }

    if (schema.enum) {
      result.enum = schema.enum as string[];
    }

    return result;
  }

  private mapSchemaType(type: string): SchemaType {
    switch (type) {
      case 'string':
        return SchemaType.STRING;
      case 'number':
      case 'integer':
        return SchemaType.NUMBER;
      case 'boolean':
        return SchemaType.BOOLEAN;
      case 'array':
        return SchemaType.ARRAY;
      case 'object':
      default:
        return SchemaType.OBJECT;
    }
  }
}
