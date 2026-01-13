/**
 * Vision Provider - Multi-provider LLM abstraction for testing agent
 *
 * Supports:
 * - OpenAI GPT-4o (OPENAI_API_KEY)
 * - Anthropic Claude (ANTHROPIC_API_KEY)
 * - Google Gemini (GOOGLE_AI_API_KEY)
 * - Ollama local models (OLLAMA_HOST)
 *
 * Automatically selects available provider or falls back to alternatives.
 */

import type { ALL_TESTING_TOOLS } from './testing-tools';

// ============================================
// Types
// ============================================

export type ProviderName = 'openai' | 'anthropic' | 'google' | 'ollama';

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface VisionMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface VisionResponse {
  content: string | null;
  toolCalls: ToolCall[];
}

export interface ImageAnalysisResult {
  success: boolean;
  analysis?: string;
  error?: string;
}

export interface ImageContent {
  base64: string;
  mimeType?: string;
}

export interface VisionProviderConfig {
  preferredProvider?: ProviderName;
  fallbackOrder?: ProviderName[];
  ollamaHost?: string;
  ollamaModel?: string;        // Vision model for image analysis (default: llava:7b)
  ollamaChatModel?: string;    // Chat model for tool calling (default: llama3.1:8b)
}

type TestingTool = typeof ALL_TESTING_TOOLS[number];

// ============================================
// Provider Implementations
// ============================================

abstract class BaseProvider {
  abstract name: ProviderName;
  abstract isAvailable(): boolean;
  abstract chat(
    systemPrompt: string,
    messages: VisionMessage[],
    tools: TestingTool[]
  ): Promise<VisionResponse>;
  abstract analyzeImage(
    images: ImageContent[],
    prompt: string
  ): Promise<ImageAnalysisResult>;
}

// OpenAI Provider
class OpenAIProvider extends BaseProvider {
  name: ProviderName = 'openai';
  private client: any;

  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  async chat(
    systemPrompt: string,
    messages: VisionMessage[],
    tools: TestingTool[]
  ): Promise<VisionResponse> {
    if (!this.client) {
      const OpenAI = (await import('openai')).default;
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    const openaiMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map((m) => this.toOpenAIMessage(m)),
    ];

    const openaiTools = tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }));

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2048,
      messages: openaiMessages,
      tools: openaiTools,
      tool_choice: 'auto',
    });

    const message = response.choices[0]?.message;
    return {
      content: message?.content || null,
      toolCalls: (message?.tool_calls || []).map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })),
    };
  }

  private toOpenAIMessage(m: VisionMessage): any {
    if (m.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: m.toolCallId,
        content: m.content || '',
      };
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return { role: m.role, content: m.content || '' };
  }

  async analyzeImage(
    images: ImageContent[],
    prompt: string
  ): Promise<ImageAnalysisResult> {
    if (!this.client) {
      const OpenAI = (await import('openai')).default;
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    try {
      const content: any[] = images.map((img) => ({
        type: 'image_url',
        image_url: {
          url: `data:${img.mimeType || 'image/jpeg'};base64,${img.base64}`,
          detail: 'low',
        },
      }));
      content.push({ type: 'text', text: prompt });

      const response = await this.client.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 2048,
        messages: [{ role: 'user', content }],
      });

      return {
        success: true,
        analysis: response.choices[0]?.message?.content || '',
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }
}

// Anthropic Claude Provider
class AnthropicProvider extends BaseProvider {
  name: ProviderName = 'anthropic';
  private client: any;

  isAvailable(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async chat(
    systemPrompt: string,
    messages: VisionMessage[],
    tools: TestingTool[]
  ): Promise<VisionResponse> {
    if (!this.client) {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }

    // Convert messages to Anthropic format
    const anthropicMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => this.toAnthropicMessage(m));

    const anthropicTools = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: anthropicTools,
    });

    // Extract content and tool calls
    let content: string | null = null;
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        content = block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input),
        });
      }
    }

    return { content, toolCalls };
  }

  private toAnthropicMessage(m: VisionMessage): any {
    if (m.role === 'tool') {
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: m.toolCallId,
            content: m.content || '',
          },
        ],
      };
    }
    if (m.role === 'assistant' && m.toolCalls?.length) {
      return {
        role: 'assistant',
        content: m.toolCalls.map((tc) => ({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: JSON.parse(tc.arguments || '{}'),
        })),
      };
    }
    return { role: m.role, content: m.content || '' };
  }

  async analyzeImage(
    images: ImageContent[],
    prompt: string
  ): Promise<ImageAnalysisResult> {
    if (!this.client) {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }

    try {
      const content: any[] = images.map((img) => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mimeType || 'image/jpeg',
          data: img.base64,
        },
      }));
      content.push({ type: 'text', text: prompt });

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content }],
      });

      const textBlock = response.content.find((b: any) => b.type === 'text');
      return {
        success: true,
        analysis: textBlock?.text || '',
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }
}

