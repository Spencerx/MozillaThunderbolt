import type { ToolConfig } from '@/types'
import ky from 'ky'
import { z } from 'zod'
import { ensureValidGoogleToken, getGoogleCredentials } from './utils'

const base = 'https://www.googleapis.com/gmail/v1/users/me/drafts'

// ----------------- Schemas -----------------
export const listDraftsSchema = z
  .object({
    maxResults: z.number(),
    pageToken: z.string(),
    q: z.string(),
  })
  .strict()
export const getDraftSchema = z.object({ id: z.string().describe('Draft ID') }).strict()
export const deleteDraftSchema = z.object({ id: z.string().describe('Draft ID') }).strict()
export const sendDraftSchema = z.object({ id: z.string().describe('Draft ID') }).strict()

export const createOrUpdateDraftSchema = z
  .object({
    id: z.string().describe('Existing draft ID (omit to create new)'),
    to: z.string().describe('Recipient email address'),
    subject: z.string().describe('Email subject'),
    bodyHtml: z.string(),
    bodyText: z.string(),
  })
  .strict()

export type ListDraftParams = z.infer<typeof listDraftsSchema>
export type GetDraftParams = z.infer<typeof getDraftSchema>
export type DeleteDraftParams = z.infer<typeof deleteDraftSchema>
export type SendDraftParams = z.infer<typeof sendDraftSchema>
export type CreateOrUpdateDraftParams = z.infer<typeof createOrUpdateDraftSchema>

// ----------------- Helpers -----------------
const authHeaders = async () => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)
  return { Authorization: `Bearer ${accessToken}` }
}

const buildRawMessage = (p: { to: string; subject: string; bodyHtml?: string; bodyText?: string }) => {
  const parts: string[] = []
  parts.push('From: me')
  parts.push(`To: ${p.to}`)
  parts.push(`Subject: ${p.subject}`)
  parts.push('MIME-Version: 1.0')
  if (p.bodyHtml) {
    parts.push('Content-Type: text/html; charset="UTF-8"')
    parts.push('')
    parts.push(p.bodyHtml)
  } else {
    parts.push('Content-Type: text/plain; charset="UTF-8"')
    parts.push('')
    parts.push(p.bodyText ?? '')
  }
  return Buffer.from(parts.join('\r\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
}

// ----------------- API -----------------
export const listDrafts = async (p: ListDraftParams) => {
  const headers = await authHeaders()
  const searchParams = new URLSearchParams()
  if (p.maxResults) searchParams.set('maxResults', p.maxResults.toString())
  if (p.pageToken) searchParams.set('pageToken', p.pageToken)
  if (p.q) searchParams.set('q', p.q)
  return await ky.get(base, { searchParams, headers }).json()
}

export const getDraft = async (p: GetDraftParams) => ky.get(`${base}/${p.id}`, { headers: await authHeaders() }).json()
export const deleteDraft = async (p: DeleteDraftParams) =>
  ky.delete(`${base}/${p.id}`, { headers: await authHeaders() }).json()
export const sendDraft = async (p: SendDraftParams) =>
  ky.post(`${base}/${p.id}/send`, { headers: await authHeaders() }).json()

export const createOrUpdateDraft = async (p: CreateOrUpdateDraftParams) => {
  const headers = await authHeaders()
  const raw = buildRawMessage(p)
  if (p.id) {
    // update (PUT)
    return ky.put(`${base}/${p.id}`, { headers, json: { message: { raw } } }).json()
  }
  // create
  return ky.post(base, { headers, json: { message: { raw } } }).json()
}

export const draftToolConfigs: ToolConfig[] = [
  {
    name: 'google_list_drafts',
    description: 'List Gmail drafts',
    verb: 'Listing drafts',
    parameters: listDraftsSchema,
    execute: listDrafts,
  },
  {
    name: 'google_get_draft',
    description: 'Get a Gmail draft',
    verb: 'Getting draft',
    parameters: getDraftSchema,
    execute: getDraft,
  },
  {
    name: 'google_create_or_update_draft',
    description: 'Create or update a Gmail draft',
    verb: 'Creating/updating draft',
    parameters: createOrUpdateDraftSchema,
    execute: createOrUpdateDraft,
  },
  {
    name: 'google_delete_draft',
    description: 'Delete a Gmail draft',
    verb: 'Deleting draft',
    parameters: deleteDraftSchema,
    execute: deleteDraft,
  },
  {
    name: 'google_send_draft',
    description: 'Send a Gmail draft',
    verb: 'Sending draft',
    parameters: sendDraftSchema,
    execute: sendDraft,
  },
]
