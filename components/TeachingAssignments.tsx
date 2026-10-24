import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { loadAcademicSetup, type AcademicClass, type Campus, type ClassSection, type CurriculumSubject } from '../api/academicSetup';
import { createTeachingAssignment, deleteTeachingAssignment, loadTeachingRoster, type RosterTeacher, type TeachingAssignment } from '../api/teachingAssignments';
import { useTheme } from '../theme/ThemeContext';
import { DateField } from './ui/DateField';
import { DataTable } from './ui/DataTable';

const DUTY_TYPES = ['Core', 'Elective', 'Co-Curricular', 'Support'];

type FormState = {
  staffId: string;
  academicYear: string;
  campus: string;
  dutyType: string;
  className: string;
  sectionName: string;
  subject: string;
  weeklyPeriods: string;
  theoryPeriods: string;
  practicalPeriods: string;
  classTeacher: boolean;
  effectiveFrom: string;
  effectiveTo: string;
  notes: string;
  weeklyCapacity: string;
};

const emptyForm = (staffId = ''): FormState => ({
  staffId,
  academicYear: '2026-2027',
  campus: 'Main Campus',
  dutyType: 'Core',
  className: '',
  sectionName: '',
  subject: '',
  weeklyPeriods: '6',
  theoryPeriods: '5',
  practicalPeriods: '1',
  classTeacher: false,
  effectiveFrom: '2026-04-01',
  effectiveTo: '2027-03-31',
  notes: '',
  weeklyCapacity: '26',
});

