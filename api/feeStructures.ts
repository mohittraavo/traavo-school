import { apiJson } from './client';
import { normalizeFeeStructure, type FeeStructure, type FeeStructureInput } from '../components/feeStructureModel';

function queryString(filters?: Record<string, string>) {
  const params = new URLSearchParams();
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value.trim()) params.set(key, value.trim());
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function listFeeStructures(filters?: Record<string, string>) {
  const data = await apiJson<FeeStructure[]>(`/api/fee-structures${queryString(filters)}`);
  return Array.isArray(data) ? data.map((item) => normalizeFeeStructure(item)) : [];
}

export async function createFeeStructure(body: FeeStructureInput) {
  const data = await apiJson<FeeStructure>('/api/fee-structures', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return normalizeFeeStructure(data);
}

export async function updateFeeStructure(id: string, body: FeeStructureInput) {
  const data = await apiJson<FeeStructure>(`/api/fee-structures/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return normalizeFeeStructure(data);
}

export async function deleteFeeStructure(id: string) {
  await apiJson<void>(`/api/fee-structures/${id}`, { method: 'DELETE' });
}
