import type { ToolConfig } from '@/types'
import ky from 'ky'
import { z } from 'zod'
import { draftToolConfigs } from './drafts'
import { labelToolConfigs } from './labels'
import { messageToolConfigs } from './messages'
import { settingToolConfigs } from './settings'
import { ensureValidGoogleToken, getGoogleCredentials } from './utils'
import { watchToolConfigs } from './watch'

/**
 * Schemas
 */
export const listThreadsSchema = z
  .object({
    maxResults: z.number().describe('Maximum number of threads to return'),
    pageToken: z.string().describe('Page token to retrieve a specific page of results'),
    q: z.string().describe('Only return threads matching the specified query'),
    labelIds: z.array(z.string()).describe('Only return threads with labels that match all of the specified label IDs'),
    includeSpamTrash: z.boolean().describe('Include threads from SPAM and TRASH in the results'),
    includeBodyHtml: z.boolean().describe('Whether to include the parsed HTML in the return for each body'),
  })
  .strict()

export const getThreadSchema = z
  .object({
    id: z.string().describe('The ID of the thread to retrieve'),
    includeBodyHtml: z.boolean().describe('Whether to include the parsed HTML in the return for each body'),
  })
  .strict()

export const modifyThreadSchema = z
  .object({
    id: z.string().describe('Thread ID'),
    addLabelIds: z.array(z.string()),
    removeLabelIds: z.array(z.string()),
  })
  .strict()

export const simpleThreadIdSchema = z.object({ id: z.string().describe('Thread ID') }).strict()

export type ListThreadsParams = z.infer<typeof listThreadsSchema>
export type GetThreadParams = z.infer<typeof getThreadSchema>
export type ModifyThreadParams = z.infer<typeof modifyThreadSchema>
export type SimpleThreadIdParams = z.infer<typeof simpleThreadIdSchema>

// ---------------------------------------------------------------------------
// Google Mail API minimal types
// ---------------------------------------------------------------------------

type GoogleThreadStub = {
  id: string
  snippet?: string
  historyId?: string
}

export type GoogleListThreadsResponse = {
  threads?: GoogleThreadStub[]
  nextPageToken?: string
  resultSizeEstimate?: number
}

type GoogleMessagePayload = {
  mimeType?: string
  body?: { data?: string }
  parts?: GoogleMessagePayload[]
}

type GoogleMessage = {
  id?: string
  payload?: GoogleMessagePayload
  [key: string]: unknown
}

export type GoogleThreadResponse = {
  id?: string
  messages?: GoogleMessage[]
  [key: string]: unknown
}

/**
 * Public API
 */
export const listThreads = async (params: ListThreadsParams) => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)

  const searchParams = new URLSearchParams()
  if (params.maxResults) searchParams.set('maxResults', params.maxResults.toString())
  if (
    params.pageToken &&
    params.pageToken.trim() !== '' &&
    params.pageToken !== 'None' &&
    params.pageToken !== 'null'
  ) {
    searchParams.set('pageToken', params.pageToken)
  }
  if (params.q) searchParams.set('q', params.q)
  if (params.labelIds?.length) params.labelIds.forEach((id) => searchParams.append('labelIds', id))
  if (params.includeSpamTrash !== undefined) searchParams.set('includeSpamTrash', String(params.includeSpamTrash))

  const response = await ky
    .get('https://www.googleapis.com/gmail/v1/users/me/threads', {
      searchParams,
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .json<GoogleListThreadsResponse>()

  if (params.includeBodyHtml && response.threads) {
    const threadsWithDetails = await Promise.all(
      response.threads.map((thread) => getThread({ id: thread.id, includeBodyHtml: true })),
    )
    return { ...response, threads: threadsWithDetails }
  }

  return response
}

export const getThread = async (params: GetThreadParams) => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)

  const response = await ky
    .get(`https://www.googleapis.com/gmail/v1/users/me/threads/${params.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .json<GoogleThreadResponse>()

  if (params.includeBodyHtml && response.messages) {
    response.messages = response.messages.map((m) => {
      const processed = { ...m } as GoogleMessage & { bodyHtml?: string | null; bodyText?: string | null }
      if (m.payload) {
        processed.bodyHtml = extractBody(m.payload, 'text/html')
        processed.bodyText = extractBody(m.payload, 'text/plain')
      }
      return processed
    })
  }

  return response as GoogleThreadResponse & {
    messages?: (GoogleMessage & { bodyHtml?: string | null; bodyText?: string | null })[]
  }
}

/** Recursively extract part body */
const extractBody = (
  payload: { mimeType?: string; body?: { data?: string }; parts?: any[] },
  type: string,
): string | null => {
  if (payload.mimeType === type && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8')
  }
  if (payload.parts) {
    for (const p of payload.parts) {
      const body = extractBody(p, type)
      if (body) return body
    }
  }
  return null
}

// ----------------- Thread mutations -----------------

export const modifyThread = async (params: ModifyThreadParams) => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)

  return await ky
    .post(`https://www.googleapis.com/gmail/v1/users/me/threads/${params.id}/modify`, {
      json: {
        addLabelIds: params.addLabelIds,
        removeLabelIds: params.removeLabelIds,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .json<GoogleThreadResponse>()
}

export const deleteThread = async (params: SimpleThreadIdParams) => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)
  await ky.delete(`https://www.googleapis.com/gmail/v1/users/me/threads/${params.id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return { status: 'deleted' }
}

export const trashThread = async (params: SimpleThreadIdParams) => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)
  return await ky
    .post(`https://www.googleapis.com/gmail/v1/users/me/threads/${params.id}/trash`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .json<GoogleThreadResponse>()
}

export const untrashThread = async (params: SimpleThreadIdParams) => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)
  return await ky
    .post(`https://www.googleapis.com/gmail/v1/users/me/threads/${params.id}/untrash`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .json<GoogleThreadResponse>()
}

export const threadToolConfigs: ToolConfig[] = [
  {
    name: 'google_list_threads',
    description: 'List Google threads with optional filtering',
    verb: 'Listing Google threads',
    parameters: listThreadsSchema,
    execute: listThreads,
  },
  {
    name: 'google_get_thread',
    description: 'Get a specific Google thread by ID',
    verb: 'Getting Google thread',
    parameters: getThreadSchema,
    execute: getThread,
  },
  {
    name: 'google_modify_thread',
    description: 'Add or remove labels on a Gmail thread',
    verb: 'Modifying Gmail thread',
    parameters: modifyThreadSchema,
    execute: modifyThread,
  },
  {
    name: 'google_delete_thread',
    description: 'Permanently delete a Gmail thread',
    verb: 'Deleting Gmail thread',
    parameters: simpleThreadIdSchema,
    execute: deleteThread,
  },
  {
    name: 'google_trash_thread',
    description: 'Move a Gmail thread to Trash',
    verb: 'Trashing Gmail thread',
    parameters: simpleThreadIdSchema,
    execute: trashThread,
  },
  {
    name: 'google_untrash_thread',
    description: 'Move a Gmail thread out of Trash',
    verb: 'Untrashing Gmail thread',
    parameters: simpleThreadIdSchema,
    execute: untrashThread,
  },
]

// Combine with message tools
export const configs: ToolConfig[] = [
  ...threadToolConfigs,
  ...messageToolConfigs,
  ...labelToolConfigs,
  ...draftToolConfigs,
  ...settingToolConfigs,
  ...watchToolConfigs,
]
