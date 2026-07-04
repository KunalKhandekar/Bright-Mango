import { api, unwrap } from '@/lib/axios'
import type { Campaign } from '@/types/models'

export function createCampaign(input: { subject: string; body: string }) {
  return unwrap<{ campaign: Campaign }>(api.post('/campaigns', input))
}

export function listCampaigns(params: { page?: number; limit?: number } = {}) {
  return unwrap<{ campaigns: Campaign[] }>(api.get('/campaigns', { params }))
}

export function getCampaign(id: string) {
  return unwrap<{ campaign: Campaign }>(api.get(`/campaigns/${id}`))
}
