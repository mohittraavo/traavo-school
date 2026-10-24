import { apiJson } from './client';

export type InvoiceStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export type FeeInvoice = {
  id: string;
  invoiceNo: string;
  studentId: number;
  studentName: string;
  classGrade: string;
  gradeLabel: string;
  admissionNo: string;
  enrollmentId: string;
  feeStructureId: string;
  feeStructureName: string;
  effectiveDate: string;
  feePeriod: string;
  dueDate: string;
  baseAmount: number;
  concession: number;
  lateFine: number;
  totalBill: number;
  amountPaid: number;
  lastSettlementAmount: number;
  receiptNo: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNo: string;
  remarks: string;
  status: InvoiceStatus;
  createdDate: string;
};

export type FeeInvoicePreview = {
  studentId: number;
  studentName: string;
  classGrade: string;
  gradeLabel: string;
  admissionNo: string;
  enrollmentId: string;
  feeStructureId: string;
  feeStructureName: string;
  effectiveDate: string;
  baseAmount: number;
  concession: number;
  lateFine: number;
  suggestedDueDate: string;
};

export const BILLING_PERIODS = ['Annual', 'Q1 (Apr - Jun)', 'Q2 (Jul - Sep)', 'Q3 (Oct - Dec)', 'Q4 (Jan - Mar)'];
export const PAYMENT_METHODS = ['Cash', 'UPI (Google Pay / PhonePe / Paytm)', 'Card', 'Net Banking', 'Cheque', 'Bank Transfer'];

function money(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalize(raw: FeeInvoice): FeeInvoice {
  return {
    ...raw,
    baseAmount: money(raw.baseAmount),
    concession: money(raw.concession),
    lateFine: money(raw.lateFine),
    totalBill: money(raw.totalBill),
    amountPaid: money(raw.amountPaid),
    lastSettlementAmount: money(raw.lastSettlementAmount),
    receiptNo: raw.receiptNo || '',
    paymentDate: raw.paymentDate || '',
    paymentMethod: raw.paymentMethod || '',
    referenceNo: raw.referenceNo || '',
    remarks: raw.remarks || '',
  };
}

export async function listFeeInvoices(filters?: { q?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.q?.trim()) params.set('q', filters.q.trim());
  if (filters?.status && filters.status !== 'ALL') params.set('status', filters.status);
  const qs = params.toString();
  const data = await apiJson<FeeInvoice[]>(`/api/fee-invoices${qs ? `?${qs}` : ''}`);
  return Array.isArray(data) ? data.map(normalize) : [];
}

export async function previewFeeInvoice(studentId: number) {
  const data = await apiJson<FeeInvoicePreview>(`/api/fee-invoices/preview?studentId=${studentId}`);
  return {
    ...data,
    baseAmount: money(data.baseAmount),
    concession: money(data.concession),
    lateFine: money(data.lateFine),
  };
}

export async function issueFeeInvoice(body: {
  studentId: number;
  feePeriod: string;
  baseAmount: number;
  concession: number;
  lateFine: number;
  dueDate: string;
}) {
  const data = await apiJson<FeeInvoice>('/api/fee-invoices', { method: 'POST', body: JSON.stringify(body) });
  return normalize(data);
}

export async function recordFeePayment(id: string, body: {
  amount: number;
  receiptNo: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNo: string;
  remarks: string;
}) {
  const data = await apiJson<FeeInvoice>(`/api/fee-invoices/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return normalize(data);
}
