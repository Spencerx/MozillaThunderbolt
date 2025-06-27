import type { ToolConfig } from '@/types'
import ky from 'ky'
import { z } from 'zod'
import { ensureValidGoogleToken, getGoogleCredentials } from './utils'

/**
 * Schemas
 */
export const listMessagesSchema = z
  .object({
    maxResults: z.number().describe('Maximum number of messages to return'),
    pageToken: z.string().describe('Page token to retrieve a specific page of results'),
    q: z.string().describe('Only return messages matching the specified Gmail search query'),
    labelIds: z
      .array(z.string())
      .describe('Only return messages with labels that match all of the specified label IDs'),
    includeSpamTrash: z.boolean().describe('Include messages from SPAM and TRASH in the results'),
    includeBodyHtml: z.boolean().describe('Whether to include the parsed HTML in the return for each body'),
  })
  .strict()

export const getMessageSchema = z
  .object({
    id: z.string().describe('The ID of the message to retrieve'),
    includeBodyHtml: z.boolean().describe('Whether to include the parsed HTML / text in the response'),
  })
  .strict()

export const sendMessageSchema = z
  .object({
    to: z.string().describe('Recipient email address'),
    subject: z.string().describe('Email subject'),
    bodyHtml: z.string().describe('HTML body of the email'),
    bodyText: z.string().describe('Plain-text body of the email (used if bodyHtml omitted)'),
  })
  .strict()

export const modifyMessageSchema = z
  .object({
    id: z.string().describe('ID of the message to modify'),
    addLabelIds: z.array(z.string()),
    removeLabelIds: z.array(z.string()),
  })
  .strict()

export const simpleIdSchema = z.object({ id: z.string().describe('ID of the message') }).strict()

export const batchModifySchema = z
  .object({
    ids: z.array(z.string()).describe('IDs of messages'),
    addLabelIds: z.array(z.string()),
    removeLabelIds: z.array(z.string()),
  })
  .strict()

export const batchDeleteSchema = z.object({ ids: z.array(z.string()).describe('IDs of messages to delete') }).strict()

export const attachmentSchema = z
  .object({
    messageId: z.string().describe('ID of the parent message'),
    attachmentId: z.string().describe('ID of the attachment'),
  })
  .strict()

export type ListMessagesParams = z.infer<typeof listMessagesSchema>
export type GetMessageParams = z.infer<typeof getMessageSchema>
export type SendMessageParams = z.infer<typeof sendMessageSchema>
export type ModifyMessageParams = z.infer<typeof modifyMessageSchema>
export type SimpleIdParams = z.infer<typeof simpleIdSchema>
export type BatchModifyParams = z.infer<typeof batchModifySchema>
export type BatchDeleteParams = z.infer<typeof batchDeleteSchema>
export type AttachmentParams = z.infer<typeof attachmentSchema>

// ---------------------------------------------------------------------------
// Google Mail API minimal types (subset)
// ---------------------------------------------------------------------------

export type GoogleListMessagesResponse = {
  messages?: { id: string; threadId?: string }[]
  nextPageToken?: string
  resultSizeEstimate?: number
}

export type GoogleMessagePayload = {
  mimeType?: string
  body?: { data?: string }
  parts?: GoogleMessagePayload[]
}

export type GoogleMessage = {
  id?: string
  threadId?: string
  payload?: GoogleMessagePayload
  [key: string]: unknown
}

export type GoogleMessageResponse = GoogleMessage

/**
 * Public API wrappers
 */

