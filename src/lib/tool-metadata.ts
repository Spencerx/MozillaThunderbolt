export type ToolCategory = 'search' | 'data' | 'action' | 'analysis' | 'communication' | 'weather' | 'unknown'

export type ToolMetadata = {
  displayName: string
  loadingMessage: string
  category: ToolCategory
}

// Cache for performance
const metadataCache = new Map<string, ToolMetadata>()

/**
 * Detects tool category based on name patterns
 */
const detectCategory = (toolName: string): ToolCategory => {
  const name = toolName.toLowerCase()

  if (/search|find|query|lookup|grep|codebase_search/.test(name)) return 'search'
  if (/fetch|get|retrieve|load|read|file_search/.test(name)) return 'data'
  if (/create|add|insert|generate|make|edit|write|delete|remove|update|modify|change|set|replace/.test(name))
    return 'action'
  if (/analyze|process|calculate|compute|evaluate/.test(name)) return 'analysis'
  if (/send|email|message|notify|communicate/.test(name)) return 'communication'
  if (/weather|forecast|temperature|climate/.test(name)) return 'weather'

  return 'unknown'
}

/**
 * Formats tool name for display (snake_case/camelCase → Title Case)
 */
const formatDisplayName = (toolName: string): string =>
  toolName
    .replace(/[._-]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .slice(0, 25)

/**
 * Generates contextual loading message
 */
const generateLoadingMessage = (toolName: string, category: ToolCategory, args?: any): string => {
  const name = toolName.toLowerCase()

  // Context-aware messages with args
  if (args) {
    if (name.includes('search') && args.query) {
      const query = args.query.slice(0, 20)
      return `Searching for "${query}${args.query.length > 20 ? '...' : ''}"...`
    }
    if (name.includes('weather') && args.location) {
      return `Getting weather for ${args.location}...`
    }
    if ((name.includes('edit') || name.includes('file')) && args.target_file) {
      const fileName = args.target_file.split('/').pop() || args.target_file
      return `${name.includes('edit') ? 'Editing' : 'Reading'} ${fileName}...`
    }
    if (name.includes('grep') && args.query) {
      const query = args.query.slice(0, 15)
      return `Searching for "${query}${args.query.length > 15 ? '...' : ''}"...`
    }
  }

  // Category fallbacks
  const messages: Record<ToolCategory, string> = {
    search: 'Searching...',
    data: 'Retrieving data...',
    action:
      name.includes('edit') || name.includes('write')
        ? 'Editing...'
        : name.includes('create') || name.includes('add')
          ? 'Creating...'
          : name.includes('delete') || name.includes('remove')
            ? 'Removing...'
            : 'Processing...',
    analysis: 'Analyzing...',
    communication: 'Sending...',
    weather: 'Getting weather...',
    unknown: 'Processing...',
  }

  return messages[category]
}

/**
 * Gets tool metadata with caching for performance
 */
export const getToolMetadata = (toolName: string, args?: any): ToolMetadata => {
  const cacheKey = `${toolName}:${JSON.stringify(args || {})}`

  if (metadataCache.has(cacheKey)) {
    return metadataCache.get(cacheKey)!
  }

  const category = detectCategory(toolName)
  const metadata: ToolMetadata = {
    displayName: formatDisplayName(toolName),
    loadingMessage: generateLoadingMessage(toolName, category, args),
    category,
  }

  metadataCache.set(cacheKey, metadata)
  return metadata
}