export default function TeachingAssignments() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const [roster, setRoster] = useState<RosterTeacher[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'allocations' | 'workload' | 'teachers'>('allocations');
  const [form, setForm] = useState<FormState | null>(null);

  const load = async () => {
    const [rows, academic] = await Promise.all([loadTeachingRoster(), loadAcademicSetup()]);
    setRoster(rows);
    setClasses(academic.classes);
    setSections(academic.sections);
    setSubjects(academic.subjects);
    setCampuses(academic.campuses);
  };

  useEffect(() => {
    load()
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load teaching assignments.'))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return roster.filter((row) => {
      if (tab === 'teachers' && !row.classTeacher) return false;
      if (!needle) return true;
      return [row.name, row.employeeCode, row.department, row.subjectsLabel, row.classesLabel].join(' ').toLowerCase().includes(needle);
    });
  }, [roster, query, tab]);

  const selected = roster.find((row) => String(row.staffId) === form?.staffId);
  const weekly = Number(form?.weeklyPeriods || 0);
  const theory = Number(form?.theoryPeriods || 0);
  const practical = Number(form?.practicalPeriods || 0);
  const projected = (selected?.assignedPeriods || 0) + (Number.isFinite(weekly) ? weekly : 0);
  const capacity = Number(form?.weeklyCapacity || selected?.weeklyCapacity || 26);
  const remaining = capacity - projected;
  const classOptions = classes.map((item) => item.name);
  const yearOptions = Array.from(new Set(['2025-2026', '2026-2027', '2027-2028', ...classes.map((item) => item.academicYear).filter(Boolean)]));
  const sectionsFor = (className: string) => sections
    .filter((item) => classes.find((grade) => Number(grade.id) === Number(item.classId))?.name === className)
    .map((item) => item.name);
  const sectionOptions = form ? sectionsFor(form.className) : [];
  const subjectOptions = subjects.map((item) => item.name);

  const openAssign = (staffId = '') => {
    const teacher = roster.find((row) => String(row.staffId) === staffId);
    const next = emptyForm(staffId);
    if (teacher) {
      next.campus = teacher.campus || next.campus;
      next.weeklyCapacity = String(teacher.weeklyCapacity || 26);
    }
    const startingClass = classOptions.includes('Grade 8') ? 'Grade 8' : classOptions[0] || '';
    if (startingClass) {
      next.className = startingClass;
      next.sectionName = sectionsFor(startingClass)[0] || '';
    }
    setForm(next);
    setError('');
  };

  const save = async (another: boolean) => {
    if (!form) return;
    setSaving(true);
    setError('');
    try {
      const body: TeachingAssignment = {
        staffId: Number(form.staffId),
        academicYear: form.academicYear,
        campus: form.campus,
        dutyType: form.dutyType,
        className: form.className,
        sectionName: form.sectionName || sectionOptions[0] || '',
        subject: form.subject,
        weeklyPeriods: weekly,
        theoryPeriods: theory,
        practicalPeriods: practical,
        classTeacher: form.classTeacher,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo,
        notes: form.notes,
        weeklyCapacity: capacity,
        status: 'Active',
      };
      await createTeachingAssignment(body);
      await load();
      if (another) {
        setForm({ ...form, subject: '', notes: '', classTeacher: false });
      } else {
        setForm(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the assignment.');
    } finally {
      setSaving(false);
    }
  };

  const removeDuty = async (id?: number) => {
    if (!id) return;
    const ok = Platform.OS === 'web' ? window.confirm('Remove this assignment?') : true;
    if (!ok) return;
    try {
      await deleteTeachingAssignment(id);
      await load();
    } catch (err) {
      Alert.alert('Could not remove assignment', err instanceof Error ? err.message : '');
    }
  };

  const exportRoster = () => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      Alert.alert('Export', 'Export is available in the browser.');
      return;
    }
    const header = ['Teacher', 'Code', 'Department', 'Classes', 'Sections', 'Subjects', 'Class teacher', 'Capacity', 'Assigned', 'Left', 'Conflict'];
    const body = visible.map((row) => [row.name, row.employeeCode, row.department, row.classesLabel, row.sectionsLabel, row.subjectsLabel, row.classTeacher ? 'Yes' : 'No', String(row.weeklyCapacity), String(row.assignedPeriods), String(row.capacityLeft), row.conflict]);
    const csv = [header, ...body].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = 'teaching-assignments.csv';
    link.click();
    URL.revokeObjectURL(href);
  };

  if (loading) return <ActivityIndicator color={colors.brand} style={{ margin: 24 }} />;

  if (form) {
    const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch });
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: compact ? 12 : 20, paddingBottom: 48, gap: 12 }}>
        <Pressable onPress={() => setForm(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="arrow-back" size={16} color={colors.brand} />
          <Text style={{ color: colors.brand, fontWeight: '700' }}>Back to roster</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>Assign Class & Subject</Text>
        <Text style={{ color: colors.textSecondary }}>Allocate classroom duties, subjects, and weekly periods to faculty.</Text>
        {error ? <Text style={{ color: colors.dangerText, backgroundColor: colors.dangerBg, borderRadius: 8, padding: 10 }}>{error}</Text> : null}

        <View style={card(colors)}>
          <Text style={label(colors)}>Faculty / teacher</Text>
          <Choice value={form.staffId} options={roster.map((row) => ({ value: String(row.staffId), label: `${row.name} (${row.employeeCode}) — ${row.department}` }))} onChange={(staffId) => set({ staffId })} colors={colors} />
          {selected ? <Text style={{ color: colors.textSecondary, marginTop: 8 }}>{selected.department} · Currently {selected.assignedPeriods} / {selected.weeklyCapacity} periods</Text> : null}
        </View>

        <View style={card(colors)}>
          <Text style={sectionTitle(colors)}>Assignment scope</Text>
          <View style={grid(compact)}>
            <Field label="Academic year" colors={colors}><Choice value={form.academicYear} options={yearOptions.map((year) => ({ value: year, label: year }))} onChange={(academicYear) => set({ academicYear })} colors={colors} /></Field>
            <Field label="Campus" colors={colors}><Choice value={form.campus} options={(campuses.length ? campuses.map((item) => item.name) : ['Main Campus']).map((name) => ({ value: name, label: name }))} onChange={(campus) => set({ campus })} colors={colors} /></Field>
          </View>
          <Text style={label(colors)}>Duty type</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DUTY_TYPES.map((duty) => (
              <Pressable key={duty} onPress={() => set({ dutyType: duty })} style={{ borderWidth: 1, borderColor: form.dutyType === duty ? colors.brand : colors.border, backgroundColor: form.dutyType === duty ? colors.brand : colors.surface, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ color: form.dutyType === duty ? colors.onBrand : colors.text, fontWeight: '700' }}>{duty}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={card(colors)}>
          <Text style={sectionTitle(colors)}>Class & subject allocation</Text>
          <View style={grid(compact)}>
            <Field label="Class / grade *" colors={colors}><Choice value={form.className} options={classOptions.map((name) => ({ value: name, label: name }))} onChange={(className) => set({ className, sectionName: sectionsFor(className)[0] || '' })} colors={colors} /></Field>
            <Field label="Section *" colors={colors}><Choice value={form.sectionName} options={sectionOptions.map((name) => ({ value: name, label: name }))} onChange={(sectionName) => set({ sectionName })} colors={colors} /></Field>
            <Field label="Subject *" colors={colors}><Choice value={form.subject} options={subjectOptions.map((name) => ({ value: name, label: name }))} onChange={(subject) => set({ subject })} colors={colors} /></Field>
          </View>
          <View style={grid(compact)}>
            <Field label="Weekly periods" colors={colors}><TextInput value={form.weeklyPeriods} onChangeText={(weeklyPeriods) => set({ weeklyPeriods })} keyboardType="number-pad" style={input(colors)} /></Field>
            <Field label="Theory load" colors={colors}><TextInput value={form.theoryPeriods} onChangeText={(theoryPeriods) => set({ theoryPeriods })} keyboardType="number-pad" style={input(colors)} /></Field>
            <Field label="Practical / lab" colors={colors}><TextInput value={form.practicalPeriods} onChangeText={(practicalPeriods) => set({ practicalPeriods })} keyboardType="number-pad" style={input(colors)} /></Field>
          </View>
          <View style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.accentBg, borderRadius: 12, padding: 12, flexDirection: compact ? 'column' : 'row', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Class teacher appointment</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4 }}>Appoint as official class in-charge{form.className && form.sectionName ? ` for ${form.className} ${form.sectionName}` : ''}.</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[false, true].map((value) => (
                <Pressable key={String(value)} onPress={() => set({ classTeacher: value })} style={{ borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: form.classTeacher === value ? colors.brand : colors.surface, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: form.classTeacher === value ? colors.onBrand : colors.text, fontWeight: '700' }}>{value ? 'Yes' : 'No'}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={grid(compact)}>
            <Field label="Effective from" colors={colors}><DateField value={form.effectiveFrom} onChange={(effectiveFrom) => set({ effectiveFrom })} /></Field>
            <Field label="Effective to" colors={colors}><DateField value={form.effectiveTo} onChange={(effectiveTo) => set({ effectiveTo })} /></Field>
            <Field label="Weekly capacity" colors={colors}><TextInput value={form.weeklyCapacity} onChangeText={(weeklyCapacity) => set({ weeklyCapacity })} keyboardType="number-pad" style={input(colors)} /></Field>
          </View>
          <Field label="Notes" colors={colors}><TextInput value={form.notes} onChangeText={(notes) => set({ notes })} placeholder="Syllabus or exam notes" placeholderTextColor={colors.textMuted} style={[input(colors), { minHeight: 72 }]} multiline /></Field>
        </View>

        <View style={{ borderRadius: 12, padding: 12, backgroundColor: remaining < 0 ? colors.dangerBg : colors.successBg }}>
          <Text style={{ color: remaining < 0 ? colors.dangerText : colors.successText, fontWeight: '700' }}>
            {projected} / {capacity} periods · {remaining < 0 ? `${Math.abs(remaining)} over capacity` : `${remaining} periods left after this allocation`}
          </Text>
        </View>

        {selected && selected.assignments.length ? (
          <View style={card(colors)}>
            <Text style={sectionTitle(colors)}>Already assigned ({selected.assignments.length})</Text>
            {selected.assignments.map((duty) => (
              <View key={duty.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ color: colors.text, flex: 1 }}>{duty.className} {duty.sectionName} · {duty.subject} ({duty.weeklyPeriods} periods){duty.classTeacher ? ' · Class teacher' : ''}</Text>
                <Pressable onPress={() => removeDuty(duty.id)}><Text style={{ color: colors.dangerText, fontWeight: '700' }}>Remove</Text></Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: compact ? 'column' : 'row', justifyContent: 'flex-end', gap: 8 }}>
          <Pressable onPress={() => setForm(null)} style={ghost(colors)}><Text style={{ color: colors.text, fontWeight: '700' }}>Cancel</Text></Pressable>
          <Pressable disabled={saving || !form.staffId} onPress={() => save(true)} style={ghost(colors)}><Text style={{ color: colors.brand, fontWeight: '700' }}>Save & add another</Text></Pressable>
          <Pressable disabled={saving || !form.staffId} onPress={() => save(false)} style={primary(colors)}><Text style={{ color: colors.onBrand, fontWeight: '700' }}>{saving ? 'Saving...' : 'Save assignment'}</Text></Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: compact ? 12 : 20, paddingBottom: 48, gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <Pressable onPress={() => navigation.navigate('Staff')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="arrow-back" size={16} color={colors.brand} />
          <Text style={{ color: colors.brand, fontWeight: '700' }}>Back to staff</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Pressable onPress={exportRoster} style={ghost(colors)}><Text style={{ color: colors.text, fontWeight: '700' }}>Export</Text></Pressable>
          <Pressable onPress={() => openAssign()} style={primary(colors)}><Text style={{ color: colors.onBrand, fontWeight: '700' }}>+ Assign teacher</Text></Pressable>
        </View>
      </View>
      {error ? <Text style={{ color: colors.dangerText }}>{error}</Text> : null}

      <View style={{ flexDirection: compact ? 'column' : 'row', gap: 8 }}>
        {([
          ['allocations', 'Class & subject'],
          ['workload', 'Workload'],
          ['teachers', 'Class teachers'],
        ] as const).map(([id, labelText]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={{ borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: tab === id ? colors.brand : colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: tab === id ? colors.onBrand : colors.text, fontWeight: '700' }}>{labelText}</Text>
          </Pressable>
        ))}
      </View>

      <TextInput value={query} onChangeText={setQuery} placeholder="Search teacher, subject, or class" placeholderTextColor={colors.textMuted} style={input(colors)} />

      <DataTable
        rows={visible}
        empty="No teachers match this view."
        keyExtractor={(row) => String(row.staffId)}
        renderCard={(row) => <TeacherCard row={row} colors={colors} onAssign={() => openAssign(String(row.staffId))} />}
        columns={[
          { key: 'name', header: 'Teacher', flex: 1.6, minWidth: 180, render: (row) => <Text style={{ color: colors.text, fontWeight: '700' }}>{row.name}{'\n'}<Text style={{ color: colors.textMuted, fontWeight: '500' }}>{row.employeeCode}</Text></Text> },
          { key: 'classes', header: 'Classes', flex: 1, minWidth: 90, render: (row) => <Text style={{ color: colors.text }}>{row.classesLabel}</Text> },
          { key: 'sections', header: 'Sections', flex: 1, minWidth: 100, render: (row) => <Text style={{ color: colors.text }}>{row.sectionsLabel}</Text> },
          { key: 'subjects', header: 'Subjects', flex: 1.3, minWidth: 140, render: (row) => <Text style={{ color: colors.text }}>{row.subjectsLabel}</Text> },
          { key: 'homeroom', header: 'Class teacher', width: 110, render: (row) => <Text style={{ color: row.classTeacher ? colors.successText : colors.textMuted, fontWeight: '700' }}>{row.classTeacher ? 'Yes' : 'No'}</Text> },
          { key: 'cap', header: 'Capacity', width: 90, render: (row) => <Text style={{ color: colors.text }}>{row.weeklyCapacity}</Text> },
          { key: 'assigned', header: 'Assigned', width: 90, render: (row) => <Text style={{ color: colors.text }}>{row.assignedPeriods}</Text> },
          { key: 'left', header: 'Left', width: 80, render: (row) => <Text style={{ color: row.capacityLeft < 0 ? colors.dangerText : colors.successText, fontWeight: '700' }}>{row.capacityLeft > 0 ? `+${row.capacityLeft}` : row.capacityLeft}</Text> },
          { key: 'conflict', header: 'Conflict', width: 120, render: (row) => <Text style={{ color: row.conflict === 'Clean' ? colors.successText : colors.dangerText, fontWeight: '700' }}>{row.conflict}</Text> },
          { key: 'action', header: '', width: 88, render: (row) => <Pressable onPress={() => openAssign(String(row.staffId))}><Text style={{ color: colors.brand, fontWeight: '700' }}>+ Assign</Text></Pressable> },
        ]}
      />
    </ScrollView>
  );
}

function TeacherCard({ row, colors, onAssign }: { row: RosterTeacher; colors: ReturnType<typeof useTheme>['colors']; onAssign: () => void }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{row.name}</Text>
          <Text style={{ color: colors.textMuted }}>{row.employeeCode} · {row.department}</Text>
        </View>
        <Text style={{ color: row.conflict === 'Clean' ? colors.successText : colors.dangerText, fontWeight: '700' }}>{row.conflict}</Text>
      </View>
      <Text style={{ color: colors.text }}>{row.subjectsLabel}</Text>
      <Text style={{ color: colors.textSecondary }}>{row.sectionsLabel}</Text>
      <Text style={{ color: colors.textSecondary }}>{row.assignedPeriods} / {row.weeklyCapacity} periods · {row.capacityLeft} left{row.classTeacher ? ' · Class teacher' : ''}</Text>
      <Pressable onPress={onAssign} style={{ alignSelf: 'flex-start', backgroundColor: colors.brand, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }}>
        <Text style={{ color: colors.onBrand, fontWeight: '700' }}>+ Assign</Text>
      </Pressable>
    </View>
  );
}

function Field({ label, children, colors }: { label: string; children: React.ReactNode; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: 220, minWidth: 160 }}>
      <Text style={labelStyle(colors)}>{label}</Text>
      {children}
    </View>
  );
}

function Choice({ value, options, onChange, colors }: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; colors: ReturnType<typeof useTheme>['colors'] }) {
  if (Platform.OS === 'web') {
    return React.createElement('select', {
      value,
      onChange: (event: { target: { value: string } }) => onChange(event.target.value),
      style: { width: '100%', height: 40, borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, padding: '0 10px' },
    }, [React.createElement('option', { key: '', value: '' }, 'Select'), ...options.map((option) => React.createElement('option', { key: option.value, value: option.value }, option.label))]);
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {options.map((option) => (
        <Pressable key={option.value} onPress={() => onChange(option.value)} style={{ borderWidth: 1, borderColor: value === option.value ? colors.brand : colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 }}>
          <Text style={{ color: colors.text }}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const card = (colors: ReturnType<typeof useTheme>['colors']) => ({ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, gap: 10 });
const grid = (compact: boolean) => ({ flexDirection: compact ? 'column' as const : 'row' as const, flexWrap: 'wrap' as const, gap: 10 });
const input = (colors: ReturnType<typeof useTheme>['colors']) => ({ minHeight: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, color: colors.text, backgroundColor: colors.surface });
const label = (colors: ReturnType<typeof useTheme>['colors']) => ({ color: colors.textSecondary, fontWeight: '700' as const, marginBottom: 6 });
const labelStyle = label;
const sectionTitle = (colors: ReturnType<typeof useTheme>['colors']) => ({ color: colors.text, fontWeight: '700' as const, fontSize: 13, letterSpacing: 0.4 });
const primary = (colors: ReturnType<typeof useTheme>['colors']) => ({ minHeight: 40, justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: colors.brand, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 });
const ghost = (colors: ReturnType<typeof useTheme>['colors']) => ({ minHeight: 40, justifyContent: 'center' as const, alignItems: 'center' as const, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 });