export const listMessages = async (params: ListMessagesParams) => {
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
    .get('https://www.googleapis.com/gmail/v1/users/me/messages', {
      searchParams,
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .json<GoogleListMessagesResponse>()

  if (params.includeBodyHtml && response.messages) {
    const withDetails = await Promise.all(response.messages.map((m) => getMessage({ id: m.id, includeBodyHtml: true })))
    return { ...response, messages: withDetails }
  }

  return response
}

export const getMessage = async (params: GetMessageParams) => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)

  const response = await ky
    .get(`https://www.googleapis.com/gmail/v1/users/me/messages/${params.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .json<GoogleMessageResponse>()

  if (params.includeBodyHtml && response.payload) {
    const bodyHtml = extractBody(response.payload, 'text/html')
    const bodyText = extractBody(response.payload, 'text/plain')
    return { ...response, bodyHtml, bodyText }
  }

  return response
}

// Helper: recursively extract desired part body
const extractBody = (payload: GoogleMessagePayload, type: string): string | null => {
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

export const sendMessage = async (params: SendMessageParams) => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)

  const messageParts: string[] = []
  messageParts.push(`From: me`) // Gmail API resolves this automatically to authenticated user
  messageParts.push(`To: ${params.to}`)
  messageParts.push(`Subject: ${params.subject}`)
  messageParts.push('MIME-Version: 1.0')
  if (params.bodyHtml) {
    messageParts.push(`Content-Type: text/html; charset="UTF-8"`)
    messageParts.push('')
    messageParts.push(params.bodyHtml)
  } else if (params.bodyText) {
    messageParts.push(`Content-Type: text/plain; charset="UTF-8"`)
    messageParts.push('')
    messageParts.push(params.bodyText)
  } else {
    messageParts.push(`Content-Type: text/plain; charset="UTF-8"`)
    messageParts.push('')
    messageParts.push('')
  }

  const raw = Buffer.from(messageParts.join('\r\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')

  const response = await ky
    .post('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
      json: { raw },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .json<GoogleMessage>()

  return response
}

export const modifyMessage = async (params: ModifyMessageParams) => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)

  return await ky
    .post(`https://www.googleapis.com/gmail/v1/users/me/messages/${params.id}/modify`, {
      json: {
        addLabelIds: params.addLabelIds,
        removeLabelIds: params.removeLabelIds,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .json<GoogleMessage>()
}

export const deleteMessage = async (params: SimpleIdParams) => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)
  await ky.delete(`https://www.googleapis.com/gmail/v1/users/me/messages/${params.id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  return { status: 'deleted' }
}

export const trashMessage = async (params: SimpleIdParams) => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)
  return await ky
    .post(`https://www.googleapis.com/gmail/v1/users/me/messages/${params.id}/trash`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .json<GoogleMessage>()
}

export const untrashMessage = async (params: SimpleIdParams) => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)
  return await ky
    .post(`https://www.googleapis.com/gmail/v1/users/me/messages/${params.id}/untrash`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .json<GoogleMessage>()
}

export const batchModifyMessages = async (params: BatchModifyParams) => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)
  return await ky
    .post('https://www.googleapis.com/gmail/v1/users/me/messages/batchModify', {
      json: {
        ids: params.ids,
        addLabelIds: params.addLabelIds,
        removeLabelIds: params.removeLabelIds,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .json()
}

export const batchDeleteMessages = async (params: BatchDeleteParams) => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)
  return await ky
    .post('https://www.googleapis.com/gmail/v1/users/me/messages/batchDelete', {
      json: { ids: params.ids },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    .json()
}

export const getMessageAttachment = async (params: AttachmentParams) => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)
  return await ky
    .get(
      `https://www.googleapis.com/gmail/v1/users/me/messages/${params.messageId}/attachments/${params.attachmentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    .json()
}

/**
 * Tool configs to be consumed by the core tool registry
 */
export const messageToolConfigs: ToolConfig[] = [
  {
    name: 'google_list_messages',
    description: 'List Gmail messages with optional filtering',
    verb: 'Listing Gmail messages',
    parameters: listMessagesSchema,
    execute: listMessages,
  },
  {
    name: 'google_get_message',
    description: 'Get a specific Gmail message by ID',
    verb: 'Getting Gmail message',
    parameters: getMessageSchema,
    execute: getMessage,
  },
  {
    name: 'google_send_message',
    description: 'Send an email message using the authenticated Gmail account',
    verb: 'Sending Gmail message',
    parameters: sendMessageSchema,
    execute: sendMessage,
  },
  {
    name: 'google_modify_message',
    description: 'Add or remove labels on a Gmail message',
    verb: 'Modifying Gmail message',
    parameters: modifyMessageSchema,
    execute: modifyMessage,
  },
  {
    name: 'google_delete_message',
    description: 'Permanently delete a Gmail message',
    verb: 'Deleting Gmail message',
    parameters: simpleIdSchema,
    execute: deleteMessage,
  },
  {
    name: 'google_trash_message',
    description: 'Move a Gmail message to Trash',
    verb: 'Trashing Gmail message',
    parameters: simpleIdSchema,
    execute: trashMessage,
  },
  {
    name: 'google_untrash_message',
    description: 'Move a Gmail message out of Trash',
    verb: 'Untrashing Gmail message',
    parameters: simpleIdSchema,
    execute: untrashMessage,
  },
  {
    name: 'google_batch_modify_messages',
    description: 'Batch modify labels on multiple Gmail messages',
    verb: 'Batch modifying Gmail messages',
    parameters: batchModifySchema,
    execute: batchModifyMessages,
  },
  {
    name: 'google_batch_delete_messages',
    description: 'Batch delete Gmail messages',
    verb: 'Batch deleting Gmail messages',
    parameters: batchDeleteSchema,
    execute: batchDeleteMessages,
  },
  {
    name: 'google_get_message_attachment',
    description: 'Retrieve a message attachment',
    verb: 'Getting Gmail message attachment',
    parameters: attachmentSchema,
    execute: getMessageAttachment,
  },
]
