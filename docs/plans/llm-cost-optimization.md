# LLM Cost Optimization Plan

## Current State Analysis

### LLM Usage in JD Agent

**1. MasterAgent (Primary Chat)**
- **Current Model**: `gpt-4-turbo-preview`
- **Provider**: OpenAI
- **Features Used**:
  - Function/Tool calling (42 tools)
  - Multi-turn conversation
  - Large context window
  - JSON parsing for tool arguments

**2. Vision (calendar_from_image)**
- **Current Model**: `gpt-4o`
- **Provider**: OpenAI
- **Features Used**:
  - Image analysis
  - JSON extraction

### Requirements Summary

| Feature | Priority | Notes |
|---------|----------|-------|
| Function/Tool Calling | **Critical** | Agent cannot work without this |
| Reasoning Quality | High | Needs to understand complex instructions |
| Context Window | High | System prompt + history + context |
| Speed | Medium | User-facing, should feel responsive |
| Vision | Low | Only used for image-to-calendar (optional) |

---

## Free/Cheap Provider Analysis

### 1. Groq (Recommended Primary)

**Pricing**: FREE (14,400 requests/day)

**Models Available**:
- `llama-3.3-70b-versatile` - Best for function calling
- `llama-3.1-8b-instant` - Faster, less capable
- `mixtral-8x7b-32768` - Good middle ground

**Pros**:
- Completely free tier with generous limits
- Extremely fast inference (fastest in industry)
- Native function/tool calling support
- 128K context window on Llama 3.3
- OpenAI-compatible API

**Cons**:
- No vision support
- Rate limits during peak usage
- Occasional model availability issues

### 2. Google Gemini (Recommended Fallback)

**Pricing**: FREE tier available
- `gemini-1.5-flash`: 15 req/min, 1M tokens/min
- `gemini-1.5-pro`: 2 req/min, 32K tokens/min

**Pros**:
- Free tier available
- Native function calling
- Vision support (can replace gpt-4o)
- Very large context window (1M tokens)
- Good reasoning

**Cons**:
- Lower rate limits on free tier
- Different API format (need adapter)
- Slightly slower than Groq

### 3. Together.ai

**Pricing**: $25 free credit, then pay-per-token
- Llama 3.1 70B: ~$0.88/M tokens

**Pros**:
- Many model options
- Function calling on supported models
- OpenAI-compatible API

**Cons**:
- No ongoing free tier
- Credit runs out

### 4. Ollama (Local)

**Pricing**: FREE (runs on your hardware)

**Models**:
- `llama3.1:8b` - Works on most Macs (8GB RAM)
- `llama3.1:70b` - Needs 48GB+ RAM or GPU
- `mistral:7b` - Light and fast

**Pros**:
- Completely free forever
- No rate limits
- Works offline
- Privacy (data stays local)

**Cons**:
- Requires decent hardware for large models
- Slower than cloud (unless you have good GPU)
- Function calling support varies
- Harder to set up

---

## Recommended Solution

### Provider Priority Chain

```
Primary:    Groq (llama-3.3-70b-versatile)  - FREE
     ↓ (on error/rate limit)
Fallback 1: Google Gemini (gemini-1.5-flash) - FREE
     ↓ (on error/rate limit)
Fallback 2: OpenAI (gpt-4-turbo)            - PAID (existing)
```

### Vision Handling

Keep OpenAI `gpt-4o` ONLY for vision tasks (`calendar_from_image`). This is rarely used, so cost impact is minimal.

OR migrate to Gemini for vision (also free).

---

## Implementation Plan

### Phase 1: Add Multi-Provider Support

**File**: `hub/src/lib/llm-provider.ts` (NEW)

Create an abstraction layer that:
1. Defines a common interface for LLM calls
2. Handles provider-specific API differences
3. Implements automatic fallback on errors

```typescript
interface LLMProvider {
  name: string;
  chat(messages, tools, options): Promise<Response>;
  isAvailable(): boolean;
}

class LLMChain {
  providers: LLMProvider[];
  async chat(...): Promise<Response>; // tries each provider
}
```

### Phase 2: Add Groq Provider

**File**: `hub/src/lib/providers/groq.ts` (NEW)

- Use `groq-sdk` npm package
- Implement function calling (OpenAI-compatible format)
- Handle rate limit errors gracefully

**Environment Variable**: `GROQ_API_KEY`

### Phase 3: Add Gemini Provider

**File**: `hub/src/lib/providers/gemini.ts` (NEW)

- Use `@google/generative-ai` npm package
- Convert tool format (OpenAI → Gemini)
- Handle function calling response format

**Environment Variable**: `GOOGLE_AI_API_KEY`

### Phase 4: Update MasterAgent

**File**: `hub/src/agents/master-agent.ts` (MODIFY)

- Replace direct OpenAI calls with LLMChain
- Keep existing tool definitions
- Add provider selection/fallback logic

### Phase 5: Configuration

**File**: `.env` additions:

```env
# LLM Provider Priority (comma-separated)
LLM_PROVIDERS=groq,gemini,openai

# Provider API Keys
GROQ_API_KEY=gsk_...
GOOGLE_AI_API_KEY=AIza...
OPENAI_API_KEY=sk-...  # existing, now optional
```

---

## Cost Comparison

| Scenario | Current (OpenAI) | After (Groq+Gemini) |
|----------|------------------|---------------------|
| 100 chats/day | ~$2-5/day | **FREE** |
| 500 chats/day | ~$10-25/day | **FREE** (within limits) |
| Heavy usage | ~$50+/day | $0 + minimal OpenAI fallback |

**Expected Savings**: 95%+ reduction in LLM costs

---

## Files to Create/Modify

### Create
- `hub/src/lib/llm-provider.ts` - Provider abstraction
- `hub/src/lib/providers/groq.ts` - Groq implementation
- `hub/src/lib/providers/gemini.ts` - Gemini implementation
- `hub/src/lib/providers/openai.ts` - OpenAI wrapper
- `hub/src/lib/providers/index.ts` - Exports

### Modify
- `hub/src/agents/master-agent.ts` - Use new LLM chain
- `hub/package.json` - Add groq-sdk, @google/generative-ai
- `.env.example` - Add new env vars

---

## Rollout Strategy

1. **Add Groq as default** - Immediately reduces costs to $0 for most usage
2. **Add Gemini fallback** - Handles Groq rate limits/outages
3. **Keep OpenAI as last resort** - Ensures service never fails completely
4. **Monitor** - Track which provider handles each request

---

## Optional: Ollama for Offline

If you want local LLM capability:

```bash
# Install Ollama
brew install ollama

# Pull a model
ollama pull llama3.1:8b

# Run (listens on localhost:11434)
ollama serve
```

Add as lowest-priority fallback for when all cloud providers fail.

---

## Next Steps

1. Get Groq API key: https://console.groq.com/keys (FREE)
2. Get Google AI API key: https://aistudio.google.com/apikey (FREE)
3. Implement the provider abstraction
4. Test with Groq as primary
5. Verify fallback chain works
