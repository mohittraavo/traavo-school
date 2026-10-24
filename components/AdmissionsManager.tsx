import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { loadAcademicSetup, type AcademicClass, type ClassSection } from '../api/academicSetup';
import { apiDownload, apiJson } from '../api/client';
import { useAppStyles, useTheme } from '../theme/ThemeContext';
import { DateField } from './ui/DateField';
import { DataTable, type DataColumn } from './ui/DataTable';

type Application = {
  id?: number;
  applicationNo: string;
  applicationDate: string;
  academicYear: string;
  campus: string;
  applyingClass: string;
  applyingSection: string;
  admissionSource: string;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  bloodGroup: string;
  fatherName: string;
  motherName: string;
  guardianRelationship: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  previousSchool: string;
  previousClass: string;
  previousGrade: string;
  entranceScore: string;
  remarks: string;
  documentType: string;
  documentNumber: string;
  verificationStatus: string;
  stage: string;
  studentId?: number | null;
};

type Summary = { total: number; review: number; approved: number; converted: number };
type Options = { stages: string[]; sources: string[]; genders: string[]; relationships: string[]; documents: string[]; verification: string[]; classes: string[]; sections: string[]; years: string[] };

const FILTERS = ['All', 'Submitted', 'Under Review', 'Approved', 'Enrolled', 'Rejected'];
const SECTIONS = ['Application Metadata', 'Candidate Personal Details', 'Parent / Guardian', 'Residential Address', 'Academic History', 'Verification Documents'];

function editable(row: Application): Application {
  const next = { ...emptyForm(), ...row, id: row.id, studentId: row.studentId };
  (Object.keys(emptyForm()) as (keyof Application)[]).forEach((key) => {
    if (next[key] == null) (next as Record<string, string>)[key] = '';
  });
  return next;
}

const emptyForm = (): Application => ({
  applicationNo: '', applicationDate: new Date().toISOString().slice(0, 10), academicYear: '2026-2027', campus: 'Main Campus', applyingClass: 'Grade 8', applyingSection: 'Section A', admissionSource: 'Walk-in',
  firstName: '', middleName: '', lastName: '', gender: 'Male', dateOfBirth: '', bloodGroup: '', fatherName: '', motherName: '', guardianRelationship: 'Father', phone: '', email: '',
  address: '', city: '', state: '', pincode: '', previousSchool: '', previousClass: '', previousGrade: '', entranceScore: '', remarks: '', documentType: 'Birth Certificate', documentNumber: '', verificationStatus: 'Pending', stage: 'Submitted',
});

function stageColors(stage: string, colors: { successText: string; successBg: string; warningText: string; warningBg: string; dangerText: string; dangerBg: string; textSecondary: string; surface2: string; brand: string }) {
  if (stage === 'Rejected') return { color: colors.dangerText, bg: colors.dangerBg };
  if (stage === 'Submitted' || stage === 'Under Review' || stage === 'Draft') return { color: colors.warningText, bg: colors.warningBg };
  if (stage === 'Approved' || stage === 'Admitted') return { color: colors.brand, bg: colors.successBg };
  return { color: colors.successText, bg: colors.successBg };
}

const EMPTY_SUMMARY: Summary = { total: 0, review: 0, approved: 0, converted: 0 };

export function AdmissionsDashboardSummary() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<any>();
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);

  useEffect(() => {
    apiJson<Summary>('/api/admissions/summary').then(setSummary).catch(() => setSummary(EMPTY_SUMMARY));
  }, []);

  return (
    <View style={{ marginTop: 18, gap: 10 }}>
      <Text style={{ color: colors.brand, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }}>ADMISSIONS</Text>
      <PipelineStats summary={summary} compact={width < 820} onPress={() => navigation.navigate('Admissions')} />
    </View>
  );
}

