export type FeeStatus = 'Draft' | 'Active' | 'Inactive';
export type ClassStatus = 'Draft' | 'Active';
export type ComponentType = 'Required' | 'Optional';
export type ClassBand = 'primary' | 'middle' | 'secondary';

export type FeeLine = {
  id: string;
  feeHead: string;
  amount: number;
  frequency: string;
  dueDate: string;
  discountEligible: boolean;
  lateFine: boolean;
  type: ComponentType;
};

export type ClassFeeSchedule = {
  className: string;
  sectionsScope: string;
  components: FeeLine[];
  concession: number;
  lateFineAmount: number;
  status: ClassStatus;
};

export type FeeStructure = {
  id: string;
  name: string;
  academicYear: string;
  campus: string;
  effectiveFrom: string;
  effectiveTo: string;
  status: FeeStatus;
  defaultConcession: number;
  defaultLateFine: number;
  templateComponents: FeeLine[];
  classSchedules: ClassFeeSchedule[];
  createdDate: string;
  updatedDate: string;
};

export type FeeStructureInput = Omit<FeeStructure, 'id' | 'createdDate' | 'updatedDate'>;

export const ACADEMIC_YEARS = ['2024-2025', '2025-2026', '2026-2027', '2027-2028'];
export const CAMPUSES = ['Main Campus (Vasant Kunj)', 'East Campus', 'South Campus'];
export const FREQUENCIES = ['Monthly', 'Quarterly', 'Half Yearly', 'Annual (1x Full Year)', 'Term', 'One Time'];
export const COMPONENT_TYPES: ComponentType[] = ['Required', 'Optional'];
export const STRUCTURE_STATUSES: { value: FeeStatus; label: string }[] = [
  { value: 'Draft', label: 'Draft' },
  { value: 'Active', label: 'Active (Ready for billing / invoices)' },
  { value: 'Inactive', label: 'Inactive' },
];
export const FEE_HEADS = [
  'Tuition Fees',
  'Admission Fees',
  'Annual Charges',
  'Computer & Science Lab Fee',
  'Library & Digital Subscriptions',
  'Annual Sports & Activity Levy',
  'Transportation',
  'Examination Fee',
];

export const CLASSES: { name: string; band: ClassBand | 'pre' }[] = [
  { name: 'Nursery', band: 'pre' },
  { name: 'LKG', band: 'pre' },
  { name: 'UKG', band: 'pre' },
  { name: 'Class 1', band: 'primary' },
  { name: 'Class 2', band: 'primary' },
  { name: 'Class 3', band: 'primary' },
  { name: 'Class 4', band: 'primary' },
  { name: 'Class 5', band: 'primary' },
  { name: 'Class 6', band: 'middle' },
  { name: 'Class 7', band: 'middle' },
  { name: 'Class 8', band: 'middle' },
  { name: 'Class 9', band: 'secondary' },
  { name: 'Class 10', band: 'secondary' },
  { name: 'Class 11', band: 'secondary' },
  { name: 'Class 12', band: 'secondary' },
];

export const BANDS: { id: ClassBand; label: string }[] = [
  { id: 'primary', label: 'Primary (1-5)' },
  { id: 'middle', label: 'Middle (6-8)' },
  { id: 'secondary', label: 'Secondary (9-12)' },
];

export function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function money(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(String(value ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100) / 100;
}

export function inr(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(money(value));
}

export function baseFee(components: { amount: number }[]) {
  return money(components.reduce((sum, item) => sum + money(item.amount), 0));
}

export function finalNet(schedule: { components: { amount: number }[]; concession: number; lateFineAmount: number }) {
  return money(baseFee(schedule.components) - money(schedule.concession) + money(schedule.lateFineAmount));
}

export function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function asLine(raw: Partial<FeeLine> | null | undefined): FeeLine {
  const type = raw?.type === 'Optional' ? 'Optional' : 'Required';
  return {
    id: String(raw?.id || makeId('line')),
    feeHead: String(raw?.feeHead || ''),
    amount: money(raw?.amount),
    frequency: String(raw?.frequency || 'Annual (1x Full Year)'),
    dueDate: String(raw?.dueDate || ''),
    discountEligible: Boolean(raw?.discountEligible),
    lateFine: Boolean(raw?.lateFine),
    type,
  };
}

function asSchedule(raw: Partial<ClassFeeSchedule> | null | undefined): ClassFeeSchedule {
  return {
    className: String(raw?.className || ''),
    sectionsScope: String(raw?.sectionsScope || 'Entire Class (All)'),
    components: Array.isArray(raw?.components) ? raw.components.map(asLine) : [],
    concession: money(raw?.concession),
    lateFineAmount: money(raw?.lateFineAmount),
    status: raw?.status === 'Active' ? 'Active' : 'Draft',
  };
}

export function normalizeFeeStructure(raw: Partial<FeeStructure> | null | undefined): FeeStructure {
  const status: FeeStatus = raw?.status === 'Active' || raw?.status === 'Inactive' ? raw.status : 'Draft';
  return {
    id: String(raw?.id || ''),
    name: String(raw?.name || ''),
    academicYear: String(raw?.academicYear || ''),
    campus: String(raw?.campus || ''),
    effectiveFrom: String(raw?.effectiveFrom || ''),
    effectiveTo: String(raw?.effectiveTo || ''),
    status,
    defaultConcession: money(raw?.defaultConcession),
    defaultLateFine: money(raw?.defaultLateFine),
    templateComponents: Array.isArray(raw?.templateComponents) ? raw.templateComponents.map(asLine) : [],
    classSchedules: Array.isArray(raw?.classSchedules) ? raw.classSchedules.map(asSchedule) : [],
    createdDate: String(raw?.createdDate || ''),
    updatedDate: String(raw?.updatedDate || ''),
  };
}

export function emptyLine(feeHead = ''): FeeLine {
  return {
    id: makeId('line'),
    feeHead,
    amount: 0,
    frequency: 'Annual (1x Full Year)',
    dueDate: '',
    discountEligible: false,
    lateFine: false,
    type: 'Required',
  };
}

export function cloneLines(lines: FeeLine[]): FeeLine[] {
  return lines.map((line) => ({ ...line, id: makeId('line') }));
}