// Google Gemini Provider
class GoogleProvider extends BaseProvider {
  name: ProviderName = 'google';
  private client: any;

  isAvailable(): boolean {
    return !!process.env.GOOGLE_AI_API_KEY;
  }

  async chat(
    systemPrompt: string,
    messages: VisionMessage[],
    tools: TestingTool[]
  ): Promise<VisionResponse> {
    if (!this.client) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      this.client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    }

    const model = this.client.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
    });

    // Convert tools to Gemini format
    const geminiTools = [{
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      })),
    }];

    // Build conversation history
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content || '' }],
      }));

    const chat = model.startChat({ history, tools: geminiTools });

    // Get last user message
    const lastUserMsg = messages.filter((m) => m.role === 'user').pop();
    const response = await chat.sendMessage(lastUserMsg?.content || 'continue');

    const result = response.response;
    const text = result.text();
    const functionCalls = result.functionCalls() || [];

    return {
      content: text || null,
      toolCalls: functionCalls.map((fc: any, i: number) => ({
        id: `gemini-${Date.now()}-${i}`,
        name: fc.name,
        arguments: JSON.stringify(fc.args),
      })),
    };
  }

  async analyzeImage(
    images: ImageContent[],
    prompt: string
  ): Promise<ImageAnalysisResult> {
    if (!this.client) {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      this.client = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
    }

    try {
      const model = this.client.getGenerativeModel({ model: 'gemini-2.0-flash' });

      const parts: any[] = images.map((img) => ({
        inlineData: {
          mimeType: img.mimeType || 'image/jpeg',
          data: img.base64,
        },
      }));
      parts.push({ text: prompt });

      const result = await model.generateContent(parts);
      const response = result.response;

      return {
        success: true,
        analysis: response.text() || '',
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }
}

// Ollama Local Provider
class OllamaProvider extends BaseProvider {
  name: ProviderName = 'ollama';
  private host: string;
  private visionModel: string;  // For image analysis (llava)
  private chatModel: string;    // For tool calling (llama3.1)

  constructor(host?: string, visionModel?: string, chatModel?: string) {
    super();
    this.host = host || process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.visionModel = visionModel || process.env.OLLAMA_MODEL || 'llava:7b';
    this.chatModel = chatModel || process.env.OLLAMA_CHAT_MODEL || 'llama3.1:8b';
    console.log(`[OllamaProvider] Vision model: ${this.visionModel}, Chat model: ${this.chatModel}`);
  }

  isAvailable(): boolean {
    // Check if Ollama is configured
    return !!process.env.OLLAMA_HOST || !!process.env.OLLAMA_MODEL || !!process.env.OLLAMA_CHAT_MODEL;
  }

  async chat(
    systemPrompt: string,
    messages: VisionMessage[],
    tools: TestingTool[]
  ): Promise<VisionResponse> {
    // Ollama doesn't have native tool support, so we use a prompt-based approach
    const toolDescriptions = tools.map((t) =>
      `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.input_schema)}`
    ).join('\n');

    const augmentedSystem = `${systemPrompt}

You have access to the following tools. To use a tool, respond with a JSON block like this:
\`\`\`json
{"tool": "tool_name", "arguments": {...}}
\`\`\`

Available tools:
${toolDescriptions}`;

    const ollamaMessages = [
      { role: 'system', content: augmentedSystem },
      ...messages
        .filter((m) => m.role !== 'tool')
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content || '',
        })),
    ];

    const response = await fetch(`${this.host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.chatModel,  // Use chat model for tool calling
        messages: ollamaMessages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.message?.content || '';

    // Parse tool calls from response
    const toolCalls: ToolCall[] = [];
    const toolMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/);
    if (toolMatch) {
      try {
        const parsed = JSON.parse(toolMatch[1]);
        if (parsed.tool) {
          toolCalls.push({
            id: `ollama-${Date.now()}`,
            name: parsed.tool,
            arguments: JSON.stringify(parsed.arguments || {}),
          });
        }
      } catch {
        // Not valid JSON, ignore
      }
    }

    return {
      content: toolCalls.length > 0 ? null : content,
      toolCalls,
    };
  }

  async analyzeImage(
    images: ImageContent[],
    prompt: string
  ): Promise<ImageAnalysisResult> {
    // Ollama supports vision with llava or similar models
    try {
      // Only use first image for Ollama (simpler API)
      const image = images[0];
      if (!image) {
        return { success: false, error: 'No image provided' };
      }

      const response = await fetch(`${this.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.visionModel,  // Use vision model for image analysis
          prompt,
          images: [image.base64],
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        analysis: data.response || '',
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }
}