export default function AdmissionsManager() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 820;
  const [rows, setRows] = useState<Application[]>([]);
  const [options, setOptions] = useState<Options | null>(null);
  const [campuses, setCampuses] = useState<string[]>(['Main Campus']);
  const [academicClasses, setAcademicClasses] = useState<AcademicClass[]>([]);
  const [academicSections, setAcademicSections] = useState<ClassSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [form, setForm] = useState<Application | null>(null);
  const [review, setReview] = useState<Application | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [list, opts, academic] = await Promise.all([
        apiJson<Application[]>('/api/admissions'),
        apiJson<Options>('/api/admissions/options'),
        loadAcademicSetup().catch(() => null),
      ]);
      setRows(list);
      setOptions(opts);
      if (academic?.campuses.length) setCampuses(academic.campuses.map((row) => row.name));
      if (academic) {
        setAcademicClasses(academic.classes);
        setAcademicSections(academic.sections);
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => rows.filter((row) => {
    const matchesFilter = filter === 'All' || (filter === 'Review' ? row.stage === 'Submitted' || row.stage === 'Under Review' : row.stage === filter);
    const haystack = `${row.firstName} ${row.lastName} ${row.applicationNo} ${row.fatherName} ${row.phone}`.toLowerCase();
    return matchesFilter && haystack.includes(query.trim().toLowerCase());
  }), [rows, filter, query]);

  const save = async (draft: boolean) => {
    if (!form) return;
    setBusy(true);
    try {
      const path = draft ? '/api/admissions/draft' : form.id ? `/api/admissions/${form.id}` : '/api/admissions';
      await apiJson(path, { method: draft ? 'POST' : form.id ? 'PUT' : 'POST', body: JSON.stringify(form) });
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the application.');
    } finally {
      setBusy(false);
    }
  };

  const updateReview = async (stage: string) => {
    if (!review?.id) return;
    setBusy(true);
    try {
      const saved = await apiJson<Application>(`/api/admissions/${review.id}/review`, { method: 'POST', body: JSON.stringify({ stage, entranceScore: review.entranceScore }) });
      setReview(saved);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update the stage.');
    } finally {
      setBusy(false);
    }
  };

  const convert = async () => {
    if (!review?.id) return;
    setBusy(true);
    try {
      const saved = await apiJson<Application>(`/api/admissions/${review.id}/convert`, { method: 'POST' });
      setReview(saved);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to convert this application.');
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (row: Application) => {
    setReview(null);
    setForm(editable(row));
  };

  const columns: DataColumn<Application>[] = [
    { key: 'name', header: 'Applicant Name', width: 220, render: (row) => <Applicant row={row} colors={colors} /> },
    { key: 'no', header: 'Application No', width: 140, render: (row) => <Text style={{ color: colors.brand, fontWeight: '700' }}>{row.applicationNo}</Text> },
    { key: 'grade', header: 'Applying Grade', width: 130, render: (row) => <Text style={{ color: colors.text }}>{row.applyingClass}</Text> },
    { key: 'parent', header: 'Parent / Guardian', width: 170, render: (row) => <Text style={{ color: colors.text }}>{row.fatherName || '—'}</Text> },
    { key: 'phone', header: 'Contact Phone', width: 160, render: (row) => <Text style={{ color: colors.text }}>{row.phone}</Text> },
    { key: 'score', header: 'Score', width: 90, render: (row) => <Text style={{ color: row.entranceScore ? colors.successText : colors.textMuted, fontWeight: '700' }}>{row.entranceScore ? `${row.entranceScore}%` : 'Pending'}</Text> },
    { key: 'stage', header: 'Stage Status', width: 150, render: (row) => <StagePill stage={row.stage} /> },
    { key: 'actions', header: 'Actions', width: 132, render: (row) => (
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Pressable onPress={() => openEdit(row)} style={{ width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="pencil-outline" size={15} color={colors.brand} /></Pressable>
        <Pressable onPress={() => setReview(row)} style={{ minHeight: 32, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 }}><Ionicons name="eye-outline" size={15} color={colors.brand} /><Text style={{ color: colors.brand, fontWeight: '700', fontSize: 12 }}>Review</Text></Pressable>
      </View>
    ) },
  ];

  if (form && options) {
    return <ApplicationForm form={form} setForm={setForm} options={options} campuses={campuses} classes={academicClasses} sections={academicSections} compact={compact} busy={busy} error={error} onCancel={() => setForm(null)} onSave={save} />;
  }

  const ghostBtn = { minHeight: 40, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.surface, borderRadius: 9, borderWidth: 1, borderColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const, flexDirection: 'row' as const, gap: 6 };
  const primaryBtn = { minHeight: 40, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.brand, borderRadius: 9, alignItems: 'center' as const, justifyContent: 'center' as const, flexDirection: 'row' as const, gap: 6 };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg, padding: compact ? 12 : 16 }} contentContainerStyle={{ paddingBottom: 120, gap: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
        <Pressable onPress={() => apiDownload('/api/admissions/export', 'admissions-pipeline.csv').catch((err) => setError(err instanceof Error ? err.message : 'Export failed.'))} style={ghostBtn}><Ionicons name="download-outline" size={16} color={colors.textSecondary} /><Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13 }}>Export Pipeline</Text></Pressable>
        <Pressable onPress={() => setForm(emptyForm())} style={primaryBtn}><Ionicons name="add" size={16} color={colors.onBrand} /><Text style={{ color: colors.onBrand, fontWeight: '600', fontSize: 13 }}>New Admission Form</Text></Pressable>
      </View>
      <View style={{ paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: compact ? 'column' : 'row', gap: 8, alignItems: compact ? 'stretch' : 'center' }}>
          <View style={{ flex: 1, minWidth: 0, height: 40, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 9, paddingHorizontal: 10 }}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Search candidate name, application ID or guardian" placeholderTextColor={colors.textMuted} style={{ flex: 1, color: colors.text, paddingVertical: 0, paddingHorizontal: 8, height: 34, fontSize: 13 }} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {FILTERS.map((item) => {
              const active = filter === item || (filter === 'Review' && (item === 'Submitted' || item === 'Under Review'));
              return <Pressable key={item} onPress={() => setFilter(item)} style={{ minHeight: 34, paddingHorizontal: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? colors.text : colors.surface, borderWidth: 1, borderColor: active ? colors.text : colors.border }}><Text style={{ color: active ? colors.surface : colors.textSecondary, fontWeight: '700', fontSize: 11, letterSpacing: 0.3 }}>{item.toUpperCase()}</Text></Pressable>;
            })}
          </View>
        </View>
      </View>
      {error ? <Text style={{ color: colors.dangerText }}>{error}</Text> : null}
      <DataTable columns={columns} rows={visible} keyExtractor={(row) => String(row.id)} loading={loading} empty="No applications in this stage." renderCard={(row) => <ApplicationCard row={row} onReview={() => setReview(row)} onEdit={() => openEdit(row)} />} />
      {review ? <ReviewModal row={review} busy={busy} onClose={() => setReview(null)} onStage={updateReview} onConvert={convert} onEdit={() => openEdit(review)} /> : null}
    </ScrollView>
  );
}

