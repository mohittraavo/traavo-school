import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createFeeStructure, deleteFeeStructure, listFeeStructures, updateFeeStructure } from '../api/feeStructures';
import { listFeeInvoices } from '../api/feeInvoices';
import { useTheme } from '../theme/ThemeContext';
import { DataTable } from './ui/DataTable';
import { DateField } from './ui/DateField';
import FeeInvoicesPanel, { type FeeInvoicesHandle } from './FeeInvoicesPanel';
import type { ThemeColors } from '../theme/tokens';
import {
  ACADEMIC_YEARS,
  BANDS,
  CAMPUSES,
  CLASSES,
  COMPONENT_TYPES,
  FEE_HEADS,
  FREQUENCIES,
  STRUCTURE_STATUSES,
  baseFee,
  emptyLine,
  finalNet,
  inr,
  isIsoDate,
  makeId,
  money,
  type ClassBand,
  type ClassFeeSchedule,
  type ClassStatus,
  type ComponentType,
  type FeeLine,
  type FeeStatus,
  type FeeStructure,
  type FeeStructureInput,
} from './feeStructureModel';

type LineForm = {
  id: string;
  feeHead: string;
  amount: string;
  frequency: string;
  dueDate: string;
  discountEligible: boolean;
  lateFine: boolean;
  type: ComponentType;
};

type ClassForm = {
  className: string;
  sectionsScope: string;
  components: LineForm[];
  concession: string;
  lateFineAmount: string;
  status: ClassStatus;
};

type FormState = {
  name: string;
  academicYear: string;
  campus: string;
  effectiveFrom: string;
  effectiveTo: string;
  status: FeeStatus;
  templateComponents: LineForm[];
  defaultConcession: string;
  defaultLateFine: string;
  selectedClasses: string[];
  schedules: Record<string, ClassForm>;
  extraHeads: string[];
};

function lineToForm(line: FeeLine): LineForm {
  return {
    id: line.id || makeId('line'),
    feeHead: line.feeHead,
    amount: line.amount ? String(line.amount) : '',
    frequency: line.frequency || 'Annual (1x Full Year)',
    dueDate: line.dueDate || '',
    discountEligible: line.discountEligible,
    lateFine: line.lateFine,
    type: line.type === 'Optional' ? 'Optional' : 'Required',
  };
}

function formToLine(line: LineForm): FeeLine {
  return {
    id: line.id,
    feeHead: line.feeHead.trim(),
    amount: money(line.amount),
    frequency: line.frequency,
    dueDate: line.dueDate.trim(),
    discountEligible: line.discountEligible,
    lateFine: line.lateFine,
    type: line.type,
  };
}

function blankLine(feeHead = ''): LineForm {
  return lineToForm(emptyLine(feeHead));
}

function orderClasses(names: string[]) {
  return CLASSES.map((item) => item.name).filter((name) => names.includes(name));
}

function emptyForm(): FormState {
  return {
    name: '',
    academicYear: '2026-2027',
    campus: CAMPUSES[0],
    effectiveFrom: '2026-04-01',
    effectiveTo: '2027-03-31',
    status: 'Active',
    templateComponents: [blankLine('Tuition Fees')],
    defaultConcession: '0',
    defaultLateFine: '0',
    selectedClasses: [],
    schedules: {},
    extraHeads: [],
  };
}

function scheduleFromTemplate(className: string, form: FormState): ClassForm {
  return {
    className,
    sectionsScope: 'Entire Class (All)',
    components: form.templateComponents.map((line) => ({ ...line, id: makeId('line') })),
    concession: form.defaultConcession,
    lateFineAmount: form.defaultLateFine,
    status: form.status === 'Active' ? 'Active' : 'Draft',
  };
}

function structureToForm(structure: FeeStructure, asCopy = false): FormState {
  const schedules: Record<string, ClassForm> = {};
  structure.classSchedules.forEach((schedule) => {
    schedules[schedule.className] = {
      className: schedule.className,
      sectionsScope: schedule.sectionsScope || 'Entire Class (All)',
      components: schedule.components.map(lineToForm),
      concession: String(schedule.concession ?? 0),
      lateFineAmount: String(schedule.lateFineAmount ?? 0),
      status: schedule.status === 'Active' ? 'Active' : 'Draft',
    };
  });
  const usedHeads = [
    ...structure.templateComponents.map((line) => line.feeHead),
    ...structure.classSchedules.flatMap((schedule) => schedule.components.map((line) => line.feeHead)),
  ].filter((head) => head && !FEE_HEADS.includes(head));
  return {
    name: asCopy ? `${structure.name} Copy`.slice(0, 120) : structure.name,
    academicYear: structure.academicYear || '2026-2027',
    campus: structure.campus || CAMPUSES[0],
    effectiveFrom: structure.effectiveFrom || '',
    effectiveTo: structure.effectiveTo || '',
    status: asCopy ? 'Draft' : structure.status,
    templateComponents: (structure.templateComponents.length ? structure.templateComponents : [emptyLine('Tuition Fees')]).map(lineToForm),
    defaultConcession: String(structure.defaultConcession ?? 0),
    defaultLateFine: String(structure.defaultLateFine ?? 0),
    selectedClasses: orderClasses(structure.classSchedules.map((schedule) => schedule.className)),
    schedules,
    extraHeads: Array.from(new Set(usedHeads)),
  };
}

function formToInput(form: FormState, status: FeeStatus): FeeStructureInput {
  const classSchedules: ClassFeeSchedule[] = form.selectedClasses.map((className) => {
    const schedule = form.schedules[className];
    return {
      className,
      sectionsScope: schedule?.sectionsScope.trim() || 'Entire Class (All)',
      components: (schedule?.components || []).map(formToLine),
      concession: money(schedule?.concession),
      lateFineAmount: money(schedule?.lateFineAmount),
      status: schedule?.status === 'Active' ? 'Active' : 'Draft',
    };
  });
  return {
    name: form.name.trim(),
    academicYear: form.academicYear,
    campus: form.campus,
    effectiveFrom: form.effectiveFrom.trim(),
    effectiveTo: form.effectiveTo.trim(),
    status,
    defaultConcession: money(form.defaultConcession),
    defaultLateFine: money(form.defaultLateFine),
    templateComponents: form.templateComponents.map(formToLine),
    classSchedules,
  };
}

function validateLines(lines: FeeLine[], prefix: string, strict: boolean, errors: Record<string, string>) {
  const seen = new Set<string>();
  lines.forEach((line, index) => {
    const key = `${prefix}.${index}`;
    if (line.feeHead.trim().length < 2) errors[`${key}.feeHead`] = 'Fee head is required.';
    else if (seen.has(line.feeHead.trim().toLowerCase())) errors[`${key}.feeHead`] = 'Duplicate fee heads are not allowed.';
    else seen.add(line.feeHead.trim().toLowerCase());
    if (!FREQUENCIES.includes(line.frequency)) errors[`${key}.frequency`] = 'Choose a frequency.';
    if (strict && line.amount <= 0) errors[`${key}.amount`] = 'Amount must be greater than 0.';
    if (line.amount < 0) errors[`${key}.amount`] = 'Amount cannot be negative.';
    if (line.dueDate && !isIsoDate(line.dueDate)) errors[`${key}.dueDate`] = 'Use YYYY-MM-DD.';
    if (strict && !line.dueDate) errors[`${key}.dueDate`] = 'Due date is required.';
  });
}

function validateInput(input: FeeStructureInput, strict: boolean) {
  const errors: Record<string, string> = {};
  if (input.name.length < 3) errors.name = 'Fee structure name must be at least 3 characters.';
  if (input.name.length > 120) errors.name = 'Fee structure name is too long.';
  if (!/^\d{4}-\d{4}$/.test(input.academicYear)) errors.academicYear = 'Academic year is required.';
  else if (Number(input.academicYear.slice(5)) !== Number(input.academicYear.slice(0, 4)) + 1) errors.academicYear = 'Academic year must be consecutive, like 2026-2027.';
  if (!CAMPUSES.includes(input.campus)) errors.campus = 'Campus is required.';
  if (input.effectiveFrom && !isIsoDate(input.effectiveFrom)) errors.effectiveFrom = 'Use YYYY-MM-DD.';
  if (input.effectiveTo && !isIsoDate(input.effectiveTo)) errors.effectiveTo = 'Use YYYY-MM-DD.';
  if (input.effectiveFrom && input.effectiveTo && input.effectiveFrom > input.effectiveTo) errors.effectiveTo = 'Effective to cannot be before effective from.';
  if (input.defaultConcession < 0) errors.defaultConcession = 'Concession cannot be negative.';
  if (input.defaultLateFine < 0) errors.defaultLateFine = 'Late fine cannot be negative.';
  if (strict && input.templateComponents.length === 0) errors.template = 'Add at least one fee component.';
  if (strict && input.classSchedules.length === 0) errors.classes = 'Select at least one class.';
  validateLines(input.templateComponents, 'template', strict, errors);
  input.classSchedules.forEach((schedule) => {
    const prefix = `class.${schedule.className}`;
    if (strict && schedule.components.length === 0) errors[prefix] = `${schedule.className} needs at least one component.`;
    validateLines(schedule.components, prefix, strict, errors);
    if (schedule.concession > baseFee(schedule.components)) errors[`${prefix}.concession`] = `Concession cannot exceed the base fee for ${schedule.className}.`;
  });
  return errors;
}