// ============================================
// Vision Provider Factory
// ============================================

export class VisionProvider {
  private providers: BaseProvider[] = [];
  private activeProvider: BaseProvider | null = null;
  private config: VisionProviderConfig;

  constructor(config: VisionProviderConfig = {}) {
    this.config = config;

    // Default fallback order
    const fallbackOrder = config.fallbackOrder || ['openai', 'anthropic', 'google', 'ollama'];

    // Initialize providers based on fallback order
    for (const name of fallbackOrder) {
      const provider = this.createProvider(name, config);
      if (provider) {
        this.providers.push(provider);
      }
    }

    // Select active provider
    this.selectProvider(config.preferredProvider);
  }

  private createProvider(name: ProviderName, config: VisionProviderConfig): BaseProvider | null {
    switch (name) {
      case 'openai':
        return new OpenAIProvider();
      case 'anthropic':
        return new AnthropicProvider();
      case 'google':
        return new GoogleProvider();
      case 'ollama':
        return new OllamaProvider(config.ollamaHost, config.ollamaModel, config.ollamaChatModel);
      default:
        return null;
    }
  }

  private selectProvider(preferred?: ProviderName): void {
    // Try preferred provider first
    if (preferred) {
      const provider = this.providers.find((p) => p.name === preferred && p.isAvailable());
      if (provider) {
        this.activeProvider = provider;
        console.log(`[VisionProvider] Using preferred provider: ${provider.name}`);
        return;
      }
    }

    // Fall back to first available
    for (const provider of this.providers) {
      if (provider.isAvailable()) {
        this.activeProvider = provider;
        console.log(`[VisionProvider] Using provider: ${provider.name}`);
        return;
      }
    }

    // No provider available
    this.activeProvider = null;
  }

  isAvailable(): boolean {
    return this.activeProvider !== null;
  }

  getProviderName(): ProviderName | null {
    return this.activeProvider?.name || null;
  }

  getAvailableProviders(): ProviderName[] {
    return this.providers.filter((p) => p.isAvailable()).map((p) => p.name);
  }

  async chat(
    systemPrompt: string,
    messages: VisionMessage[],
    tools: TestingTool[]
  ): Promise<VisionResponse> {
    if (!this.activeProvider) {
      throw new Error(
        'No vision provider available. Set one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, or OLLAMA_HOST'
      );
    }

    try {
      return await this.activeProvider.chat(systemPrompt, messages, tools);
    } catch (error) {
      // Try fallback providers
      const currentIndex = this.providers.indexOf(this.activeProvider);
      for (let i = currentIndex + 1; i < this.providers.length; i++) {
        const fallback = this.providers[i];
        if (fallback.isAvailable()) {
          console.log(`[VisionProvider] Falling back to: ${fallback.name}`);
          this.activeProvider = fallback;
          return await fallback.chat(systemPrompt, messages, tools);
        }
      }
      throw error;
    }
  }

  async analyzeImage(
    images: ImageContent[],
    prompt: string
  ): Promise<ImageAnalysisResult> {
    if (!this.activeProvider) {
      throw new Error(
        'No vision provider available. Set one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, or OLLAMA_HOST'
      );
    }

    try {
      return await this.activeProvider.analyzeImage(images, prompt);
    } catch (error) {
      // Try fallback providers
      const currentIndex = this.providers.indexOf(this.activeProvider);
      for (let i = currentIndex + 1; i < this.providers.length; i++) {
        const fallback = this.providers[i];
        if (fallback.isAvailable()) {
          console.log(`[VisionProvider] Image analysis falling back to: ${fallback.name}`);
          this.activeProvider = fallback;
          return await fallback.analyzeImage(images, prompt);
        }
      }
      throw error;
    }
  }
}

// ============================================
// Exports
// ============================================

export function createVisionProvider(config?: VisionProviderConfig): VisionProvider {
  return new VisionProvider(config);
}
