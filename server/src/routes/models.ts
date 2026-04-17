import Router from '@koa/router'
import { readFile, writeFile } from 'fs/promises'
import { resolve } from 'path'
import { homedir } from 'os'
import YAML from 'js-yaml'

const configPath = resolve(homedir(), '.hermes/config.yaml')
const authPath = resolve(homedir(), '.hermes/auth.json')

export const modelRoutes = new Router()

interface AvailableModelGroup {
  provider: string
  label: string
  base_url: string
  models: string[]
}

// Known models per provider (fallback when API doesn't list them)
const KNOWN_MODELS: Record<string, string[]> = {
  nous: [
    'xiaomi/mimo-v2-pro',
    'deepseek-ai/DeepSeek-R1',
    'deepseek-ai/DeepSeek-V3',
    'Qwen/Qwen3-235B-A22B',
    'Qwen/Qwen3-30B-A3B',
    'google/gemma-3-27b-it',
    'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
    'meta-llama/Llama-4-Scout-17B-16E-Instruct',
    'anthropic/claude-sonnet-4',
    'anthropic/claude-opus-4.6',
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'openai/o3-mini',
  ],
  openrouter: [
    'anthropic/claude-sonnet-4',
    'anthropic/claude-opus-4.6',
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'openai/o3-mini',
    'google/gemini-2.5-pro',
    'google/gemini-2.5-flash',
    'deepseek/deepseek-r1',
    'deepseek/deepseek-v3',
    'meta-llama/llama-4-maverick',
    'qwen/qwen-2.5-72b-instruct',
  ],
  'openai-codex': [
    'gpt-5.3-codex',
    'gpt-5.4-codex',
  ],
  anthropic: [
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250701',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
  ],
}

const PROVIDER_ALIAS: Record<string, string> = {
  openai: 'openai-codex',
}

function normalizeProvider(provider?: string): string {
  if (!provider) return ''
  return PROVIDER_ALIAS[provider] || provider
}

function normalizeModelForProvider(provider: string, model: string): string {
  if (provider !== 'openai-codex') return model
  const known = KNOWN_MODELS['openai-codex'] || []
  return known.includes(model) ? model : 'gpt-5.3-codex'
}

async function getProviders(): Promise<AvailableModelGroup[]> {
  const groups: AvailableModelGroup[] = []
  console.log('[MODELS] getProviders called')

  try {
    // Read config
    const configRaw = await readFile(configPath, 'utf-8')
    const config: any = YAML.load(configRaw) || {}
    console.log('[MODELS] Config loaded, providers:', Object.keys(config.providers || {}))

    // Read auth
    let auth: any = {}
    try {
      const authRaw = await readFile(authPath, 'utf-8')
      auth = JSON.parse(authRaw)
      console.log('[MODELS] Auth loaded, providers:', Object.keys(auth.providers || {}))
    } catch (e: any) { 
      console.log('[MODELS] No auth file:', e.message)
    }

    // Get configured providers from auth
    const authProviders = auth.providers || {}
    const credentialPool = auth.credential_pool || {}

    // Process each provider
    for (const [name, info] of Object.entries(authProviders)) {
      const providerInfo = info as any
      const base_url = providerInfo.inference_base_url || ''
      
      // Try to fetch models from API
      let models: string[] = []
      
      if (base_url && providerInfo.agent_key) {
        try {
          const url = `${base_url}/models`
          const resp = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${providerInfo.agent_key}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(5000),
          })
          if (resp.ok) {
            const data = await resp.json() as any
            if (data.data && Array.isArray(data.data)) {
              models = data.data
                .filter((m: any) => m.id && !m.id.startsWith('hermes'))
                .map((m: any) => m.id)
                .sort()
            }
          }
        } catch { /* API call failed, use fallback */ }
      }
      
      // Fallback to known models
      if (models.length === 0) {
        models = KNOWN_MODELS[name] || []
      }
      
      if (models.length > 0) {
        groups.push({
          provider: name,
          label: name.charAt(0).toUpperCase() + name.slice(1),
          base_url,
          models,
        })
      }
    }

    // Add providers from credential pool (additional credentials)
    for (const [name, creds] of Object.entries(credentialPool)) {
      if (groups.find(g => g.provider === name)) continue
      
      const credList = Array.isArray(creds) ? creds : []
      for (const cred of credList) {
        if (cred.inference_base_url) {
          const models = KNOWN_MODELS[name] || []
          if (models.length > 0) {
            groups.push({
              provider: name,
              label: name.charAt(0).toUpperCase() + name.slice(1),
              base_url: cred.inference_base_url,
              models,
            })
            break
          }
        }
      }
    }

    // Add custom providers from config
    const providersConfig = config.providers || {}
    for (const [name, info] of Object.entries(providersConfig)) {
      if (groups.find(g => g.provider === name)) continue
      
      const providerInfo = info as any
      if (providerInfo.base_url) {
        const models = KNOWN_MODELS[name] || [providerInfo.model || ''].filter(Boolean)
        groups.push({
          provider: name,
          label: name.charAt(0).toUpperCase() + name.slice(1),
          base_url: providerInfo.base_url,
          models,
        })
      }
    }

    // Always include known providers as fallback
    for (const [name, models] of Object.entries(KNOWN_MODELS)) {
      if (!groups.find(g => g.provider === name)) {
        groups.push({
          provider: name,
          label: name.charAt(0).toUpperCase() + name.slice(1),
          base_url: '',
          models,
        })
      }
    }
  } catch (err: any) {
    console.error('[Models] Failed to read providers:', err.message)
  }

  return groups
}