function classBase(schedule: ClassForm) {
  return baseFee(schedule.components.map((line) => ({ amount: money(line.amount) })));
}

function classNet(schedule: ClassForm) {
  return finalNet({
    components: schedule.components.map((line) => ({ amount: money(line.amount) })),
    concession: money(schedule.concession),
    lateFineAmount: money(schedule.lateFineAmount),
  });
}

function headsOf(structure: FeeStructure) {
  const fromTemplate = structure.templateComponents.map((line) => line.feeHead.trim()).filter(Boolean);
  if (fromTemplate.length) return fromTemplate;
  return Array.from(new Set(structure.classSchedules.flatMap((schedule) => schedule.components.map((line) => line.feeHead.trim()).filter(Boolean))));
}

function netsOf(structure: FeeStructure) {
  const nets = structure.classSchedules.map((schedule) => finalNet(schedule));
  return nets.length ? nets : [0];
}

function yearLabel(year: string) {
  return year.replace('-', ' – ');
}

function previewList(items: string[], limit: number) {
  const visible = items.slice(0, limit);
  const extra = items.length - visible.length;
  return { visible, extra };
}

async function confirmAction(message: string) {
  if (Platform.OS === 'web') return window.confirm(message);
  return new Promise<boolean>((resolve) => {
    Alert.alert(message, '', [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'OK', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export default function FeeStructureManager() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [contentWidth, setContentWidth] = useState(0);
  const measured = contentWidth || width;
  const compact = measured < 1100;
  const styles = useMemo(() => makeStyles(colors, compact), [colors, compact]);
  const pageContent = [styles.pageContent, compact ? { padding: 12 } : null];
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [ledgerTab, setLedgerTab] = useState<'configuration' | 'heads' | 'invoices'>('configuration');
  const [invoiceCount, setInvoiceCount] = useState(0);
  const invoicesRef = useRef<FeeInvoicesHandle>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [classQuery, setClassQuery] = useState('');
  const [checked, setChecked] = useState<string[]>([]);
  const [matrixMode, setMatrixMode] = useState<'summary' | 'comparison'>('summary');
  const [editingClass, setEditingClass] = useState<string | null>(null);
  const [showNewHead, setShowNewHead] = useState(false);
  const [headDraft, setHeadDraft] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setStructures(await listFeeStructures());
    } catch (exception) {
      setStructures([]);
      setError(exception instanceof Error ? exception.message : 'Could not load fee structures.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    listFeeInvoices()
      .then((invoices) => {
        if (active) setInvoiceCount(invoices.length);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    listFeeStructures()
      .then((rows) => {
        if (!active) return;
        setStructures(rows);
        setError('');
      })
      .catch((exception: unknown) => {
        if (!active) return;
        setStructures([]);
        setError(exception instanceof Error ? exception.message : 'Could not load fee structures.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const headOptions = useMemo(() => {
    const heads = new Set<string>([...FEE_HEADS, ...form.extraHeads]);
    form.templateComponents.forEach((line) => { if (line.feeHead) heads.add(line.feeHead); });
    Object.values(form.schedules).forEach((schedule) => schedule.components.forEach((line) => { if (line.feeHead) heads.add(line.feeHead); }));
    return Array.from(heads);
  }, [form.extraHeads, form.templateComponents, form.schedules]);

  const visibleClasses = CLASSES.filter((item) => item.name.toLowerCase().includes(classQuery.trim().toLowerCase()));
  const matrixRows = form.selectedClasses.map((name) => form.schedules[name]).filter((row): row is ClassForm => Boolean(row));
  const nets = matrixRows.map(classNet);
  const averageNet = nets.length ? money(nets.reduce((sum, value) => sum + value, 0) / nets.length) : 0;
  const totalConcession = money(matrixRows.reduce((sum, row) => sum + money(row.concession), 0));
  const minNet = nets.length ? Math.min(...nets) : 0;
  const maxNet = nets.length ? Math.max(...nets) : 0;
  const templateTotal = money(form.templateComponents.reduce((sum, line) => sum + money(line.amount), 0));
  const comparisonHeads = Array.from(new Set([
    ...form.templateComponents.map((line) => line.feeHead).filter(Boolean),
    ...matrixRows.flatMap((row) => row.components.map((line) => line.feeHead).filter(Boolean)),
  ]));

  const patchForm = (patch: Partial<FormState>) => {
    setForm((current) => ({ ...current, ...patch }));
    setNotice('');
  };

  const removeSchedule = (className: string) => {
    setForm((current) => {
      const schedules = { ...current.schedules };
      delete schedules[className];
      return { ...current, schedules, selectedClasses: current.selectedClasses.filter((name) => name !== className) };
    });
    setChecked((current) => current.filter((name) => name !== className));
    setEditingClass((current) => (current === className ? null : current));
  };

  const toggleClass = (className: string) => {
    setForm((current) => {
      if (current.selectedClasses.includes(className)) {
        const schedules = { ...current.schedules };
        delete schedules[className];
        return { ...current, selectedClasses: current.selectedClasses.filter((name) => name !== className), schedules };
      }
      return {
        ...current,
        selectedClasses: orderClasses([...current.selectedClasses, className]),
        schedules: { ...current.schedules, [className]: scheduleFromTemplate(className, current) },
      };
    });
    setChecked((current) => current.filter((name) => name !== className));
    setFieldErrors((current) => ({ ...current, classes: '' }));
  };

  const toggleBand = (band: ClassBand) => {
    const names = CLASSES.filter((item) => item.band === band).map((item) => item.name);
    const allOn = names.every((name) => form.selectedClasses.includes(name));
    setForm((current) => {
      if (allOn) {
        const schedules = { ...current.schedules };
        names.forEach((name) => delete schedules[name]);
        return { ...current, selectedClasses: current.selectedClasses.filter((name) => !names.includes(name)), schedules };
      }
      const schedules = { ...current.schedules };
      names.forEach((name) => {
        if (!schedules[name]) schedules[name] = scheduleFromTemplate(name, current);
      });
      return { ...current, selectedClasses: orderClasses([...current.selectedClasses, ...names]), schedules };
    });
  };

  const setAllClasses = (selected: boolean) => {
    setForm((current) => {
      if (!selected) return { ...current, selectedClasses: [], schedules: {} };
      const schedules = { ...current.schedules };
      CLASSES.forEach((item) => {
        if (!schedules[item.name]) schedules[item.name] = scheduleFromTemplate(item.name, current);
      });
      return { ...current, selectedClasses: CLASSES.map((item) => item.name), schedules };
    });
    if (!selected) setChecked([]);
  };

  const updateTemplateLine = (id: string, patch: Partial<LineForm>) => {
    setForm((current) => ({
      ...current,
      templateComponents: current.templateComponents.map((line) => line.id === id ? { ...line, ...patch } : line),
    }));
  };

  const updateClassLine = (className: string, id: string, patch: Partial<LineForm>) => {
    setForm((current) => {
      const schedule = current.schedules[className];
      if (!schedule) return current;
      return {
        ...current,
        schedules: {
          ...current.schedules,
          [className]: {
            ...schedule,
            components: schedule.components.map((line) => line.id === id ? { ...line, ...patch } : line),
          },
        },
      };
    });
  };

  const updateSchedule = (className: string, patch: Partial<ClassForm>) => {
    setForm((current) => {
      const schedule = current.schedules[className];
      if (!schedule) return current;
      return { ...current, schedules: { ...current.schedules, [className]: { ...schedule, ...patch } } };
    });
  };

  const applyTemplate = async () => {
    if (!form.selectedClasses.length) {
      setNotice('Select at least one class before applying the template.');
      return;
    }
    const ok = await confirmAction('Replace the selected class schedules with the common template?');
    if (!ok) return;
    setForm((current) => {
      const schedules = { ...current.schedules };
      current.selectedClasses.forEach((className) => {
        const existing = schedules[className];
        schedules[className] = {
          className,
          sectionsScope: existing?.sectionsScope || 'Entire Class (All)',
          components: current.templateComponents.map((line) => ({ ...line, id: makeId('line') })),
          concession: current.defaultConcession,
          lateFineAmount: current.defaultLateFine,
          status: current.status === 'Active' ? 'Active' : (existing?.status || 'Draft'),
        };
      });
      return { ...current, schedules };
    });
    setNotice('Template applied to the selected classes.');
  };

  const resetCheckedToTemplate = () => {
    const targets = checked.length ? checked : form.selectedClasses;
    if (!targets.length) {
      setNotice('Select classes in the matrix first.');
      return;
    }
    setForm((current) => {
      const schedules = { ...current.schedules };
      targets.forEach((className) => {
        const existing = schedules[className];
        if (!existing) return;
        schedules[className] = {
          ...existing,
          components: current.templateComponents.map((line) => ({ ...line, id: makeId('line') })),
          concession: current.defaultConcession,
          lateFineAmount: current.defaultLateFine,
        };
      });
      return { ...current, schedules };
    });
  };

  const copyChecked = () => {
    if (checked.length < 2) {
      setNotice('Tick a source class and at least one target. The first ticked class is copied onto the others.');
      return;
    }
    const [sourceName, ...targets] = checked;
    const source = form.schedules[sourceName];
    if (!source) return;
    setForm((current) => {
      const schedules = { ...current.schedules };
      targets.forEach((className) => {
        const existing = schedules[className];
        if (!existing) return;
        schedules[className] = {
          ...existing,
          sectionsScope: source.sectionsScope,
          components: source.components.map((line) => ({ ...line, id: makeId('line') })),
          concession: source.concession,
          lateFineAmount: source.lateFineAmount,
          status: source.status,
        };
      });
      return { ...current, schedules };
    });
    setNotice(`${sourceName} copied to ${targets.length} class${targets.length === 1 ? '' : 'es'}.`);
  };

  const removeChecked = () => {
    if (!checked.length) {
      setNotice('Tick the classes you want to remove.');
      return;
    }
    setForm((current) => {
      const schedules = { ...current.schedules };
      checked.forEach((name) => delete schedules[name]);
      return { ...current, selectedClasses: current.selectedClasses.filter((name) => !checked.includes(name)), schedules };
    });
    setChecked([]);
    setEditingClass((current) => (current && checked.includes(current) ? null : current));
  };

  const addHead = () => {
    const name = headDraft.trim();
    if (name.length < 2 || name.length > 80) {
      setNotice('Fee head name must be between 2 and 80 characters.');
      return;
    }
    if (headOptions.some((head) => head.toLowerCase() === name.toLowerCase())) {
      setNotice('That fee head already exists.');
      return;
    }
    setForm((current) => ({
      ...current,
      extraHeads: [...current.extraHeads, name],
      templateComponents: [...current.templateComponents, blankLine(name)],
    }));
    setHeadDraft('');
    setShowNewHead(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFieldErrors({});
    setChecked([]);
    setEditingClass(null);
    setNotice('');
    setClassQuery('');
    setView('editor');
  };

  const openEdit = (structure: FeeStructure, asCopy = false) => {
    setEditingId(asCopy ? null : structure.id);
    setForm(structureToForm(structure, asCopy));
    setFieldErrors({});
    setChecked([]);
    setEditingClass(null);
    setNotice(asCopy ? 'Copy is ready. Save it to create a new structure.' : '');
    setView('editor');
  };

  const save = async (mode: 'draft' | 'publish') => {
    const status: FeeStatus = mode === 'draft' ? 'Draft' : (form.status === 'Draft' ? 'Active' : form.status);
    const payload = formToInput(form, status);
    const errors = validateInput(payload, status !== 'Draft');
    setFieldErrors(errors);
    const first = Object.values(errors).find(Boolean);
    if (first) {
      setNotice(first);
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      if (editingId) await updateFeeStructure(editingId, payload);
      else await createFeeStructure(payload);
      setView('list');
      setEditingId(null);
      setLedgerTab('configuration');
      await load();
      setNotice(mode === 'draft' ? 'Draft saved.' : 'Fee configuration saved.');
    } catch (exception) {
      setNotice(exception instanceof Error ? exception.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (structure: FeeStructure) => {
    const next = structure.status === 'Active' ? 'Inactive' : 'Active';
    const ok = await confirmAction(next === 'Inactive' ? `Mark ${structure.name} inactive?` : `Activate ${structure.name}?`);
    if (!ok) return;
    try {
      await updateFeeStructure(structure.id, {
        name: structure.name,
        academicYear: structure.academicYear,
        campus: structure.campus,
        effectiveFrom: structure.effectiveFrom,
        effectiveTo: structure.effectiveTo,
        status: next,
        defaultConcession: structure.defaultConcession,
        defaultLateFine: structure.defaultLateFine,
        templateComponents: structure.templateComponents,
        classSchedules: structure.classSchedules,
      });
      await load();
      setNotice(next === 'Active' ? 'Fee structure activated.' : 'Fee structure marked inactive.');
    } catch (exception) {
      setNotice(exception instanceof Error ? exception.message : 'Could not update status.');
    }
  };

  const exportLedger = (rows: FeeStructure[]) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      Alert.alert('Export', 'Ledger export is available in the browser.');
      return;
    }
    const header = ['Fee structure', 'Academic year', 'Campus', 'Classes', 'Components', 'Min rate', 'Max rate', 'Status'];
    const body = rows.map((structure) => {
      const nets = netsOf(structure);
      const classes = structure.classSchedules.map((schedule) => schedule.className).join('; ');
      return [structure.name, structure.academicYear, structure.campus, classes, String(headsOf(structure).length), String(Math.min(...nets)), String(Math.max(...nets)), structure.status];
    });
    const csv = [header, ...body].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = 'fee-ledger.csv';
    link.click();
    URL.revokeObjectURL(href);
  };

  const removeStructure = async (structure: FeeStructure) => {
    const ok = await confirmAction(`Delete ${structure.name}?`);
    if (!ok) return;
    try {
      await deleteFeeStructure(structure.id);
      await load();
      setNotice('Fee structure deleted.');
    } catch (exception) {
      setNotice(exception instanceof Error ? exception.message : 'Delete failed.');
    }
  };

  const renderMenu = (id: string, value: string, options: string[], onChange: (value: string) => void) => (
    <View style={{ zIndex: openMenu === id ? 5 : 1 }}>
      <Pressable style={styles.input} onPress={() => setOpenMenu(openMenu === id ? null : id)}>
        <Text numberOfLines={1} style={[styles.inputText, !value && { color: colors.textMuted }]}>{value || 'Select'}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
      </Pressable>
      {openMenu === id ? (
        <View style={styles.menu}>
          {options.map((option) => (
            <Pressable key={option} style={styles.menuItem} onPress={() => { onChange(option); setOpenMenu(null); }}>
              <Text style={[styles.menuText, option === value && { color: colors.brand, fontWeight: '700' }]}>{option}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );

  const renderLineRow = (line: LineForm, onChange: (patch: Partial<LineForm>) => void, onRemove: () => void, errorPrefix: string) => (
    <View key={line.id} style={styles.lineRow}>
      <View style={styles.grow}>
        {compact ? <Text style={styles.label}>Fee head component *</Text> : null}
        {renderMenu(`${errorPrefix}-head`, line.feeHead, headOptions, (feeHead) => onChange({ feeHead }))}
        {fieldErrors[`${errorPrefix}.feeHead`] ? <Text style={styles.errorText}>{fieldErrors[`${errorPrefix}.feeHead`]}</Text> : null}
      </View>
      <View style={styles.amountCol}>
        {compact ? <Text style={styles.label}>Amount (₹)</Text> : null}
        <TextInput value={line.amount} onChangeText={(amount) => onChange({ amount })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted} style={styles.input} />
        {fieldErrors[`${errorPrefix}.amount`] ? <Text style={styles.errorText}>{fieldErrors[`${errorPrefix}.amount`]}</Text> : null}
      </View>
      <View style={styles.freqCol}>
        {compact ? <Text style={styles.label}>Frequency *</Text> : null}
        {renderMenu(`${errorPrefix}-freq`, line.frequency, [...FREQUENCIES], (frequency) => onChange({ frequency }))}
      </View>
      <View style={styles.dateCol}>
        {compact ? <Text style={styles.label}>Due date</Text> : null}
        <DateField value={line.dueDate} onChange={(dueDate) => onChange({ dueDate })} />
        {fieldErrors[`${errorPrefix}.dueDate`] ? <Text style={styles.errorText}>{fieldErrors[`${errorPrefix}.dueDate`]}</Text> : null}
      </View>
      {compact ? (
        <View style={styles.checkPair}>
          <Pressable style={styles.checkItem} onPress={() => onChange({ discountEligible: !line.discountEligible })}>
            <Ionicons name={line.discountEligible ? 'checkbox' : 'square-outline'} size={18} color={line.discountEligible ? colors.brand : colors.textMuted} />
            <Text style={styles.hint}>Discount</Text>
          </Pressable>
          <Pressable style={styles.checkItem} onPress={() => onChange({ lateFine: !line.lateFine })}>
            <Ionicons name={line.lateFine ? 'checkbox' : 'square-outline'} size={18} color={line.lateFine ? colors.brand : colors.textMuted} />
            <Text style={styles.hint}>Late fine</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Pressable style={styles.checkCol} onPress={() => onChange({ discountEligible: !line.discountEligible })}>
            <Ionicons name={line.discountEligible ? 'checkbox' : 'square-outline'} size={18} color={line.discountEligible ? colors.brand : colors.textMuted} />
          </Pressable>
          <Pressable style={styles.checkCol} onPress={() => onChange({ lateFine: !line.lateFine })}>
            <Ionicons name={line.lateFine ? 'checkbox' : 'square-outline'} size={18} color={line.lateFine ? colors.brand : colors.textMuted} />
          </Pressable>
        </>
      )}
      <View style={styles.typeCol}>
        {compact ? <Text style={styles.label}>Type</Text> : null}
        {renderMenu(`${errorPrefix}-type`, line.type, [...COMPONENT_TYPES], (type) => onChange({ type: type as ComponentType }))}
      </View>
      <Pressable onPress={onRemove} style={compact ? styles.removeLine : styles.iconButton} accessibilityLabel="Remove component">
        {compact ? <Text style={styles.dangerButtonText}>Remove</Text> : <Ionicons name="trash-outline" size={16} color={colors.dangerText} />}
      </Pressable>
    </View>
  );

  if (view === 'editor') {
    return (
      <ScrollView
        style={styles.page}
        contentContainerStyle={pageContent}
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.width);
          setContentWidth((current) => (current === next ? current : next));
        }}
      >
        <View style={styles.headerRow}>
          <View style={[styles.headerActions, compact && styles.editorActions]}>
            <Pressable style={[styles.secondaryButton, compact && styles.editorButton]} onPress={() => { setView('list'); setNotice(''); }} disabled={saving}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.secondaryButton, compact && styles.editorButton]} onPress={() => save('draft')} disabled={saving}>
              <Text style={styles.secondaryButtonText}>{saving ? 'Saving…' : 'Save Draft'}</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, compact && styles.editorButton]} onPress={() => save('publish')} disabled={saving}>
              <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save Configuration'}</Text>
            </Pressable>
          </View>
        </View>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.sectionTitle}>1. Basic fee structure information</Text>
            <Text style={styles.hint}>Fields marked * are mandatory</Text>
          </View>
          <View style={styles.formGrid}>
            <Field label="Fee Structure Name *" error={fieldErrors.name} styles={styles}>
              <TextInput value={form.name} onChangeText={(name) => patchForm({ name })} placeholder="Annual Composite Fee 2026-27" placeholderTextColor={colors.textMuted} style={styles.input} />
            </Field>
            <Field label="Academic Year *" error={fieldErrors.academicYear} styles={styles}>
              {renderMenu('year', form.academicYear, [...ACADEMIC_YEARS], (academicYear) => patchForm({ academicYear }))}
            </Field>
            <Field label="Campus *" error={fieldErrors.campus} styles={styles}>
              {renderMenu('campus', form.campus, [...CAMPUSES], (campus) => patchForm({ campus }))}
            </Field>
            <Field label="Effective From" error={fieldErrors.effectiveFrom} styles={styles}>
              <DateField value={form.effectiveFrom} onChange={(effectiveFrom) => patchForm({ effectiveFrom })} />
            </Field>
            <Field label="Effective To" error={fieldErrors.effectiveTo} styles={styles}>
              <DateField value={form.effectiveTo} onChange={(effectiveTo) => patchForm({ effectiveTo })} />
            </Field>
            <Field label="Status" styles={styles}>
              {renderMenu('status', STRUCTURE_STATUSES.find((item) => item.value === form.status)?.label || form.status, STRUCTURE_STATUSES.map((item) => item.label), (label) => {
                const match = STRUCTURE_STATUSES.find((item) => item.label === label);
                if (match) patchForm({ status: match.value });
              })}
            </Field>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.sectionTitle}>2. Applicable classes *</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>{form.selectedClasses.length} selected</Text></View>
          </View>
          <Text style={styles.hint}>Select classes to configure in this fee schedule. Selected classes will render in the configuration table below.</Text>
          {fieldErrors.classes ? <Text style={styles.errorText}>{fieldErrors.classes}</Text> : null}
          <View style={styles.toolbar}>
            <TextInput value={classQuery} onChangeText={setClassQuery} placeholder="Search classes (e.g. Class 1, Nursery)…" placeholderTextColor={colors.textMuted} style={[styles.input, styles.search]} />
            <Pressable style={styles.secondaryButton} onPress={() => setAllClasses(true)}><Text style={styles.secondaryButtonText}>Select All</Text></Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setAllClasses(false)}><Text style={styles.secondaryButtonText}>Clear All</Text></Pressable>
            {BANDS.map((band) => (
              <Pressable key={band.id} style={styles.secondaryButton} onPress={() => toggleBand(band.id)}>
                <Text style={styles.secondaryButtonText}>{band.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.classGrid}>
            {visibleClasses.map((item) => {
              const selected = form.selectedClasses.includes(item.name);
              return (
                <Pressable key={item.name} onPress={() => toggleClass(item.name)} style={[styles.classChip, selected && styles.classChipOn]}>
                  <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={16} color={selected ? colors.brand : colors.textMuted} />
                  <Text style={[styles.classChipText, selected && { color: colors.brand, fontWeight: '700' }]}>{item.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.headCopy}>
              <Text style={styles.sectionTitle}>3. Common fee configuration template</Text>
              <Text style={styles.hint}>Define standard fee heads and rates, then apply them in one click to all selected classes.</Text>
            </View>
            <View style={styles.headActions}>
              <Pressable style={[styles.secondaryButton, compact && styles.headerButton]} onPress={() => setShowNewHead((current) => !current)}>
                <Text style={styles.secondaryButtonText}>+ New Fee Head</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, compact && styles.headerButton]} onPress={() => patchForm({ templateComponents: [...form.templateComponents, blankLine()] })}>
                <Text style={styles.primaryButtonText}>+ Add Component</Text>
              </Pressable>
            </View>
          </View>
          {showNewHead ? (
            <View style={styles.inlineAdd}>
              <TextInput value={headDraft} onChangeText={setHeadDraft} placeholder="New fee head name" placeholderTextColor={colors.textMuted} style={[styles.input, { flex: 1 }]} />
              <Pressable style={styles.primaryButton} onPress={addHead}><Text style={styles.primaryButtonText}>Add</Text></Pressable>
            </View>
          ) : null}
          {fieldErrors.template ? <Text style={styles.errorText}>{fieldErrors.template}</Text> : null}
          {compact ? null : <View style={styles.lineHeader}>
            <Text style={[styles.colLabel, styles.grow]}>Fee head component *</Text>
            <Text style={[styles.colLabel, styles.amountCol]}>Amount (₹)</Text>
            <Text style={[styles.colLabel, styles.freqCol]}>Frequency *</Text>
            <Text style={[styles.colLabel, styles.dateCol]}>Due date</Text>
            <Text style={[styles.colLabel, styles.checkCol]}>Discount</Text>
            <Text style={[styles.colLabel, styles.checkCol]}>Late fine</Text>
            <Text style={[styles.colLabel, styles.typeCol]}>Type</Text>
            <Text style={[styles.colLabel, { width: 36 }]} />
          </View>}
          {form.templateComponents.map((line, index) => renderLineRow(
            line,
            (patch) => updateTemplateLine(line.id, patch),
            () => patchForm({ templateComponents: form.templateComponents.filter((item) => item.id !== line.id) }),
            `template.${index}`,
          ))}
          <View style={styles.templateFooter}>
            <Field label="Default Concession (₹)" error={fieldErrors.defaultConcession} styles={styles}>
              <TextInput value={form.defaultConcession} onChangeText={(defaultConcession) => patchForm({ defaultConcession })} keyboardType="decimal-pad" style={styles.input} />
            </Field>
            <Field label="Default Late Fine (₹)" error={fieldErrors.defaultLateFine} styles={styles}>
              <TextInput value={form.defaultLateFine} onChangeText={(defaultLateFine) => patchForm({ defaultLateFine })} keyboardType="decimal-pad" style={styles.input} />
            </Field>
            <Text style={styles.totalLabel}>Template Base Total: {inr(templateTotal)}</Text>
            <Pressable style={[styles.primaryButton, compact && styles.blockButton]} onPress={applyTemplate}>
              <Text style={styles.primaryButtonText}>Apply to All Selected Classes ({form.selectedClasses.length})</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.headCopy}>
              <Text style={styles.sectionTitle}>4. Multi-class fee schedule matrix</Text>
              <Text style={styles.hint}>Review and override fees for each class. Edit adjusts that class only.</Text>
            </View>
            <View style={styles.headActions}>
              <Pressable style={[styles.secondaryButton, compact && styles.headerButton, matrixMode === 'summary' && styles.segmentOn]} onPress={() => setMatrixMode('summary')}>
                <Text style={styles.secondaryButtonText}>Summary Table</Text>
              </Pressable>
              <Pressable style={[styles.secondaryButton, compact && styles.headerButton, matrixMode === 'comparison' && styles.segmentOn]} onPress={() => setMatrixMode('comparison')}>
                <Text style={styles.secondaryButtonText}>Comparison Matrix</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.statsRow}>
            <Stat label="Classes Configured" value={`${matrixRows.length} Standards`} styles={styles} />
            <Stat label="Avg Annual Rate / Student" value={inr(averageNet)} styles={styles} />
            <Stat label="Total Concessions (All)" value={inr(totalConcession)} styles={styles} />
            <Stat label="Rate Range (Min – Max)" value={`${inr(minNet)} – ${inr(maxNet)}`} styles={styles} />
          </View>
          {form.selectedClasses.length ? <Text style={styles.liveHint}>Configuring {form.selectedClasses.length} class{form.selectedClasses.length === 1 ? '' : 'es'} simultaneously</Text> : null}
          <View style={styles.toolbar}>
            <Pressable onPress={() => setChecked(checked.length === form.selectedClasses.length ? [] : [...form.selectedClasses])} style={[styles.checkRow, compact && styles.blockButton]}>
              <Ionicons name={checked.length && checked.length === form.selectedClasses.length ? 'checkbox' : 'square-outline'} size={16} color={colors.textSecondary} />
              <Text style={styles.hint}>Select all classes</Text>
            </Pressable>
            <Pressable style={[styles.secondaryButton, compact && styles.blockButton]} onPress={resetCheckedToTemplate}><Text style={styles.secondaryButtonText}>Reset to Common</Text></Pressable>
            <Pressable style={[styles.secondaryButton, compact && styles.blockButton]} onPress={copyChecked}><Text style={styles.secondaryButtonText}>Copy Configuration</Text></Pressable>
            <Pressable style={[styles.dangerButton, compact && styles.blockButton]} onPress={removeChecked}><Text style={styles.dangerButtonText}>Remove Selected</Text></Pressable>
          </View>

          {matrixMode === 'summary' ? (
            <DataTable
              rows={matrixRows}
              empty="Select classes in section 2 to build the schedule."
              keyExtractor={(row) => row.className}
              renderCard={(row) => (
                <ScheduleCard
                  row={row}
                  selected={checked.includes(row.className)}
                  styles={styles}
                  colors={colors}
                  onToggle={() => setChecked((current) => current.includes(row.className) ? current.filter((name) => name !== row.className) : [...current, row.className])}
                  onEdit={() => setEditingClass(editingClass === row.className ? null : row.className)}
                  onRemove={() => removeSchedule(row.className)}
                />
              )}
              belowRow={(row) => editingClass === row.className ? (
                <View style={styles.editPanel}>
                          <View style={styles.formGrid}>
                            <Field label="Sections (scope)" styles={styles}>
                              <TextInput value={row.sectionsScope} onChangeText={(sectionsScope) => updateSchedule(row.className, { sectionsScope })} style={styles.input} />
                            </Field>
                            <Field label="Concession (₹)" error={fieldErrors[`class.${row.className}.concession`]} styles={styles}>
                              <TextInput value={row.concession} onChangeText={(concession) => updateSchedule(row.className, { concession })} keyboardType="decimal-pad" style={styles.input} />
                            </Field>
                            <Field label="Late fine (₹)" styles={styles}>
                              <TextInput value={row.lateFineAmount} onChangeText={(lateFineAmount) => updateSchedule(row.className, { lateFineAmount })} keyboardType="decimal-pad" style={styles.input} />
                            </Field>
                            <Field label="Class status" styles={styles}>
                              {renderMenu(`class-status-${row.className}`, row.status, ['Draft', 'Active'], (status) => updateSchedule(row.className, { status: status as ClassStatus }))}
                            </Field>
                          </View>
                          {fieldErrors[`class.${row.className}`] ? <Text style={styles.errorText}>{fieldErrors[`class.${row.className}`]}</Text> : null}
                          {row.components.map((line, index) => renderLineRow(
                            line,
                            (patch) => updateClassLine(row.className, line.id, patch),
                            () => updateSchedule(row.className, { components: row.components.filter((item) => item.id !== line.id) }),
                            `class.${row.className}.${index}`,
                          ))}
                          <Pressable style={styles.secondaryButton} onPress={() => updateSchedule(row.className, { components: [...row.components, blankLine()] })}>
                            <Text style={styles.secondaryButtonText}>+ Add class component</Text>
                          </Pressable>
                        </View>
                      ) : null}
              columns={[
                { key: 'check', header: '', width: 36, render: (row) => {
                  const on = checked.includes(row.className);
                  return (
                    <Pressable onPress={() => setChecked((current) => on ? current.filter((name) => name !== row.className) : [...current, row.className])}>
                      <Ionicons name={on ? 'checkbox' : 'square-outline'} size={16} color={colors.textSecondary} />
                    </Pressable>
                  );
                } },
                { key: 'class', header: 'CLASS', flex: 1.1, render: (row) => <Text style={styles.strong}>{row.className}</Text> },
                { key: 'scope', header: 'SECTIONS', flex: 1.3, render: (row) => <Text style={styles.ledgerTd}>{row.sectionsScope}</Text> },
                { key: 'heads', header: 'COMPONENTS', flex: 1, render: (row) => <Text style={styles.ledgerTd}>{row.components.length} heads</Text> },
                { key: 'base', header: 'BASE FEE', flex: 1, render: (row) => <Text style={styles.ledgerTd}>{inr(classBase(row))}</Text> },
                { key: 'discount', header: 'DISCOUNT', flex: 1, render: (row) => <Text style={[styles.ledgerTd, { color: colors.dangerText }]}>-{inr(money(row.concession))}</Text> },
                { key: 'fine', header: 'LATE FINE', flex: 1, render: (row) => <Text style={[styles.ledgerTd, { color: colors.successText }]}>+{inr(money(row.lateFineAmount))}</Text> },
                { key: 'net', header: 'FINAL NET', flex: 1, render: (row) => <Text style={[styles.ledgerTd, styles.strong]}>{inr(classNet(row))}</Text> },
                { key: 'status', header: 'STATUS', width: 80, render: (row) => <Text style={row.status === 'Active' ? styles.statusOn : styles.statusOff}>{row.status}</Text> },
                { key: 'actions', header: 'ACTIONS', width: 72, render: (row) => (
                  <View style={styles.actionGroup}>
                    <Pressable onPress={() => setEditingClass(editingClass === row.className ? null : row.className)} style={styles.iconButton}>
                      <Ionicons name="create-outline" size={16} color={colors.brand} />
                    </Pressable>
                    <Pressable onPress={() => removeSchedule(row.className)} style={styles.iconButton}>
                      <Ionicons name="close" size={16} color={colors.dangerText} />
                    </Pressable>
                  </View>
                ) },
              ]}
            />
          ) : compact ? (
            <View style={{ gap: 10 }}>
              {matrixRows.length === 0 ? <Text style={styles.empty}>Select classes in section 2 to build the schedule.</Text> : null}
              {matrixRows.map((schedule) => (
                <View key={schedule.className} style={styles.mobileCard}>
                  <Text style={styles.structureName}>{schedule.className}</Text>
                  {comparisonHeads.map((head) => {
                    const line = schedule.components.find((item) => item.feeHead === head);
                    return (
                      <View key={head} style={styles.moneyRow}>
                        <Text style={styles.hint}>{head}</Text>
                        <Text style={styles.ledgerTd}>{line ? inr(money(line.amount)) : '—'}</Text>
                      </View>
                    );
                  })}
                  <View style={styles.moneyRow}>
                    <Text style={styles.strong}>Final net</Text>
                    <Text style={[styles.ledgerTd, styles.strong]}>{inr(classNet(schedule))}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <DataTable
              rows={[
                ...comparisonHeads.map((head) => ({ id: head, label: head, strong: false })),
                { id: 'final', label: 'Final net', strong: true },
              ]}
              keyExtractor={(row) => row.id}
              columns={[
                { key: 'head', header: 'FEE HEAD', flex: 1.4, minWidth: 140, render: (row) => <Text style={row.strong ? styles.strong : styles.ledgerTd}>{row.label}</Text> },
                ...matrixRows.map((schedule) => ({
                  key: schedule.className,
                  header: schedule.className.toUpperCase(),
                  flex: 1,
                  minWidth: 100,
                  render: (row: { id: string; label: string; strong: boolean }) => {
                    if (row.id === 'final') return <Text style={[styles.ledgerTd, styles.strong]}>{inr(classNet(schedule))}</Text>;
                    const line = schedule.components.find((item) => item.feeHead === row.label);
                    return <Text style={styles.ledgerTd}>{line ? inr(money(line.amount)) : '—'}</Text>;
                  },
                })),
              ]}
            />
          )}
          <Text style={styles.footerAvg}>Annual Fee Avg: {inr(averageNet)}</Text>
        </View>

        <View style={[styles.headerActions, compact && styles.editorActions]}>
          <Pressable style={[styles.secondaryButton, compact && styles.editorButton]} onPress={() => setView('list')} disabled={saving}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable>
          <Pressable style={[styles.secondaryButton, compact && styles.editorButton]} onPress={() => save('draft')} disabled={saving}><Text style={styles.secondaryButtonText}>Save Draft</Text></Pressable>
          <Pressable style={[styles.primaryButton, compact && styles.editorButton]} onPress={() => save('publish')} disabled={saving}><Text style={styles.primaryButtonText}>Save Configuration</Text></Pressable>
        </View>
      </ScrollView>
    );
  }

  const classTotal = new Set(structures.flatMap((structure) => structure.classSchedules.map((schedule) => schedule.className))).size;
  const headCatalog = Array.from(structures.reduce((map, structure) => {
    headsOf(structure).forEach((head) => map.set(head, (map.get(head) || 0) + 1));
    return map;
  }, new Map<string, number>()));
  return (
    <ScrollView style={styles.page} contentContainerStyle={pageContent}>
      <View style={styles.headerRow}>
        <View style={styles.headerActions}>
          <Pressable style={[styles.secondaryButton, compact && styles.headerButton]} onPress={() => exportLedger(structures)}>
            <Ionicons name="download-outline" size={15} color={colors.text} />
            <Text style={styles.secondaryButtonText} numberOfLines={1}>Export Ledger</Text>
          </Pressable>
          {ledgerTab === 'invoices' ? (
            <Pressable style={[styles.primaryButton, compact && styles.headerButton]} onPress={() => invoicesRef.current?.openIssue()}>
              <Ionicons name="add" size={16} color={colors.onBrand} />
              <Text style={styles.primaryButtonText} numberOfLines={1}>Generate Invoice</Text>
            </Pressable>
          ) : null}
          {ledgerTab === 'configuration' ? (
            <Pressable style={[styles.primaryButton, compact && styles.headerButton]} onPress={openCreate}>
              <Ionicons name="add" size={16} color={colors.onBrand} />
              <Text style={styles.primaryButtonText} numberOfLines={1}>Create Structure</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      <View style={styles.tabBar}>
        <Pressable style={[styles.tab, ledgerTab === 'invoices' && styles.tabOn]} onPress={() => setLedgerTab('invoices')}>
          <Text style={[styles.tabText, ledgerTab === 'invoices' && styles.tabTextOn]} numberOfLines={1}>{compact ? `Invoices (${invoiceCount})` : `Fee Invoices & Dues (${invoiceCount})`}</Text>
        </Pressable>
        <Pressable style={[styles.tab, ledgerTab === 'configuration' && styles.tabOn]} onPress={() => setLedgerTab('configuration')}>
          <Text style={[styles.tabText, ledgerTab === 'configuration' && styles.tabTextOn]} numberOfLines={1}>{compact ? `Configuration (${structures.length})` : `Fee Configuration (${structures.length} Structures · ${classTotal} Classes)`}</Text>
        </Pressable>
        <Pressable style={[styles.tab, ledgerTab === 'heads' && styles.tabOn]} onPress={() => setLedgerTab('heads')}>
          <Text style={[styles.tabText, ledgerTab === 'heads' && styles.tabTextOn]} numberOfLines={1}>{compact ? `Fee Heads (${headCatalog.length})` : `Global Fee Heads (${headCatalog.length})`}</Text>
        </Pressable>
      </View>

      {ledgerTab === 'invoices' ? <FeeInvoicesPanel ref={invoicesRef} onCount={setInvoiceCount} /> : null}

      {ledgerTab === 'heads' ? (
        <DataTable
          rows={headCatalog.map(([head, count]) => ({ head, count }))}
          empty="Fee heads appear here after you save a structure."
          keyExtractor={(row) => row.head}
          columns={[
            { key: 'head', header: 'FEE HEAD', flex: 2, render: (row) => <Text style={styles.structureName}>{row.head}</Text> },
            { key: 'count', header: 'USED IN', flex: 1, render: (row) => <Text style={styles.hint}>{row.count} structure{row.count === 1 ? '' : 's'}</Text> },
          ]}
        />
      ) : null}

      {ledgerTab === 'configuration' ? (
        <View style={compact ? undefined : styles.ledgerCard}>
          <DataTable
            rows={structures}
            loading={loading}
            empty="No fee structures match this view. Create one to configure classes together."
            keyExtractor={(structure) => structure.id}
            renderCard={(structure) => (
              <StructureCard
                structure={structure}
                styles={styles}
                colors={colors}
                onEdit={() => openEdit(structure)}
                onCopy={() => openEdit(structure, true)}
                onToggle={() => toggleStatus(structure)}
                onRemove={() => removeStructure(structure)}
              />
            )}
            columns={[
              { key: 'name', header: 'FEE STRUCTURE', flex: 2.2, minWidth: 180, render: (structure) => {
                const heads = headsOf(structure);
                const headPreview = previewList(heads, 2);
                return (
                  <View>
                    <Text style={styles.structureName}>{structure.name}</Text>
                    <Text style={styles.structureMeta} numberOfLines={2}>{headPreview.visible.join(', ')}{headPreview.extra > 0 ? ` +${headPreview.extra} more` : ''}</Text>
                  </View>
                );
              } },
              { key: 'year', header: 'ACADEMIC YEAR', flex: 1.05, minWidth: 104, render: (structure) => <Text style={styles.ledgerTd}>{yearLabel(structure.academicYear)}</Text> },
              { key: 'campus', header: 'CAMPUS', flex: 1.45, minWidth: 132, render: (structure) => <Text style={styles.ledgerTd}>{structure.campus}</Text> },
              { key: 'classes', header: 'CLASSES', flex: 1.55, minWidth: 148, render: (structure) => {
                const classNames = structure.classSchedules.map((schedule) => schedule.className);
                const classPreview = previewList(classNames, 4);
                return (
                  <View>
                    <View style={styles.classPills}>
                      {classPreview.visible.map((name) => <View key={name} style={styles.classPill}><Text style={styles.classPillText} numberOfLines={1}>{name}</Text></View>)}
                    </View>
                    {classPreview.extra > 0 ? <Text style={styles.moreLink}>+{classPreview.extra} more</Text> : null}
                    {classNames.length === 0 ? <Text style={styles.hint}>No classes</Text> : null}
                  </View>
                );
              } },
              { key: 'count', header: 'NO. OF CLASSES', flex: 1, minWidth: 96, render: (structure) => <Text style={styles.ledgerTd}>{structure.classSchedules.length} Classes</Text> },
              { key: 'components', header: 'COMPONENTS', flex: 1, minWidth: 96, render: (structure) => <Text style={styles.ledgerTd}>{headsOf(structure).length} Components</Text> },
              { key: 'range', header: 'RATE RANGE', flex: 1.15, minWidth: 108, render: (structure) => {
                const nets = netsOf(structure);
                const minRate = Math.min(...nets);
                const maxRate = Math.max(...nets);
                return <Text style={styles.ledgerTd}>{minRate === maxRate ? inr(minRate) : `${inr(minRate)} – ${inr(maxRate)}`}</Text>;
              } },
              { key: 'status', header: 'STATUS', width: 88, render: (structure) => {
                const statusStyle = structure.status === 'Active' ? styles.pillActive : structure.status === 'Inactive' ? styles.pillInactive : styles.pillDraft;
                const statusText = structure.status === 'Active' ? styles.pillActiveText : structure.status === 'Inactive' ? styles.pillInactiveText : styles.pillDraftText;
                return <View style={[styles.statusPill, statusStyle]}><Text style={[styles.statusPillText, statusText]}>{structure.status}</Text></View>;
              } },
              { key: 'actions', header: 'ACTIONS', width: 156, render: (structure) => (
                <View style={styles.actionGroup}>
                  <Pressable style={styles.actionIcon} onPress={() => openEdit(structure)}><Ionicons name="eye-outline" size={16} color={colors.textSecondary} /></Pressable>
                  <Pressable style={styles.actionIcon} onPress={() => openEdit(structure)}><Ionicons name="create-outline" size={16} color={colors.textSecondary} /></Pressable>
                  <Pressable style={styles.actionIcon} onPress={() => openEdit(structure, true)}><Ionicons name="copy-outline" size={16} color={colors.textSecondary} /></Pressable>
                  <Pressable style={styles.actionIcon} onPress={() => toggleStatus(structure)}><Ionicons name="power-outline" size={16} color={structure.status === 'Active' ? colors.successText : colors.textMuted} /></Pressable>
                  <Pressable style={styles.actionIcon} onPress={() => removeStructure(structure)}><Ionicons name="trash-outline" size={16} color={colors.dangerText} /></Pressable>
                </View>
              ) },
            ]}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

function rateLabel(structure: FeeStructure) {
  const nets = netsOf(structure);
  const minRate = Math.min(...nets);
  const maxRate = Math.max(...nets);
  return minRate === maxRate ? inr(minRate) : `${inr(minRate)} – ${inr(maxRate)}`;
}

function StructureCard({
  structure,
  styles,
  colors,
  onEdit,
  onCopy,
  onToggle,
  onRemove,
}: {
  structure: FeeStructure;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  onEdit: () => void;
  onCopy: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const heads = headsOf(structure);
  const classNames = structure.classSchedules.map((schedule) => schedule.className);
  const statusStyle = structure.status === 'Active' ? styles.pillActive : structure.status === 'Inactive' ? styles.pillInactive : styles.pillDraft;
  const statusText = structure.status === 'Active' ? styles.pillActiveText : structure.status === 'Inactive' ? styles.pillInactiveText : styles.pillDraftText;
  const actions: { name: React.ComponentProps<typeof Ionicons>['name']; color: string; label: string; onPress: () => void }[] = [
    { name: 'eye-outline', color: colors.textSecondary, label: 'View fee structure', onPress: onEdit },
    { name: 'create-outline', color: colors.textSecondary, label: 'Edit fee structure', onPress: onEdit },
    { name: 'copy-outline', color: colors.textSecondary, label: 'Duplicate fee structure', onPress: onCopy },
    { name: 'power-outline', color: structure.status === 'Active' ? colors.successText : colors.textMuted, label: 'Toggle status', onPress: onToggle },
    { name: 'trash-outline', color: colors.dangerText, label: 'Delete fee structure', onPress: onRemove },
  ];

  return (
    <View style={styles.mobileCard}>
      <View style={styles.mobileCardTop}>
        <View style={styles.mobileTitleBlock}>
          <Text style={styles.structureName}>{structure.name}</Text>
          <Text style={styles.structureMeta} numberOfLines={2}>{heads.length ? heads.join(', ') : 'No components'}</Text>
        </View>
        <View style={[styles.statusPill, statusStyle]}><Text style={[styles.statusPillText, statusText]}>{structure.status}</Text></View>
      </View>
      <View style={styles.factGrid}>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Academic year</Text>
          <Text style={styles.factValue}>{yearLabel(structure.academicYear)}</Text>
        </View>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Rate</Text>
          <Text style={styles.factValue}>{rateLabel(structure)}</Text>
        </View>
      </View>
      <Text style={styles.mobileCampus}>{structure.campus}</Text>
      {classNames.length ? (
        <View style={styles.mobilePills}>
          {classNames.map((name) => (
            <View key={name} style={styles.mobilePill}><Text style={styles.mobilePillText} numberOfLines={1}>{name}</Text></View>
          ))}
        </View>
      ) : <Text style={styles.hint}>No classes</Text>}
      <Text style={styles.hint}>{structure.classSchedules.length} classes · {heads.length} component{heads.length === 1 ? '' : 's'}</Text>
      <View style={styles.mobileActions}>
        {actions.map((action) => (
          <Pressable key={action.name} accessibilityLabel={action.label} onPress={action.onPress} style={styles.mobileAction}>
            <Ionicons name={action.name} size={18} color={action.color} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ScheduleCard({
  row,
  selected,
  styles,
  colors,
  onToggle,
  onEdit,
  onRemove,
}: {
  row: ClassForm;
  selected: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={[styles.mobileCard, selected ? { borderColor: colors.brand } : null]}>
      <View style={styles.mobileCardTop}>
        <Pressable onPress={onToggle} style={styles.scheduleTitle} accessibilityLabel={`Select ${row.className}`}>
          <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={18} color={selected ? colors.brand : colors.textMuted} />
          <View style={styles.mobileTitleBlock}>
            <Text style={styles.structureName}>{row.className}</Text>
            <Text style={styles.structureMeta} numberOfLines={1}>{row.sectionsScope || 'Entire class'}</Text>
          </View>
        </Pressable>
        <Text style={row.status === 'Active' ? styles.statusOn : styles.statusOff}>{row.status}</Text>
      </View>
      <View style={styles.factGrid}>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Base fee</Text>
          <Text style={styles.factValue}>{inr(classBase(row))}</Text>
        </View>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Final net</Text>
          <Text style={styles.factValue}>{inr(classNet(row))}</Text>
        </View>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Discount</Text>
          <Text style={[styles.factValue, { color: colors.dangerText }]}>-{inr(money(row.concession))}</Text>
        </View>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Late fine</Text>
          <Text style={[styles.factValue, { color: colors.successText }]}>+{inr(money(row.lateFineAmount))}</Text>
        </View>
      </View>
      <Text style={styles.hint}>{row.components.length} component{row.components.length === 1 ? '' : 's'}</Text>
      <View style={styles.mobileActions}>
        <Pressable onPress={onEdit} style={styles.scheduleTextButton} accessibilityLabel={`Edit ${row.className}`}>
          <Ionicons name="create-outline" size={16} color={colors.brand} />
          <Text style={[styles.secondaryButtonText, { color: colors.brand }]}>Edit</Text>
        </Pressable>
        <Pressable onPress={onRemove} style={styles.scheduleTextButton} accessibilityLabel={`Remove ${row.className}`}>
          <Ionicons name="close" size={16} color={colors.dangerText} />
          <Text style={styles.dangerButtonText}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Field({ label, error, children, styles }: { label: string; error?: string; children: React.ReactNode; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function Stat({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.hint}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors, compact: boolean) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.bg },
    pageContent: { padding: 20, gap: 14, paddingBottom: 48 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
    headerActions: { width: '100%', flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
    crumb: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
    title: { color: colors.text, fontSize: 24, fontWeight: '700' },
    subtitle: { color: colors.textSecondary, marginTop: 4, maxWidth: 640 },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 12 },
    cardHead: { width: '100%' as const, gap: 10 },
    headCopy: { width: '100%' as const },
    headActions: { width: '100%' as const, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    sectionTitle: { width: '100%' as const, color: colors.text, fontSize: compact ? 16 : 13, fontWeight: '700', lineHeight: compact ? 22 : 18, letterSpacing: compact ? 0 : 0.4, textTransform: compact ? 'none' : 'uppercase' },
    hint: { color: colors.textSecondary, fontSize: 12 },
    label: { color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
    field: compact
      ? { width: '100%' as const, minWidth: 0, flexGrow: 0, flexShrink: 0 }
      : { flexGrow: 1, flexBasis: 220, minWidth: 180 },
    formGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    input: { minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, color: colors.text, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    inputText: { color: colors.text, flex: 1, fontSize: 14 },
    menu: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginTop: 4, backgroundColor: colors.surface, overflow: 'hidden' },
    menuItem: { paddingHorizontal: 10, paddingVertical: 8 },
    menuText: { color: colors.text, fontSize: 13 },
    toolbar: compact
      ? { width: '100%' as const, gap: 8 }
      : { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
    search: compact ? { width: '100%' as const, minWidth: 0 } : { flexGrow: 1, minWidth: 220 },
    headerButton: { flexGrow: 1, flexBasis: compact ? '46%' as const : 'auto', justifyContent: 'center' },
    editorActions: { flexDirection: 'column', alignItems: 'stretch', width: '100%' as const },
    editorButton: { width: '100%' as const, justifyContent: 'center' },
    blockButton: { width: '100%' as const, alignSelf: 'stretch', justifyContent: 'center' },
    primaryButton: { minHeight: 40, backgroundColor: colors.brand, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
    primaryButtonText: { color: colors.onBrand, fontWeight: '700', fontSize: 13 },
    secondaryButton: { minHeight: 40, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
    secondaryButtonText: { color: colors.text, fontWeight: '600', fontSize: 13 },
    dangerButton: { borderWidth: 1, borderColor: colors.dangerText, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
    dangerButtonText: { color: colors.dangerText, fontWeight: '700', fontSize: 13 },
    segmentOn: { backgroundColor: colors.surface2 },
    badge: { backgroundColor: colors.accentBg, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { color: colors.accentText, fontSize: 12, fontWeight: '700' },
    classGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    classChip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, minWidth: 120, backgroundColor: colors.surface },
    classChipOn: { borderColor: colors.brand, backgroundColor: colors.surface2 },
    classChipText: { color: colors.text, fontSize: 13 },
    lineHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' },
    lineRow: compact
      ? { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 10, backgroundColor: colors.bg }
      : { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' },
    colLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
    grow: compact ? { width: '100%' as const, minWidth: 0 } : { flex: 1.4, minWidth: 180, flexBasis: 180 },
    amountCol: compact ? { width: '100%' as const, minWidth: 0 } : { width: 110, flexGrow: 1, minWidth: 110 },
    freqCol: compact ? { width: '100%' as const, minWidth: 0 } : { width: 170, flexGrow: 1, minWidth: 140 },
    dateCol: compact ? { width: '100%' as const, minWidth: 0 } : { width: 158, flexGrow: 1, minWidth: 140 },
    checkCol: { width: 72, alignItems: 'center', paddingTop: 10 },
    checkPair: { width: '100%' as const, flexDirection: 'row', gap: 12 },
    checkItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
    typeCol: compact ? { width: '100%' as const } : { width: 120 },
    iconButton: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
    removeLine: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.dangerText, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    templateFooter: compact
      ? { width: '100%' as const, gap: 12 }
      : { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' },
    totalLabel: { color: colors.text, fontWeight: '700', marginBottom: 10 },
    inlineAdd: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    stat: compact
      ? { flexGrow: 1, flexBasis: '46%' as const, minWidth: 0, backgroundColor: colors.surface2, borderRadius: 10, padding: 12 }
      : { flexGrow: 1, flexBasis: 160, minWidth: 140, backgroundColor: colors.surface2, borderRadius: 10, padding: 12 },
    statValue: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 4 },
    liveHint: { color: colors.successText, fontSize: 12, fontWeight: '600' },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 8 },
    tableHead: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 8, paddingVertical: 8 },
    tableRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, minHeight: 44 },
    th: { width: 140, color: colors.textMuted, fontSize: 11, fontWeight: '700', paddingHorizontal: 8 },
    td: { width: 140, color: colors.text, fontSize: 13, paddingHorizontal: 8 },
    tdCheck: { width: 140, paddingLeft: 8 },
    strong: { fontWeight: '700' },
    statusOn: { color: colors.successText, fontWeight: '700' },
    statusOff: { color: colors.warningText, fontWeight: '700' },
    rowActions: { width: 140, flexDirection: 'row' },
    editPanel: { backgroundColor: colors.surface2, borderRadius: 10, padding: 12, gap: 8, marginBottom: 8 },
    footerAvg: { color: colors.textSecondary, fontWeight: '600' },
    notice: { color: colors.brand, fontWeight: '600' },
    errorText: { color: colors.dangerText, fontSize: 12, marginTop: 4 },
    errorBanner: { color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 10 },
    empty: { color: colors.textSecondary, paddingVertical: 18, paddingHorizontal: 4 },
    emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
    tabBar: { flexDirection: compact ? 'column' : 'row', flexWrap: compact ? 'nowrap' : 'wrap', gap: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 6 },
    tab: compact
      ? { width: '100%' as const, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 }
      : { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
    tabOn: { backgroundColor: colors.brand },
    tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
    tabTextOn: { color: colors.onBrand },
    ledgerCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, gap: 12, overflow: 'hidden' },
    filterChip: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface },
    filterChipOn: { borderColor: colors.brand, backgroundColor: colors.surface2 },
    filterChipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    filterChipTextOn: { color: colors.brand },
    ledgerHead: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    ledgerRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
    ledgerTh: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
    ledgerTd: { color: colors.text, fontSize: 13, lineHeight: 18 },
    colName: { flex: 2.2, minWidth: 180, paddingRight: 16 },
    colYear: { flex: 1.05, minWidth: 104, paddingRight: 12, paddingTop: 2 },
    colCampus: { flex: 1.45, minWidth: 132, paddingRight: 12, paddingTop: 2 },
    colClasses: { flex: 1.55, minWidth: 148, paddingRight: 12 },
    colCount: { flex: 1, minWidth: 96, paddingRight: 12, paddingTop: 2 },
    colRange: { flex: 1.15, minWidth: 108, paddingRight: 12, paddingTop: 2 },
    colStatus: { flex: 0.8, minWidth: 76, paddingRight: 8, paddingTop: 2 },
    colActions: { width: 156, flexGrow: 0, flexShrink: 0 },
    structureName: { color: colors.text, fontSize: 15, fontWeight: '700' },
    structureMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 18 },
    classPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: '100%' },
    classPill: { width: '47%', backgroundColor: colors.surface2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    classPillText: { color: colors.text, fontSize: 12, fontWeight: '600' },
    moreLink: { color: colors.brand, fontSize: 12, fontWeight: '700', marginTop: 6 },
    rateText: { color: colors.text, fontSize: 13, fontWeight: '600' },
    statusPill: { alignSelf: 'flex-start', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
    statusPillText: { fontSize: 12, fontWeight: '700' },
    pillActive: { backgroundColor: colors.successBg },
    pillActiveText: { color: colors.successText },
    pillDraft: { backgroundColor: colors.warningBg },
    pillDraftText: { color: colors.warningText },
    pillInactive: { backgroundColor: colors.dangerBg },
    pillInactiveText: { color: colors.dangerText },
    actionGroup: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 2 },
    actionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    mobileCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, gap: 10 },
    mobileCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
    mobileTitleBlock: { flex: 1, minWidth: 0 },
    factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    fact: { flexGrow: 1, flexBasis: '46%' as const, minWidth: 120, backgroundColor: colors.surface2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
    factLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
    factValue: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 2 },
    mobileCampus: { color: colors.text, fontSize: 13 },
    mobilePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    mobilePill: { backgroundColor: colors.surface2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    mobilePillText: { color: colors.text, fontSize: 12, fontWeight: '600' },
    mobileActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
    scheduleTitle: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
    scheduleTextButton: { flex: 1, minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    moneyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    mobileAction: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
    headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  });
}