function StagePill({ stage }: { stage: string }) {
  const { colors } = useTheme();
  const tone = stageColors(stage, colors);
  return (
    <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: tone.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone.color }} />
      <Text style={{ color: tone.color, fontSize: 11, fontWeight: '700' }}>{stage.toUpperCase()}</Text>
    </View>
  );
}

function PipelineStats({ summary, compact, onPress, active, onSelect }: { summary: Summary; compact: boolean; onPress?: () => void; active?: string; onSelect?: (filter: string) => void }) {
  const { colors } = useTheme();
  const cards = [
    { key: 'All', label: 'Total inquiries', value: summary.total, hint: 'Current cycle intake', color: colors.text },
    { key: 'Review', label: 'Review pipeline', value: summary.review, hint: 'Under evaluation', color: colors.warningText },
    { key: 'Approved', label: 'Approved for admission', value: summary.approved, hint: 'Ready for SIS enrolment', color: colors.brand },
    { key: 'Enrolled', label: 'Converted to SIS', value: summary.converted, hint: 'Provisioned student IDs', color: colors.successText },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {cards.map((card) => {
        const selected = active === card.key;
        return (
          <Pressable key={card.label} onPress={() => onSelect ? onSelect(card.key) : onPress?.()} style={{ flexGrow: 1, flexBasis: compact ? '100%' : '22%', minWidth: compact ? '100%' : 180, backgroundColor: colors.surface, borderWidth: 1, borderColor: selected ? card.color : colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, gap: 4 }}>
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>{card.label.toUpperCase()}</Text>
            <Text style={{ color: card.color, fontSize: 32, fontWeight: '700', lineHeight: 38 }}>{card.value}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{card.hint}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Applicant({ row, colors }: { row: Application; colors: ReturnType<typeof useTheme>['colors'] }) {
  const initials = `${row.firstName?.[0] || ''}${row.lastName?.[0] || ''}`.toUpperCase();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentBg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.brand, fontWeight: '800', fontSize: 12 }}>{initials}</Text></View>
      <View>
        <Text style={{ color: colors.text, fontWeight: '700' }}>{row.firstName} {row.lastName}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{row.gender}{row.dateOfBirth ? ` · Born ${row.dateOfBirth}` : ''}</Text>
      </View>
    </View>
  );
}

function ApplicationCard({ row, onReview, onEdit }: { row: Application; onReview: () => void; onEdit: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Applicant row={row} colors={colors} />
        <StagePill stage={row.stage} />
      </View>
      <Text style={{ color: colors.textMuted }}>{row.applicationNo} · {row.applyingClass} · {row.fatherName || 'No guardian'}</Text>
      <Text style={{ color: colors.text }}>{row.phone} · {row.entranceScore ? `${row.entranceScore}%` : 'Score pending'}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={onEdit} style={{ minHeight: 40, justifyContent: 'center' }}><Text style={{ color: colors.brand, fontWeight: '700' }}>Edit</Text></Pressable>
        <Pressable onPress={onReview} style={{ minHeight: 40, justifyContent: 'center' }}><Text style={{ color: colors.brand, fontWeight: '700' }}>Review</Text></Pressable>
      </View>
    </View>
  );
}

function ApplicationForm({ form, setForm, options, campuses, classes, sections, compact, busy, error, onCancel, onSave }: { form: Application; setForm: (row: Application) => void; options: Options; campuses: string[]; classes: AcademicClass[]; sections: ClassSection[]; compact: boolean; busy: boolean; error: string; onCancel: () => void; onSave: (draft: boolean) => void }) {
  const { colors } = useTheme();
  const styles = useAppStyles();
  const set = (key: keyof Application, value: string) => setForm({ ...form, [key]: value });
  const basis = compact ? '100%' : '31%';
  const classNames = classes.length ? classes.map((item) => item.name) : options.classes;
  const sectionNames = (() => {
    const grade = classes.find((item) => item.name === form.applyingClass);
    const matched = sections.filter((item) => Number(item.classId) === Number(grade?.id)).map((item) => item.name);
    return matched.length ? matched : options.sections;
  })();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ gap: 14, padding: compact ? 12 : 16, paddingBottom: 32 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SECTIONS.map((section, index) => (
          <View key={section} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.onBrand, fontSize: 10, fontWeight: '800' }}>{index + 1}</Text></View>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>{section}</Text>
          </View>
        ))}
      </View>
      <FormCard title="1. Application Metadata" hint="Application tracking number, campus, academic year and source.">
        <Field label="Application Number" value={form.applicationNo} onChange={(value) => set('applicationNo', value)} placeholder="Auto-generated if blank" basis={basis} />
        <Field label="Application Date" value={form.applicationDate} onChange={(value) => set('applicationDate', value)} basis={basis} date />
        <Select label="Academic Year" value={form.academicYear} options={options.years} onChange={(value) => set('academicYear', value)} basis={basis} />
        <Select label="Campus" value={form.campus} options={campuses} onChange={(value) => set('campus', value)} basis={basis} />
        <Select label="Applying Class" value={form.applyingClass} options={classNames} onChange={(value) => {
          const grade = classes.find((item) => item.name === value);
          const nextSections = sections.filter((item) => Number(item.classId) === Number(grade?.id)).map((item) => item.name);
          setForm({ ...form, applyingClass: value, applyingSection: nextSections.includes(form.applyingSection) ? form.applyingSection : (nextSections[0] || '') });
        }} basis={basis} />
        <Select label="Applying Section" value={form.applyingSection} options={sectionNames} onChange={(value) => set('applyingSection', value)} basis={basis} />
        <Select label="Admission Source" value={form.admissionSource} options={options.sources} onChange={(value) => set('admissionSource', value)} basis={basis} />
      </FormCard>
      <FormCard title="2. Candidate Personal Information" hint="Legal name, gender, birth date and blood group.">
        <Field label="First Name" value={form.firstName} onChange={(value) => set('firstName', value)} basis={basis} />
        <Field label="Middle Name" value={form.middleName} onChange={(value) => set('middleName', value)} basis={basis} />
        <Field label="Last Name" value={form.lastName} onChange={(value) => set('lastName', value)} basis={basis} />
        <Field label="Date of Birth" value={form.dateOfBirth} onChange={(value) => set('dateOfBirth', value)} basis={basis} date />
        <Select label="Gender" value={form.gender} options={options.genders} onChange={(value) => set('gender', value)} basis={basis} />
        <Select label="Blood Group" value={form.bloodGroup || 'B+'} options={['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']} onChange={(value) => set('bloodGroup', value)} basis={basis} />
      </FormCard>
      <FormCard title="3. Parent / Guardian Information" hint="Father, mother and the person we should contact.">
        <Field label="Father / Guardian Name" value={form.fatherName} onChange={(value) => set('fatherName', value)} basis={basis} />
        <Field label="Mother Name" value={form.motherName} onChange={(value) => set('motherName', value)} basis={basis} />
        <Select label="Guardian Relationship" value={form.guardianRelationship} options={options.relationships} onChange={(value) => set('guardianRelationship', value)} basis={basis} />
        <Field label="Contact Phone" value={form.phone} onChange={(value) => set('phone', value)} basis={basis} />
        <Field label="Email Address" value={form.email} onChange={(value) => set('email', value)} basis={basis} />
      </FormCard>
      <FormCard title="4. Residential Address" hint="Current residential address used on the student record.">
        <Field label="Current Address" value={form.address} onChange={(value) => set('address', value)} basis="100%" />
        <Field label="City" value={form.city} onChange={(value) => set('city', value)} basis={basis} />
        <Field label="State" value={form.state} onChange={(value) => set('state', value)} basis={basis} />
        <Field label="Postal Code" value={form.pincode} onChange={(value) => set('pincode', value)} basis={basis} />
      </FormCard>
      <FormCard title="5. Academic History & Evaluation" hint="Previous school, class passed and entrance assessment.">
        <Field label="Previous School" value={form.previousSchool} onChange={(value) => set('previousSchool', value)} basis={basis} />
        <Field label="Previous Class Passed" value={form.previousClass} onChange={(value) => set('previousClass', value)} basis={basis} />
        <Field label="Previous Grade / Score (%)" value={form.previousGrade} onChange={(value) => set('previousGrade', value)} basis={basis} />
        <Field label="Entrance Exam Score (%)" value={form.entranceScore} onChange={(value) => set('entranceScore', value)} basis={basis} />
        <Field label="Admissions Committee Remarks" value={form.remarks} onChange={(value) => set('remarks', value)} basis="100%" />
      </FormCard>
      <FormCard title="6. Mandatory Verification Documents" hint="Document type and verification status. Attach the scan from the student file later.">
        <Select label="Document Type" value={form.documentType} options={options.documents} onChange={(value) => set('documentType', value)} basis={basis} />
        <Field label="Document / Certificate Number" value={form.documentNumber} onChange={(value) => set('documentNumber', value)} basis={basis} />
        <Select label="Verification Status" value={form.verificationStatus} options={options.verification} onChange={(value) => set('verificationStatus', value)} basis={basis} />
      </FormCard>
      {error ? <Text style={{ color: colors.dangerText }}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 }}>
        <Pressable onPress={onCancel} style={[styles.secondaryButton, { minHeight: 40, paddingHorizontal: 14 }]}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable>
        <Pressable disabled={busy} onPress={() => onSave(true)} style={[styles.secondaryButton, { minHeight: 40, paddingHorizontal: 14 }]}><Text style={styles.secondaryButtonText}>{busy ? 'Saving…' : 'Save Draft'}</Text></Pressable>
        <Pressable disabled={busy} onPress={() => onSave(false)} style={[styles.primaryButton, { minHeight: 40, paddingHorizontal: 14 }]}><Text style={styles.primaryButtonText}>{busy ? 'Saving…' : form.id ? 'Save changes' : 'Register Admission Form'}</Text></Pressable>
      </View>
    </ScrollView>
  );
}

