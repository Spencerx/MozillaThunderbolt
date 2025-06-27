import { getDefaultCloudUrl } from '@/lib/config'
import { v7 as uuidv7 } from 'uuid'
import { DatabaseSingleton } from '../db/singleton'
import { accountsTable, mcpServersTable, modelsTable, settingsTable, tasksTable } from '../db/tables'

export const seedAccounts = async () => {
  const db = DatabaseSingleton.instance.db
  await db.select().from(accountsTable)
  // if (accounts.length === 0) {
  //   await db.insert(accountsTable).values({
  //     id: uuidv7(),
  //     type: 'imap',
  //     imapHostname: 'imap.thundermail.com',
  //     imapPort: 993,
  //     imapUsername: 'you@tb.pro',
  //     imapPassword: 'password',
  //   })
  // }
}

export const seedModels = async () => {
  const db = DatabaseSingleton.instance.db
  const models = await db.select().from(modelsTable)
  if (models.length === 0) {
    const seedData = [
      {
        id: uuidv7(),
        name: 'Llama 3.1 405B',
        provider: 'thunderbolt' as const,
        model: 'llama-v3p1-405b-instruct',
        isSystem: 1,
        enabled: 1,
        isConfidential: 0,
      },
      {
        id: uuidv7(),
        name: 'Llama 3.1 70B',
        provider: 'thunderbolt' as const,
        model: 'llama-v3p1-70b-instruct',
        isSystem: 1,
        enabled: 1,
        isConfidential: 0,
      },
      {
        id: uuidv7(),
        name: 'Qwen 3 235B',
        provider: 'thunderbolt' as const,
        model: 'qwen3-235b-a22b',
        isSystem: 0,
        enabled: 1,
        isConfidential: 0,
      },
      // {
      //   id: uuidv7(),
      //   name: 'DeepSeek R1 671B',
      //   provider: 'thunderbolt' as const,
      //   model: 'deepseek-r1-0528',
      //   isSystem: 0,
      //   enabled: 1,
      // },
      {
        id: uuidv7(),
        name: 'Llama 3.2 3B',
        provider: 'openai_compatible' as const,
        model: 'llama3.2:3b-instruct-q4_1',
        url: 'http://localhost:11434/v1',
        isSystem: 0,
        enabled: 1,
        isConfidential: 0,
      },
      // Confidential Compute model
      {
        id: uuidv7(),
        name: 'Mistral Small 24B (Confidential)',
        provider: 'flower' as const,
        model: 'mistralai/mistral-small-3.1-24b',
        isSystem: 0,
        enabled: 1,
        toolUsage: 1,
        isConfidential: 1,
      },
    ]
    for (const model of seedData) {
      await db.insert(modelsTable).values(model)
    }
  }
}

export const seedSettings = async () => {
  const db = DatabaseSingleton.instance.db
  await db
    .insert(settingsTable)
    .values({
      key: 'cloud_url',
      value: getDefaultCloudUrl(),
    })
    .onConflictDoNothing()

  await db
    .insert(settingsTable)
    .values({
      key: 'anonymous_id',
      value: uuidv7(), // @todo this should really be cryptographically secure
    })
    .onConflictDoNothing()
}

export const seedMcpServers = async () => {
  const db = DatabaseSingleton.instance.db
  const existingServers = await db.select().from(mcpServersTable).limit(1)

  if (existingServers.length === 0) {
    // Use centralized config for default MCP server URL
    await db.insert(mcpServersTable).values({
      id: uuidv7(),
      name: 'Thunderbolt MCP Server',
      url: `${getDefaultCloudUrl()}/mcp/`,
      enabled: 1,
    })
  }
}

export const seedTasks = async () => {
  const db = DatabaseSingleton.instance.db
  const existingTasks = await db.select().from(tasksTable).limit(1)

  if (existingTasks.length > 0) {
    return
  }

  const seedData = [
    {
      id: uuidv7(),
      item: 'Connect your email account to get started',
      order: 100,
      isComplete: 0,
    },
    {
      id: uuidv7(),
      item: 'Set your name and location in preferences for better AI responses',
      order: 200,
      isComplete: 0,
    },
    {
      id: uuidv7(),
      item: "Explore MCP tools to extend Thunderbolt's capabilities",
      order: 300,
      isComplete: 0,
    },
  ]

  for (const task of seedData) {
    await db.insert(tasksTable).values(task)
  }
}
