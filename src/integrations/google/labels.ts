import type { ToolConfig } from '@/types'
import ky from 'ky'
import { z } from 'zod'
import { ensureValidGoogleToken, getGoogleCredentials } from './utils'

const base = 'https://www.googleapis.com/gmail/v1/users/me/labels'

// ----------------- Schemas -----------------
export const listLabelsSchema = z.object({}).strict()

export const getLabelSchema = z.object({ id: z.string().describe('ID of the label') }).strict()

export const createLabelSchema = z
  .object({
    name: z.string().describe('Label display name'),
    labelListVisibility: z.enum(['labelShow', 'labelShowIfUnread', 'labelHide']),
    messageListVisibility: z.enum(['show', 'hide']),
    color: z
      .object({
        textColor: z.string(),
        backgroundColor: z.string(),
      })
      .strict(),
  })
  .strict()

export const updateLabelSchema = createLabelSchema.extend({ id: z.string().describe('ID of the label') }).strict()
export const patchLabelSchema = updateLabelSchema
export const deleteLabelSchema = z.object({ id: z.string().describe('ID of the label to delete') }).strict()

// ----------------- Types -----------------
export type ListLabelsParams = z.infer<typeof listLabelsSchema>
export type GetLabelParams = z.infer<typeof getLabelSchema>
export type CreateLabelParams = z.infer<typeof createLabelSchema>
export type UpdateLabelParams = z.infer<typeof updateLabelSchema>
export type PatchLabelParams = z.infer<typeof patchLabelSchema>
export type DeleteLabelParams = z.infer<typeof deleteLabelSchema>

// ----------------- API wrappers -----------------
const apiCall = async <T>(method: 'get' | 'post' | 'put' | 'patch' | 'delete', url: string, body?: any): Promise<T> => {
  const credentials = await getGoogleCredentials()
  const accessToken = await ensureValidGoogleToken(credentials)
  return await ky[method](url, {
    json: body,
    headers: { Authorization: `Bearer ${accessToken}` },
  }).json<T>()
}

export const listLabels = async (_: ListLabelsParams) => apiCall('get', base)
export const getLabel = async (p: GetLabelParams) => apiCall('get', `${base}/${p.id}`)
export const createLabel = async (p: CreateLabelParams) => apiCall('post', base, p)
export const updateLabel = async (p: UpdateLabelParams) => {
  const { id, ...rest } = p
  return apiCall('put', `${base}/${id}`, rest)
}
export const patchLabel = async (p: PatchLabelParams) => {
  const { id, ...rest } = p
  return apiCall('patch', `${base}/${id}`, rest)
}
export const deleteLabel = async (p: DeleteLabelParams) => apiCall('delete', `${base}/${p.id}`)

// ----------------- Configs -----------------
export const labelToolConfigs: ToolConfig[] = [
  {
    name: 'google_list_labels',
    description: 'List all Gmail labels',
    verb: 'Listing Gmail labels',
    parameters: listLabelsSchema,
    execute: listLabels,
  },
  {
    name: 'google_get_label',
    description: 'Get a Gmail label by ID',
    verb: 'Getting Gmail label',
    parameters: getLabelSchema,
    execute: getLabel,
  },
  {
    name: 'google_create_label',
    description: 'Create a Gmail label',
    verb: 'Creating Gmail label',
    parameters: createLabelSchema,
    execute: createLabel,
  },
  {
    name: 'google_update_label',
    description: 'Update (replace) a Gmail label',
    verb: 'Updating Gmail label',
    parameters: updateLabelSchema,
    execute: updateLabel,
  },
  {
    name: 'google_patch_label',
    description: 'Patch (partial update) a Gmail label',
    verb: 'Patching Gmail label',
    parameters: patchLabelSchema,
    execute: patchLabel,
  },
  {
    name: 'google_delete_label',
    description: 'Delete a Gmail label',
    verb: 'Deleting Gmail label',
    parameters: deleteLabelSchema,
    execute: deleteLabel,
  },
]