function FormCard({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderWidth: 1, borderStyle: 'solid', borderColor: colors.border, borderLeftWidth: 3, borderLeftColor: colors.brand, borderRadius: 16, backgroundColor: colors.surface, padding: 18, gap: 16 }}>
      <View>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>{title}</Text>
        <Text style={{ color: colors.textMuted, marginTop: 4 }}>{hint}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>{children}</View>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, basis, date }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; basis: string; date?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexBasis: basis, flexGrow: 1, gap: 6, minWidth: 180 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      {date ? <DateField value={value} onChange={onChange} /> : <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.textMuted} style={{ minHeight: 44, borderWidth: 1, borderStyle: 'solid', borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, backgroundColor: colors.bg }} />}
    </View>
  );
}

function Select({ label, value, options, onChange, basis }: { label: string; value: string; options: string[]; onChange: (value: string) => void; basis: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexBasis: basis, flexGrow: 1, gap: 6, minWidth: 180 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>{label}</Text>
      {Platform.OS === 'web' ? (
        <select value={value} onChange={(event: { target: { value: string } }) => onChange(event.target.value)} style={{ height: 44, boxSizing: 'border-box', borderRadius: 10, border: `1px solid ${colors.border}`, padding: '0 12px', color: colors.text, background: colors.bg, width: '100%' }}>
          {(value && !options.includes(value) ? [value, ...options] : options).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <TextInput value={value} onChangeText={onChange} style={{ minHeight: 44, borderWidth: 1, borderStyle: 'solid', borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, backgroundColor: colors.bg }} />
      )}
    </View>
  );
}

function ReviewModal({ row, busy, onClose, onStage, onConvert, onEdit }: { row: Application; busy: boolean; onClose: () => void; onStage: (stage: string) => void; onConvert: () => void; onEdit: () => void }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 820;
  const name = [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' ');
  const address = [row.address, row.city, row.state, row.pincode].filter(Boolean).join(', ') || '—';
  const canConvert = row.stage === 'Approved' || row.stage === 'Admitted';
  const locked = busy || row.stage === 'Enrolled';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: compact ? colors.surface : 'rgba(15,23,42,0.45)' }}>
        {compact ? null : <Pressable style={{ flex: 1 }} onPress={onClose} />}
        <View style={{ width: compact ? '100%' : 440, maxWidth: '100%', backgroundColor: colors.surface, borderLeftWidth: compact ? 0 : 1, borderLeftColor: colors.border }}>
          <View style={{ minHeight: 72, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 20, fontWeight: '800' }}>{name}</Text>
              <Text style={{ color: colors.textMuted, marginTop: 2 }}>Application No: {row.applicationNo}</Text>
            </View>
            <Pressable onPress={onEdit} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 8 }}><Text style={{ color: colors.brand, fontWeight: '700' }}>Edit</Text></Pressable>
            <Pressable onPress={onClose} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={22} color={colors.textMuted} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}>
            <ReviewBlock title="1. Application metadata" extra={<StagePill stage={row.stage} />}>
              <ReviewGrid compact={compact} cells={[
                ['Application No', row.applicationNo],
                ['Application Date', row.applicationDate || '—'],
                ['Applying Class', row.applyingClass],
                ['Academic Year', row.academicYear],
                ['Admission Source', row.admissionSource || '—'],
                ['Campus', row.campus || '—'],
              ]} />
            </ReviewBlock>
            <ReviewBlock title="2. Candidate information">
              <ReviewGrid compact={compact} cells={[
                ['Full Candidate Name', name],
                ['Date of Birth', row.dateOfBirth || '—'],
                ['Gender', row.gender || '—'],
                ['Blood Group', row.bloodGroup || '—'],
              ]} />
            </ReviewBlock>
            <ReviewBlock title="3. Parent & guardian">
              <ReviewLine label="Father / Guardian" value={row.fatherName || '—'} />
              <ReviewLine label="Mother" value={row.motherName || '—'} />
              <ReviewLine label="Relationship" value={row.guardianRelationship || '—'} />
              <ReviewLine label="Contact Phone" value={row.phone || '—'} />
              <ReviewLine label="Email" value={row.email || '—'} />
            </ReviewBlock>
            <ReviewBlock title="4. Residential address">
              <Text style={{ color: colors.text, fontWeight: '700' }}>{address}</Text>
            </ReviewBlock>
            <ReviewBlock title="5. Academic history & assessment score">
              <ReviewGrid compact={compact} cells={[
                ['Previous School', row.previousSchool || '—'],
                ['Entrance Score', row.entranceScore ? `${row.entranceScore}%` : '—'],
              ]} emphasize={1} />
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Committee Remarks</Text>
              <Text style={{ color: colors.textSecondary, fontStyle: 'italic' }}>{row.remarks || '—'}</Text>
            </ReviewBlock>
            {row.stage === 'Enrolled' ? <Text style={{ color: colors.successText, fontWeight: '700' }}>Student record #{row.studentId} is provisioned.</Text> : null}
          </ScrollView>
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Pressable disabled={locked} onPress={() => onStage('Approved')} style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.successText, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: locked ? 0.5 : 1 }}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.successText} />
              <Text style={{ color: colors.successText, fontWeight: '700' }}>Approve</Text>
            </Pressable>
            <Pressable disabled={locked} onPress={() => onStage('Rejected')} style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.dangerText, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: locked ? 0.5 : 1 }}>
              <Ionicons name="close-circle-outline" size={16} color={colors.dangerText} />
              <Text style={{ color: colors.dangerText, fontWeight: '700' }}>Reject</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable disabled={locked || !canConvert} onPress={onConvert} style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: canConvert && !locked ? 1 : 0.5 }}>
              <Ionicons name="person-add-outline" size={16} color={colors.onBrand} />
              <Text style={{ color: colors.onBrand, fontWeight: '700' }}>{busy ? 'Working…' : 'Convert to SIS'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ReviewBlock({ title, extra, children }: { title: string; extra?: React.ReactNode; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, gap: 10, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 }}>{title.toUpperCase()}</Text>
        {extra}
      </View>
      {children}
    </View>
  );
}

function ReviewGrid({ cells, compact, emphasize }: { cells: [string, string][]; compact: boolean; emphasize?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {cells.map(([label, value], index) => (
        <View key={label} style={{ flexBasis: compact ? '100%' : '46%', flexGrow: 1, gap: 2 }}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
          <Text style={{ color: emphasize === index ? colors.brand : colors.text, fontWeight: '700' }}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ color: colors.textMuted }}>{label}</Text>
      <Text style={{ color: colors.text, fontWeight: '700', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  );
}
