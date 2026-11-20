import type { AiProviderId, AiProviderMeta, AiSettings, LegacyAiSettings } from './types'

const DEFAULT_DEEPSEEK_MODEL = 'deepseek-flash'

// The legacy aliases are retired or routed to the current Flash model.
// Do not silently upgrade former Reasoner users to the higher-priced Pro model.
export function normalizeDeepSeekModel(model: string): string {
  switch (model) {
    case 'deepseek-chat':
    case 'deepseek-reasoner':
    case 'deepseek-v4-flash':
    case 'deepseek-v4-flash-vision-exp':
      return DEFAULT_DEEPSEEK_MODEL
    default:
      return model
  }
}

/**
 * DeepSeek is the single supported provider in this build: the deployment
 * locks the whole team to one vendor, so the lineup, wire routing, and
 * migrations are all single-provider. Every other provider id found in an
 * older settings file migrates into the deepseek slot.
 */
export const AI_PROVIDERS: AiProviderMeta[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    // Keep requests text-only until model-specific image support is wired.
    vision: false,
    models: [DEFAULT_DEEPSEEK_MODEL, 'deepseek-v4-pro'],
    defaultModel: DEFAULT_DEEPSEEK_MODEL,
    keyPlaceholder: 'sk-...',
  },
]

/** Fixed base URL of the DeepSeek OpenAI-compatible endpoint. */
export const PROVIDER_BASE_URLS: Record<'deepseek', string> = {
  deepseek: 'https://api.deepseek.com/v1',
}

/**
 * Whether a request to `provider` with model `model` may carry inline image
 * attachments. This build keeps both DeepSeek choices on its text-only path;
 * the signature can accommodate model-specific image support later.
 */
export function providerSupportsVision(provider: AiProviderId, _model?: string): boolean {
  return AI_PROVIDERS.find((meta) => meta.id === provider)?.vision !== false
}

/**
 * Fresh DeepSeek settings with the default model and an empty key, except a
 * caller-supplied default key. Callers own that policy; this package has no
 * hardcoded keys.
 */
export function defaultAiSettings(defaultApiKey?: string): AiSettings {
  const providers = { deepseek: { apiKey: defaultApiKey ?? '', model: DEFAULT_DEEPSEEK_MODEL } }
  return { provider: 'deepseek', providers }
}

/**
 * Merge on-disk settings over freshly computed defaults, migrating older
 * shapes onto the single-provider lineup: any other provider id (including
 * the former custom/qwen/zhipu/kimi/minimax/siliconflow slots) collapses
 * onto deepseek and its stored keys are dropped. `stored` is whatever the
 * caller read from its settings file (already JSON-parsed); no file I/O.
 */
export function resolveAiSettings(
  stored: Partial<AiSettings> & LegacyAiSettings,
  defaults: AiSettings,
): AiSettings {
  if (!stored.providers) return defaults
  const deepseek = stored.providers.deepseek
  return {
    provider: 'deepseek',
    providers: {
      deepseek: {
        apiKey:
          typeof deepseek?.apiKey === 'string'
            ? deepseek.apiKey
            : defaults.providers.deepseek.apiKey,
        model: normalizeDeepSeekModel(
          typeof deepseek?.model === 'string' && deepseek.model
            ? deepseek.model
            : defaults.providers.deepseek.model,
        ),
      },
    },
  }
}
