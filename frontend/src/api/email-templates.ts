import { api, unwrap } from '@/lib/axios'
import type { EmailProcess, EmailTemplate } from '@/types/models'

export function listTemplates(params: { page?: number; limit?: number } = {}) {
  return unwrap<{ templates: EmailTemplate[] }>(api.get('/email-templates', { params }))
}

export function getTemplate(id: string) {
  return unwrap<{ template: EmailTemplate }>(api.get(`/email-templates/${id}`))
}

export function createTemplate(input: { name: string; subject: string; body: string }) {
  return unwrap<{ template: EmailTemplate }>(api.post('/email-templates', input))
}

export function updateTemplate(
  id: string,
  input: Partial<{ name: string; subject: string; body: string }>,
) {
  return unwrap<{ template: EmailTemplate }>(api.patch(`/email-templates/${id}`, input))
}

export function deleteTemplate(id: string) {
  return unwrap<Record<string, never>>(api.delete(`/email-templates/${id}`))
}

export function listProcesses() {
  return unwrap<{ processes: EmailProcess[] }>(api.get('/email-templates/processes'))
}

export function assignProcess(processKey: string, templateId: string | null) {
  return unwrap<Record<string, never>>(
    api.put(`/email-templates/processes/${processKey}`, { templateId }),
  )
}
