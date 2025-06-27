import type { ToolConfig } from '@/types'
import ky from 'ky'
import { z } from 'zod'
import { ensureValidGoogleToken, getGoogleCredentials } from './utils'

const base = 'https://www.googleapis.com/gmail/v1/users/me/settings'

// Generic helper
const api = async <T>(method: 'get' | 'put' | 'post' | 'patch' | 'delete', url: string, body?: any): Promise<T> => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)
  return await ky[method](url, { headers: { Authorization: `Bearer ${accessToken}` }, json: body }).json<T>()
}

// ----------------- SCHEMAS ---------------
export const emptySchema = z.object({}).strict()

const updatePayload = z.object({}).strict().describe('Request payload matching Gmail API spec')

const idSchema = z.object({ id: z.string() }).strict()
const sendAsEmailSchema = z.object({ sendAsEmail: z.string() }).strict()

// ----------------- FUNCTIONS -------------
// Auto-forwarding
export const getAutoForwarding = async () => api('get', `${base}/autoForwarding`)
export const updateAutoForwarding = async (p: z.infer<typeof updatePayload>) => api('put', `${base}/autoForwarding`, p)

// IMAP
export const getImap = async () => api('get', `${base}/imap`)
export const updateImap = async (p: z.infer<typeof updatePayload>) => api('put', `${base}/imap`, p)

// POP
export const getPop = async () => api('get', `${base}/pop`)
export const updatePop = async (p: z.infer<typeof updatePayload>) => api('put', `${base}/pop`, p)

// Vacation
export const getVacation = async () => api('get', `${base}/vacation`)
export const updateVacation = async (p: z.infer<typeof updatePayload>) => api('put', `${base}/vacation`, p)

// Language
export const getLanguage = async () => api('get', `${base}/language`)
export const updateLanguage = async (p: z.infer<typeof updatePayload>) => api('put', `${base}/language`, p)

// Delegates
export const listDelegates = async () => api('get', `${base}/delegates`)
export const addDelegate = async (p: { email: string }) => api('post', `${base}/delegates`, { delegateEmail: p.email })
export const getDelegate = async (p: { email: string }) =>
  api('get', `${base}/delegates/${encodeURIComponent(p.email)}`)
export const removeDelegate = async (p: { email: string }) =>
  api('delete', `${base}/delegates/${encodeURIComponent(p.email)}`)

// Filters
export const listFilters = async () => api('get', `${base}/filters`)
export const createFilter = async (p: z.infer<typeof updatePayload>) => api('post', `${base}/filters`, p)
export const getFilter = async (p: z.infer<typeof idSchema>) => api('get', `${base}/filters/${p.id}`)
export const deleteFilter = async (p: z.infer<typeof idSchema>) => api('delete', `${base}/filters/${p.id}`)

// Forwarding addresses
export const listForwardingAddresses = async () => api('get', `${base}/forwardingAddresses`)
export const createForwardingAddress = async (p: { forwardingEmail: string }) =>
  api('post', `${base}/forwardingAddresses`, p)
export const getForwardingAddress = async (p: { forwardingEmail: string }) =>
  api('get', `${base}/forwardingAddresses/${encodeURIComponent(p.forwardingEmail)}`)
export const deleteForwardingAddress = async (p: { forwardingEmail: string }) =>
  api('delete', `${base}/forwardingAddresses/${encodeURIComponent(p.forwardingEmail)}`)

// SendAs
export const listSendAs = async () => api('get', `${base}/sendAs`)
export const createSendAs = async (p: z.infer<typeof updatePayload>) => api('post', `${base}/sendAs`, p)
export const getSendAs = async (p: z.infer<typeof sendAsEmailSchema>) =>
  api('get', `${base}/sendAs/${encodeURIComponent(p.sendAsEmail)}`)
export const updateSendAs = async (p: { sendAsEmail: string } & Record<string, any>) => {
  const { sendAsEmail, ...body } = p
  return api('put', `${base}/sendAs/${encodeURIComponent(sendAsEmail)}`, body)
}
export const patchSendAs = async (p: { sendAsEmail: string } & Record<string, any>) => {
  const { sendAsEmail, ...body } = p
  return api('patch', `${base}/sendAs/${encodeURIComponent(sendAsEmail)}`, body)
}
export const verifySendAs = async (p: { sendAsEmail: string }) =>
  api('post', `${base}/sendAs/${encodeURIComponent(p.sendAsEmail)}/verify`)
export const deleteSendAs = async (p: { sendAsEmail: string }) =>
  api('delete', `${base}/sendAs/${encodeURIComponent(p.sendAsEmail)}`)

// S/MIME info (subset)
export const listSmimeInfo = async (p: { sendAsEmail: string }) =>
  api('get', `${base}/sendAs/${encodeURIComponent(p.sendAsEmail)}/smimeInfo`)
export const getSmimeInfo = async (p: { sendAsEmail: string; id: string }) =>
  api('get', `${base}/sendAs/${encodeURIComponent(p.sendAsEmail)}/smimeInfo/${p.id}`)
export const deleteSmimeInfo = async (p: { sendAsEmail: string; id: string }) =>
  api('delete', `${base}/sendAs/${encodeURIComponent(p.sendAsEmail)}/smimeInfo/${p.id}`)