// GET /api/available-models
modelRoutes.get('/api/available-models', async (ctx) => {
  try {
    console.log('[MODELS] GET /api/available-models called')
    
    // Read current config
    const configRaw = await readFile(configPath, 'utf-8')
    const config: any = YAML.load(configRaw) || {}
    const currentProvider = config.model?.provider || ''
    const currentModel = config.model?.default || ''

    console.log('[MODELS] Current model:', currentProvider, currentModel)

    // Build default model string
    let defaultModel = ''
    if (currentProvider && currentModel) {
      defaultModel = `${currentProvider}/${currentModel}`
    } else if (currentModel) {
      defaultModel = currentModel
    }

    // Get available models
    const groups = await getProviders()
    console.log('[MODELS] Groups:', JSON.stringify(groups.map(g => ({ provider: g.provider, count: g.models.length }))))

    ctx.body = {
      default: defaultModel,
      groups,
    }
  } catch (err: any) {
    console.error('[MODELS] Error:', err.message)
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// GET /api/config/models
modelRoutes.get('/api/config/models', async (ctx) => {
  try {
    const configRaw = await readFile(configPath, 'utf-8')
    const config: any = YAML.load(configRaw) || {}
    
    const currentProvider = config.model?.provider || ''
    const currentModel = config.model?.default || ''
    
    const groups = await getProviders()

    ctx.body = {
      default: currentModel,
      provider: currentProvider,
      groups,
    }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})

// PUT /api/config/model — switch default model
modelRoutes.put('/api/config/model', async (ctx) => {
  try {
    const body = ctx.request.body as any || {}
    const { default: model, provider } = body

    if (!model) {
      ctx.status = 400
      ctx.body = { error: 'model is required' }
      return
    }

    // Read config
    const configRaw = await readFile(configPath, 'utf-8')
    const config: any = YAML.load(configRaw) || {}

    // Update model settings
    if (!config.model) config.model = {}
    
    // Parse model - could be "provider/model" or just "model"
    let actualModel = model
    let actualProvider = provider
    
    if (model.includes('/')) {
      const parts = model.split('/')
      actualProvider = parts[0]
      actualModel = parts.slice(1).join('/')
    }

    actualProvider = normalizeProvider(actualProvider)
    actualModel = normalizeModelForProvider(actualProvider, actualModel)

    if (actualProvider) {
      config.model.provider = actualProvider
    }
    config.model.default = actualModel

    // Write back
    const updated = YAML.dump(config, { lineWidth: -1, noRefs: true })
    await writeFile(configPath, updated, 'utf-8')

    ctx.body = { success: true, provider: actualProvider, model: actualModel }
  } catch (err: any) {
    ctx.status = 500
    ctx.body = { error: err.message }
  }
})
