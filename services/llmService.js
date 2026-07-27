// ─────────────────────────────────────────────────────────────────────────────
// LLM service — provider abstraction for the AI extraction pipeline (Phase 1b).
//
// The provider is chosen at runtime via config.llm.provider (env LLM_PROVIDER):
//   • "claude" → Anthropic Claude via the official @anthropic-ai/sdk
//   • "openai" → OpenAI via the official openai SDK
//
// Both providers expose the SAME contract through extractStructured(): given a
// system prompt, a user prompt and a JSON Schema, return a parsed object that
// conforms to the schema. Structured output is enforced natively on each side
// (Claude: output_config.format; OpenAI: response_format json_schema), so the
// caller never parses free-form text.
//
// SDKs are require()d lazily so this module (and the whole API) still boots when
// a provider's package or key is absent — the error surfaces only on use.
// ─────────────────────────────────────────────────────────────────────────────

const config = require('../config');

let anthropicClient = null;
let openaiClient = null;

function getAnthropicClient() {
  if (anthropicClient) return anthropicClient;
  const { apiKey } = config.llm.anthropic;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY non configurata');
  // eslint-disable-next-line global-require
  const Anthropic = require('@anthropic-ai/sdk');
  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

function getOpenAIClient() {
  if (openaiClient) return openaiClient;
  const { apiKey, baseURL } = config.llm.openai;
  if (!apiKey) throw new Error('OPENAI_API_KEY non configurata');
  // eslint-disable-next-line global-require
  const OpenAI = require('openai');
  openaiClient = new OpenAI({ apiKey, ...(baseURL && { baseURL }) });
  return openaiClient;
}

// ── Claude (Anthropic) ───────────────────────────────────────────────────────

async function extractWithClaude({ system, prompt, schema, maxTokens }) {
  const client = getAnthropicClient();
  const model = config.llm.anthropic.model;

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    ...(system && { system }),
    output_config: { format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: prompt }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude ha rifiutato la richiesta di estrazione');
  }
  // output_config.format guarantees the first text block is valid JSON.
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Claude: nessun contenuto testuale nella risposta');
  return JSON.parse(textBlock.text);
}

// ── OpenAI ───────────────────────────────────────────────────────────────────

async function extractWithOpenAI({ system, prompt, schema, schemaName }) {
  const client = getOpenAIClient();
  const model = config.llm.openai.model;

  const response = await client.chat.completions.create({
    model,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: schemaName, schema, strict: true },
    },
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI: risposta vuota');
  return JSON.parse(content);
}

// ── Unified API ──────────────────────────────────────────────────────────────

module.exports = {
  /** The active provider name ("claude" | "openai"). */
  getProvider() {
    return config.llm.provider;
  },

  /**
   * Extract structured data with the configured provider.
   * @param {object}  opts
   * @param {string} [opts.system]      System prompt / role instructions.
   * @param {string}  opts.prompt       User prompt (the content to extract from).
   * @param {object}  opts.schema       JSON Schema the output must conform to.
   * @param {string} [opts.schemaName]  Schema name (OpenAI requires one).
   * @param {number} [opts.maxTokens]   Output cap (Claude); default 16000.
   * @returns {Promise<object>} Parsed object matching `schema`.
   */
  async extractStructured({ system, prompt, schema, schemaName = 'extraction', maxTokens = 16000 }) {
    if (!prompt) throw new Error('extractStructured: prompt mancante');
    if (!schema) throw new Error('extractStructured: schema mancante');

    switch (config.llm.provider) {
      case 'claude':
        return extractWithClaude({ system, prompt, schema, maxTokens });
      case 'openai':
        return extractWithOpenAI({ system, prompt, schema, schemaName });
      default:
        throw new Error(`LLM_PROVIDER non supportato: "${config.llm.provider}" (usa "claude" o "openai")`);
    }
  },
};