export const setDefaultSmimeInfo = async (p: { sendAsEmail: string; id: string }) =>
  api('post', `${base}/sendAs/${encodeURIComponent(p.sendAsEmail)}/smimeInfo/${p.id}/setDefault`)

// ----------------- CONFIGS -----------------
// helper to shorten
const cfg = <P extends z.ZodObject<any, any>>(
  name: string,
  description: string,
  verb: string,
  schema: P,
  fn: any,
): ToolConfig => ({
  name,
  description,
  verb,
  parameters: schema,
  execute: fn,
})

export const settingToolConfigs: ToolConfig[] = [
  cfg(
    'google_get_auto_forwarding',
    'Get auto-forwarding settings',
    'Getting auto-forwarding',
    emptySchema,
    getAutoForwarding,
  ),
  cfg(
    'google_update_auto_forwarding',
    'Update auto-forwarding settings',
    'Updating auto-forwarding',
    updatePayload,
    updateAutoForwarding,
  ),

  cfg('google_get_imap', 'Get IMAP settings', 'Getting IMAP', emptySchema, getImap),
  cfg('google_update_imap', 'Update IMAP settings', 'Updating IMAP', updatePayload, updateImap),

  cfg('google_get_pop', 'Get POP settings', 'Getting POP', emptySchema, getPop),
  cfg('google_update_pop', 'Update POP settings', 'Updating POP', updatePayload, updatePop),

  cfg('google_get_vacation', 'Get vacation responder settings', 'Getting vacation', emptySchema, getVacation),
  cfg('google_update_vacation', 'Update vacation responder', 'Updating vacation', updatePayload, updateVacation),

  cfg('google_get_language', 'Get language settings', 'Getting language', emptySchema, getLanguage),
  cfg('google_update_language', 'Update language settings', 'Updating language', updatePayload, updateLanguage),

  cfg('google_list_delegates', 'List account delegates', 'Listing delegates', emptySchema, listDelegates),
  cfg(
    'google_add_delegate',
    'Add account delegate',
    'Adding delegate',
    z.object({ email: z.string() }).strict(),
    addDelegate,
  ),
  cfg(
    'google_get_delegate',
    'Get account delegate',
    'Getting delegate',
    z.object({ email: z.string() }).strict(),
    getDelegate,
  ),
  cfg(
    'google_remove_delegate',
    'Remove account delegate',
    'Removing delegate',
    z.object({ email: z.string() }).strict(),
    removeDelegate,
  ),

  cfg('google_list_filters', 'List filters', 'Listing filters', emptySchema, listFilters),
  cfg('google_create_filter', 'Create filter', 'Creating filter', updatePayload, createFilter),
  cfg('google_get_filter', 'Get filter', 'Getting filter', idSchema, getFilter),
  cfg('google_delete_filter', 'Delete filter', 'Deleting filter', idSchema, deleteFilter),

  cfg(
    'google_list_forwarding_addresses',
    'List forwarding addresses',
    'Listing forwarding addresses',
    emptySchema,
    listForwardingAddresses,
  ),
  cfg(
    'google_create_forwarding_address',
    'Create forwarding address',
    'Creating forwarding address',
    z.object({ forwardingEmail: z.string() }).strict(),
    createForwardingAddress,
  ),
  cfg(
    'google_get_forwarding_address',
    'Get forwarding address',
    'Getting forwarding address',
    z.object({ forwardingEmail: z.string() }).strict(),
    getForwardingAddress,
  ),
  cfg(
    'google_delete_forwarding_address',
    'Delete forwarding address',
    'Deleting forwarding address',
    z.object({ forwardingEmail: z.string() }).strict(),
    deleteForwardingAddress,
  ),

  cfg('google_list_send_as', 'List send-as aliases', 'Listing send-as', emptySchema, listSendAs),
  cfg('google_create_send_as', 'Create send-as alias', 'Creating send-as', updatePayload, createSendAs),
  cfg('google_get_send_as', 'Get send-as alias', 'Getting send-as', sendAsEmailSchema, getSendAs),
  cfg(
    'google_update_send_as',
    'Update send-as alias',
    'Updating send-as',
    sendAsEmailSchema.merge(updatePayload).strict(),
    updateSendAs,
  ),
  cfg(
    'google_patch_send_as',
    'Patch send-as alias',
    'Patching send-as',
    sendAsEmailSchema.merge(updatePayload).strict(),
    patchSendAs,
  ),
  cfg('google_verify_send_as', 'Verify send-as alias', 'Verifying send-as', sendAsEmailSchema, verifySendAs),
  cfg('google_delete_send_as', 'Delete send-as alias', 'Deleting send-as', sendAsEmailSchema, deleteSendAs),

  cfg('google_list_smime_info', 'List S/MIME info', 'Listing S/MIME', sendAsEmailSchema, listSmimeInfo),
  cfg(
    'google_get_smime_info',
    'Get S/MIME info',
    'Getting S/MIME',
    sendAsEmailSchema.extend(idSchema.shape).strict(),
    getSmimeInfo,
  ),
  cfg(
    'google_delete_smime_info',
    'Delete S/MIME info',
    'Deleting S/MIME',
    sendAsEmailSchema.extend(idSchema.shape).strict(),
    deleteSmimeInfo,
  ),
  cfg(
    'google_set_default_smime_info',
    'Set default S/MIME',
    'Setting default S/MIME',
    sendAsEmailSchema.merge(idSchema).strict(),
    setDefaultSmimeInfo,
  ),
]
