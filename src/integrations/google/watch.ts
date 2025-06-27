import type { ToolConfig } from '@/types'
import ky from 'ky'
import { z } from 'zod'
import { ensureValidGoogleToken, getGoogleCredentials } from './utils'

const userBase = 'https://www.googleapis.com/gmail/v1/users/me'

// ----------------- Schemas -----------------
export const watchMailboxSchema = z
  .object({
    topicName: z.string().describe('Pub/Sub topic name for push notifications'),
    labelIds: z.array(z.string()),
    labelFilterAction: z.enum(['include', 'exclude']),
  })
  .strict()

export const stopWatchSchema = z.object({}).strict()

export const listHistorySchema = z
  .object({
    startHistoryId: z.string().describe('Only history records at or after startHistoryId are returned'),
    maxResults: z.number(),
    pageToken: z.string(),
    labelId: z.string(),
  })
  .strict()

// ----------------- Types -----------------
export type WatchMailboxParams = z.infer<typeof watchMailboxSchema>
export type ListHistoryParams = z.infer<typeof listHistorySchema>

// ----------------- Helper -----------------
const api = async <T>(method: 'get' | 'post', url: string, body?: any, search?: any): Promise<T> => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)
  return await ky[method](url, {
    json: body,
    searchParams: search,
    headers: { Authorization: `Bearer ${accessToken}` },
  }).json<T>()
}

// ----------------- Functions -------------
export const watchMailbox = async (p: WatchMailboxParams) => api('post', `${userBase}/watch`, p)
export const stopMailboxWatch = async () => api('post', `${userBase}/stop`)
export const listHistory = async (p: ListHistoryParams) =>
  api('get', `${userBase}/history`, undefined, {
    startHistoryId: p.startHistoryId,
    maxResults: p.maxResults?.toString(),
    pageToken: p.pageToken,
    labelId: p.labelId,
  })

// ----------------- Configs ---------------
export const watchToolConfigs: ToolConfig[] = [
  {
    name: 'google_watch_mailbox',
    description: 'Start watching the mailbox for push notifications',
    verb: 'Watching Gmail mailbox',
    parameters: watchMailboxSchema,
    execute: watchMailbox,
  },
  {
    name: 'google_stop_mailbox_watch',
    description: 'Stop watching the mailbox',
    verb: 'Stopping Gmail mailbox watch',
    parameters: stopWatchSchema,
    execute: stopMailboxWatch,
  },
  {
    name: 'google_list_history',
    description: 'List mailbox history records',
    verb: 'Listing Gmail history',
    parameters: listHistorySchema,
    execute: listHistory,
  },
]
