import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { apiDownload, apiJson } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/tokens';
import BulkUploadModal from './BulkUploadModal';
import { DateField } from './ui/DateField';
import { DataTable, type DataColumn } from './ui/DataTable';

export type StaffMember = {
  id?: number;
  employeeCode: string;
  salutation: string;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  bloodGroup: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  aadhaar: string;
  pan: string;
  department: string;
  designation: string;
  category: string;
  workforce: string;
  campus: string;
  reportingManager: string;
  joiningDate: string;
  employmentType: string;
  status: string;
  qualification: string;
  experienceYears: string;
  emergencyName: string;
  emergencyPhone: string;
  bankAccount: string;
  ifsc: string;
};

type StaffOptions = {
  workforces: string[];
  statuses: string[];
  employmentTypes: string[];
  departments: string[];
  designations: string[];
};

const EMPTY: StaffMember = {
  employeeCode: '',
  salutation: 'Mr.',
  firstName: '',
  middleName: '',
  lastName: '',
  gender: 'Male',
  dateOfBirth: '',
  bloodGroup: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  aadhaar: '',
  pan: '',
  department: 'Mathematics',
  designation: 'Faculty',
  category: 'Faculty',
  workforce: 'Teaching',
  campus: 'Main Campus',
  reportingManager: 'Principal',
  joiningDate: '2026-10-18',
  employmentType: 'Full Time',
  status: 'Active',
  qualification: '',
  experienceYears: '',
  emergencyName: '',
  emergencyPhone: '',
  bankAccount: '',
  ifsc: '',
};

function displayName(staff: StaffMember) {
  return [staff.salutation, staff.firstName, staff.middleName, staff.lastName].filter(Boolean).join(' ');
}

function initials(staff: StaffMember) {
  return `${staff.firstName?.[0] || ''}${staff.lastName?.[0] || ''}`.toUpperCase() || 'ST';
}

type StaffFilters = {
  query: string;
  campus: string;
  department: string;
  designation: string;
  category: string;
  status: string;
};

const emptyStaffFilters = (): StaffFilters => ({
  query: '',
  campus: '',
  department: '',
  designation: '',
  category: '',
  status: '',
});

export function StaffDashboardSummary() {
  const { colors } = useTheme();
  const [staff, setStaff] = useState<StaffMember[]>([]);

  useEffect(() => {
    apiJson<StaffMember[]>('/api/staff').then(setStaff).catch(() => setStaff([]));
  }, []);

  return (
    <View style={{ marginTop: 18 }}>
      <StaffHeading colors={colors} staff={staff} />
    </View>
  );
}

function StaffHeading({
  colors,
  staff,
  onImport,
  onAdd,
  onAssignments,
  showCards = true,
}: {
  colors: ThemeColors;
  staff: StaffMember[];
  onImport?: () => void;
  onAdd?: () => void;
  onAssignments?: () => void;
  showCards?: boolean;
}) {
  const teaching = staff.filter((item) => item.workforce === 'Teaching').length;
  const support = staff.filter((item) => item.workforce === 'Support').length;
  const active = staff.filter((item) => item.status === 'Active').length;
  const review = staff.filter((item) => item.status === 'Probation' || item.status === 'Notice').length;

  return (
    <View>
      {onImport && onAdd ? (
        <View style={{ width: '100%', flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <GhostButton colors={colors} label="Import / Export" onPress={onImport} />
          {onAssignments ? <GhostButton colors={colors} label="Teaching Assignments" onPress={onAssignments} /> : null}
          <GhostButton colors={colors} label="Reports" onPress={() => apiDownload('/api/staff/export', 'staff-directory.csv').catch(() => Alert.alert('Export failed'))} />
          <PrimaryButton colors={colors} label="+ Add Staff Member" onPress={onAdd} />
        </View>
      ) : null}
      {showCards ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
          <Stat colors={colors} label="Total Staff" value={String(staff.length)} detail="Institutional workforce" />
          <Stat colors={colors} label="Active Workforce" value={String(active)} detail="On duty" tone="success" />
          <Stat colors={colors} label="Academic Teaching" value={String(teaching)} detail="Faculty members" />
          <Stat colors={colors} label="Support & Non-Teaching" value={String(support)} detail="Admin, transport & ops" />
          <Stat colors={colors} label="Probation / Notice" value={String(review)} detail="Under review" tone="warning" />
        </View>
      ) : null}
    </View>
  );
}

export default function StaffDirectory() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const pagePad = width < 820 ? 12 : 24;
  const route = useRoute<any>();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [options, setOptions] = useState<StaffOptions | null>(null);
  const [campuses, setCampuses] = useState<string[]>(['Main Campus']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'all' | 'Teaching' | 'Support'>('all');
  const [draft, setDraft] = useState<StaffFilters>(emptyStaffFilters);
  const [applied, setApplied] = useState<StaffFilters>(emptyStaffFilters);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const [people, opts, branches] = await Promise.all([
      apiJson<StaffMember[]>('/api/staff'),
      apiJson<StaffOptions>('/api/staff/options'),
      apiJson<{ name: string }[]>('/api/academics/campuses').catch(() => []),
    ]);
    setStaff(people);
    setOptions(opts);
    const names = branches.map((item) => item.name.replace(/\s*\(.*\)\s*$/, '').trim() || item.name);
    setCampuses(Array.from(new Set(['Main Campus', ...names, ...people.map((item) => item.campus).filter(Boolean)])));
  };

  useEffect(() => {
    load()
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load staff.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (route.params?.create) setCreating(true);
  }, [route.params?.create]);

  const filtered = useMemo(() => {
    const needle = applied.query.trim().toLowerCase();
    return staff.filter((item) => {
      if (tab !== 'all' && item.workforce !== tab) return false;
      if (applied.campus && item.campus !== applied.campus) return false;
      if (applied.department && item.department !== applied.department) return false;
      if (applied.designation && item.designation !== applied.designation) return false;
      if (applied.category && item.category !== applied.category) return false;
      if (applied.status && item.status !== applied.status) return false;
      if (!needle) return true;
      return [displayName(item), item.employeeCode, item.email, item.phone].join(' ').toLowerCase().includes(needle);
    });
  }, [staff, tab, applied]);

  const teaching = staff.filter((item) => item.workforce === 'Teaching').length;
  const support = staff.filter((item) => item.workforce === 'Support').length;

  const remove = async (item: StaffMember) => {
    const ok = typeof window !== 'undefined' ? window.confirm(`Remove ${displayName(item)} from the directory?`) : true;
    if (!ok || !item.id) return;
    try {
      await apiJson(`/api/staff/${item.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete staff member.');
    }
  };

  if (creating || editing) {
    return (
      <StaffForm
        colors={colors}
        initial={editing || { ...EMPTY, campus: campuses[0] || 'Main Campus' }}
        options={options}
        campuses={campuses}
        onCancel={() => { setCreating(false); setEditing(null); }}
        onSaved={async () => {
          setCreating(false);
          setEditing(null);
          await load();
        }}
      />
    );
  }

  const columns: DataColumn<StaffMember>[] = [
    {
      key: 'name',
      header: 'Employee Name & Code',
      flex: 1.5,
      minWidth: 250,
      render: (item) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 12 }}>{initials(item)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700' }}>{displayName(item)}</Text>
            <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12 }}>{item.employeeCode}</Text>
          </View>
        </View>
      ),
    },
    { key: 'department', header: 'Department', minWidth: 140, render: (item) => <CellText colors={colors}>{item.department}</CellText> },
    { key: 'designation', header: 'Designation', minWidth: 190, render: (item) => <CellText colors={colors}>{item.designation}</CellText> },
    { key: 'campus', header: 'Campus', minWidth: 130, render: (item) => <CellText colors={colors}>{item.campus}</CellText> },
    { key: 'status', header: 'Status', width: 104, render: (item) => <StatusPill colors={colors} status={item.status} /> },
    { key: 'tenure', header: 'Tenure', width: 108, render: (item) => <CellText colors={colors} muted>{item.employmentType}</CellText> },
    { key: 'phone', header: 'Mobile Phone', minWidth: 156, render: (item) => <CellText colors={colors}>{item.phone || '—'}</CellText> },
    { key: 'email', header: 'Official Email', minWidth: 210, render: (item) => <CellText colors={colors} muted>{item.email || '—'}</CellText> },
    { key: 'joining', header: 'Joining Date', width: 124, render: (item) => <CellText colors={colors}>{item.joiningDate || '—'}</CellText> },
    { key: 'manager', header: 'Reporting Manager', minWidth: 160, render: (item) => <CellText colors={colors}>{item.reportingManager || '—'}</CellText> },
    {
      key: 'actions',
      header: '',
      width: 64,
      render: (item) => (
        <View style={{ flexDirection: 'row' }}>
          <Pressable onPress={() => setEditing(item)} hitSlop={6}><Ionicons name="pencil-outline" size={16} color={colors.textMuted} /></Pressable>
          <Pressable onPress={() => remove(item)} hitSlop={6} style={{ marginLeft: 8 }}><Ionicons name="trash-outline" size={16} color={colors.dangerText} /></Pressable>
        </View>
      ),
    },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: pagePad, paddingBottom: 48 }}>
      <StaffHeading colors={colors} staff={staff} showCards={false} onImport={() => setBulkOpen(true)} onAdd={() => setCreating(true)} onAssignments={() => navigation.navigate('Teaching Assignments')} />

      {error ? <Text style={{ marginTop: 12, color: colors.dangerText }}>{error}</Text> : null}

      <View style={{ marginTop: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {([
            ['all', `All Personnel (${staff.length})`],
            ['Teaching', `Teaching Faculty (${teaching})`],
            ['Support', `Support & Non-Teaching (${support})`],
          ] as const).map(([id, label]) => (
            <Pressable key={id} onPress={() => setTab(id)} style={{ backgroundColor: tab === id ? colors.brand : colors.surface2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ color: tab === id ? colors.onBrand : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <TextInput
            value={draft.query}
            onChangeText={(query) => setDraft((current) => ({ ...current, query }))}
            placeholder="Search by name, employee code, or email"
            placeholderTextColor={colors.textMuted}
            style={{ flexGrow: 1, flexBasis: width < 820 ? '100%' : 220, minWidth: width < 820 ? 0 : 220, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: colors.text }}
          />
          <Filter colors={colors} value={draft.campus} onChange={(campus) => setDraft((current) => ({ ...current, campus }))} options={campuses} placeholder="All Campuses" />
          <Filter colors={colors} value={draft.department} onChange={(department) => setDraft((current) => ({ ...current, department }))} options={options?.departments || []} placeholder="All Departments" />
          <Filter colors={colors} value={draft.designation} onChange={(designation) => setDraft((current) => ({ ...current, designation }))} options={options?.designations || []} placeholder="All Designations" />
          <Filter colors={colors} value={draft.category} onChange={(category) => setDraft((current) => ({ ...current, category }))} options={Array.from(new Set(staff.map((item) => item.category).filter(Boolean)))} placeholder="All Categories" />
          <Filter colors={colors} value={draft.status} onChange={(status) => setDraft((current) => ({ ...current, status }))} options={options?.statuses || []} placeholder="All Statuses" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <GhostButton colors={colors} label="Clear" onPress={() => { const next = emptyStaffFilters(); setDraft(next); setApplied(next); }} />
            <PrimaryButton colors={colors} label="Apply" onPress={() => setApplied(draft)} />
          </View>
        </View>
      </View>

      <View style={{ marginTop: 14 }}>
        {loading ? <ActivityIndicator color={colors.brand} /> : (
          <DataTable
            columns={columns}
            rows={filtered}
            keyExtractor={(item) => String(item.id)}
            empty="No staff match these filters."
            renderCard={(item) => (
              <StaffCard
                item={item}
                colors={colors}
                compact={width < 820}
                onEdit={() => setEditing(item)}
                onRemove={() => remove(item)}
              />
            )}
          />
        )}
      </View>

      <BulkUploadModal
        visible={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onImported={load}
        title="Import / Export"
        description="Download the current staff directory, or upload the Traavo template to add people. Required columns are EmployeeCode, FirstName, LastName, Department, Designation, Category, Phone, Email, Campus, JoiningDate, and EmploymentType."
        templatePath="/api/staff/template"
        templateFilename="Traavo_Staff_Bulk_Import_Template.csv"
        uploadPath="/api/staff/bulk-upload"
        exportPath="/api/staff/export"
        exportFilename="staff-directory.csv"
        accept=".csv,text/csv"
        acceptedLabel="Accepted: Traavo_Staff_Bulk_Import_Template.csv"
      />
    </ScrollView>
  );
}

function StaffForm({
  colors,
  initial,
  options,
  campuses,
  onCancel,
  onSaved,
}: {
  colors: ThemeColors;
  initial: StaffMember;
  options: StaffOptions | null;
  campuses: string[];
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const { width } = useWindowDimensions();
  const pagePad = width < 820 ? 12 : 24;
  const [form, setForm] = useState<StaffMember>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key: keyof StaffMember, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const body = { ...form, category: form.category || form.department };
      if (form.id) await apiJson(`/api/staff/${form.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await apiJson('/api/staff', { method: 'POST', body: JSON.stringify(body) });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save staff member.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: pagePad, paddingBottom: 64 }}>
      {error ? <Text style={{ color: colors.dangerText, marginTop: 12 }}>{error}</Text> : null}

      <FormCard colors={colors} title="1. Personal identification" subtitle="Name, employee code, and personal details">
        <Field label="Salutation" colors={colors}><Select colors={colors} value={form.salutation} options={['Mr.', 'Mrs.', 'Ms.', 'Dr.']} onChange={(value) => set('salutation', value)} /></Field>
        <Field label="First name" required colors={colors}><Input colors={colors} value={form.firstName} onChangeText={(value) => set('firstName', value)} /></Field>
        <Field label="Middle name" colors={colors}><Input colors={colors} value={form.middleName} onChangeText={(value) => set('middleName', value)} /></Field>
        <Field label="Last name" colors={colors}><Input colors={colors} value={form.lastName} onChangeText={(value) => set('lastName', value)} /></Field>
        <Field label="Employee code" required colors={colors}><Input colors={colors} value={form.employeeCode} autoCapitalize="characters" placeholder="ERP-T-001" onChangeText={(value) => set('employeeCode', value)} /></Field>
        <Field label="Gender" colors={colors}><Select colors={colors} value={form.gender} options={['Male', 'Female', 'Other']} onChange={(value) => set('gender', value)} /></Field>
        <Field label="Date of birth" colors={colors}><DateField value={form.dateOfBirth} onChange={(value) => set('dateOfBirth', value)} /></Field>
        <Field label="Blood group" colors={colors}><Input colors={colors} value={form.bloodGroup} placeholder="B+" onChangeText={(value) => set('bloodGroup', value)} /></Field>
      </FormCard>

      <FormCard colors={colors} title="2. Contact & address" subtitle="Official phone, email, and correspondence address">
        <Field label="Mobile phone" colors={colors}><Input colors={colors} value={form.phone} placeholder="+91 98111 22334" onChangeText={(value) => set('phone', value)} /></Field>
        <Field label="Official email" colors={colors}><Input colors={colors} value={form.email} placeholder="name@traavo.edu" onChangeText={(value) => set('email', value)} /></Field>
        <Field label="Address" colors={colors} wide><Input colors={colors} value={form.address} onChangeText={(value) => set('address', value)} /></Field>
        <Field label="City" colors={colors}><Input colors={colors} value={form.city} onChangeText={(value) => set('city', value)} /></Field>
        <Field label="State" colors={colors}><Input colors={colors} value={form.state} onChangeText={(value) => set('state', value)} /></Field>
        <Field label="PIN code" colors={colors}><Input colors={colors} value={form.pincode} onChangeText={(value) => set('pincode', value)} /></Field>
      </FormCard>

      <FormCard colors={colors} title="3. Statutory compliance" subtitle="Identity numbers used for payroll and records">
        <Field label="Aadhaar" colors={colors}><Input colors={colors} value={form.aadhaar} onChangeText={(value) => set('aadhaar', value)} /></Field>
        <Field label="PAN" colors={colors}><Input colors={colors} value={form.pan} autoCapitalize="characters" onChangeText={(value) => set('pan', value)} /></Field>
      </FormCard>

      <FormCard colors={colors} title="4. Role, campus & reporting" subtitle="Department, designation, and who this person reports to">
        <Field label="Workforce" required colors={colors}><Select colors={colors} value={form.workforce} options={['Teaching', 'Support']} onChange={(value) => set('workforce', value)} /></Field>
        <Field label="Department" required colors={colors}><Select colors={colors} value={form.department} options={options?.departments || []} onChange={(value) => set('department', value)} /></Field>
        <Field label="Designation" required colors={colors}><Select colors={colors} value={form.designation} options={options?.designations || []} onChange={(value) => set('designation', value)} /></Field>
        <Field label="Category" colors={colors}><Input colors={colors} value={form.category} placeholder="Faculty" onChangeText={(value) => set('category', value)} /></Field>
        <Field label="Campus" required colors={colors}><Select colors={colors} value={form.campus} options={campuses} onChange={(value) => set('campus', value)} /></Field>
        <Field label="Reporting manager" colors={colors}><Input colors={colors} value={form.reportingManager} onChangeText={(value) => set('reportingManager', value)} /></Field>
      </FormCard>

      <FormCard colors={colors} title="5. Employment" subtitle="Joining date, tenure, and current status">
        <Field label="Joining date" colors={colors}><DateField value={form.joiningDate} onChange={(value) => set('joiningDate', value)} /></Field>
        <Field label="Employment type" colors={colors}><Select colors={colors} value={form.employmentType} options={options?.employmentTypes || ['Full Time']} onChange={(value) => set('employmentType', value)} /></Field>
        <Field label="Status" colors={colors}><Select colors={colors} value={form.status} options={options?.statuses || ['Active']} onChange={(value) => set('status', value)} /></Field>
        <Field label="Highest qualification" colors={colors}><Input colors={colors} value={form.qualification} placeholder="M.Sc. Mathematics" onChangeText={(value) => set('qualification', value)} /></Field>
        <Field label="Experience (years)" colors={colors}><Input colors={colors} value={form.experienceYears} keyboardType="number-pad" onChangeText={(value) => set('experienceYears', value.replace(/[^\d.]/g, ''))} /></Field>
      </FormCard>

      <FormCard colors={colors} title="6. Emergency contact & bank" subtitle="Used for records and payroll setup">
        <Field label="Emergency contact" colors={colors}><Input colors={colors} value={form.emergencyName} onChangeText={(value) => set('emergencyName', value)} /></Field>
        <Field label="Emergency phone" colors={colors}><Input colors={colors} value={form.emergencyPhone} onChangeText={(value) => set('emergencyPhone', value)} /></Field>
        <Field label="Bank account" colors={colors}><Input colors={colors} value={form.bankAccount} onChangeText={(value) => set('bankAccount', value)} /></Field>
        <Field label="IFSC" colors={colors}><Input colors={colors} value={form.ifsc} autoCapitalize="characters" onChangeText={(value) => set('ifsc', value)} /></Field>
      </FormCard>

      <View style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <Pressable onPress={onCancel} style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
        </Pressable>
        <PrimaryButton colors={colors} label={busy ? 'Saving...' : form.id ? 'Save changes' : 'Save staff member'} onPress={save} disabled={busy} />
      </View>
    </ScrollView>
  );
}

function FormCard({ colors, title, subtitle, children }: { colors: ThemeColors; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 }}>
      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{title}</Text>
      <Text style={{ color: colors.textMuted, marginTop: 2, marginBottom: 12 }}>{subtitle}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{children}</View>
    </View>
  );
}

function Field({ label, required, colors, children, wide }: { label: string; required?: boolean; colors: ThemeColors; children: React.ReactNode; wide?: boolean }) {
  const { width } = useWindowDimensions();
  const stacked = wide || width < 820;
  return (
    <View style={{ width: stacked ? '100%' : '31%', minWidth: stacked ? 0 : 180, flexGrow: 1 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>{label}{required ? ' *' : ''}</Text>
      {children}
    </View>
  );
}

function Input({ colors, value, onChangeText, placeholder, autoCapitalize, keyboardType }: { colors: ThemeColors; value: string; onChangeText: (value: string) => void; placeholder?: string; autoCapitalize?: 'none' | 'characters'; keyboardType?: 'default' | 'number-pad' }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      autoCapitalize={autoCapitalize || 'sentences'}
      autoCorrect={false}
      keyboardType={keyboardType}
      style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, minHeight: 40, paddingHorizontal: 12, paddingVertical: Platform.OS === 'web' ? 10 : 8, color: colors.text, backgroundColor: colors.surface }}
    />
  );
}

function Select({ colors, value, options, onChange }: { colors: ThemeColors; value: string; options: string[]; onChange: (value: string) => void }) {
  const choices = value && !options.includes(value) ? [value, ...options] : options;
  if (Platform.OS === 'web') {
    return React.createElement('select', {
      value,
      onChange: (event: { target: { value: string } }) => onChange(event.target.value),
      style: { width: '100%', border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, borderRadius: 10, padding: '10px 12px', fontSize: 14 },
    }, choices.map((option) => React.createElement('option', { key: option, value: option }, option)));
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {choices.map((option) => (
        <Pressable key={option} onPress={() => onChange(option)} style={{ borderWidth: 1, borderColor: option === value ? colors.brand : colors.border, backgroundColor: option === value ? colors.brand : colors.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: option === value ? colors.onBrand : colors.text, fontSize: 12 }}>{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Filter({ colors, value, options, onChange, placeholder }: { colors: ThemeColors; value: string; options: string[]; onChange: (value: string) => void; placeholder: string }) {
  const { width } = useWindowDimensions();
  const compact = width < 820;
  const choices = [{ value: '', label: placeholder }, ...options.map((option) => ({ value: option, label: option }))];
  if (Platform.OS === 'web') {
    return (
      <View style={{ flexGrow: 1, flexBasis: compact ? '100%' : 150, minWidth: compact ? 0 : 140, width: compact ? '100%' : undefined }}>
        {React.createElement('select', {
          value,
          onChange: (event: { target: { value: string } }) => onChange(event.target.value),
          style: { width: '100%', height: 40, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, borderRadius: 10, padding: '0 10px', fontSize: 13, fontFamily: 'Inter, -apple-system, sans-serif' },
        }, choices.map((option) => React.createElement('option', { key: option.label, value: option.value }, option.label)))}
      </View>
    );
  }
  return (
    <Pressable onPress={() => onChange('')} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
      <Text style={{ color: colors.text }}>{value || placeholder}</Text>
    </Pressable>
  );
}

function Stat({ colors, label, value, detail, tone }: { colors: ThemeColors; label: string; value: string; detail: string; tone?: 'success' | 'warning' }) {
  const { width } = useWindowDimensions();
  const color = tone === 'success' ? colors.successText : tone === 'warning' ? colors.warningText : colors.text;
  return (
    <View style={{ flexGrow: 1, flexBasis: width < 820 ? '100%' : 160, minWidth: width < 820 ? 0 : 160, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 }}>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color, fontSize: 28, fontWeight: '700', marginTop: 4 }}>{value}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{detail}</Text>
    </View>
  );
}

function CellText({ colors, children, muted }: { colors: ThemeColors; children: string; muted?: boolean }) {
  return (
    <Text numberOfLines={2} style={{ color: muted ? colors.textSecondary : colors.text, lineHeight: 18 }}>
      {children}
    </Text>
  );
}

function StatusPill({ colors, status }: { colors: ThemeColors; status: string }) {
  const active = status === 'Active';
  const warn = status === 'Probation' || status === 'Notice';
  const color = active ? colors.successText : warn ? colors.warningText : colors.textSecondary;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: active ? colors.successBg : warn ? colors.warningBg : colors.surface2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{status.toUpperCase()}</Text>
    </View>
  );
}

function prettyDate(value: string) {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StaffCard({
  item,
  colors,
  compact,
  onEdit,
  onRemove,
}: {
  item: StaffMember;
  colors: ThemeColors;
  compact: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const groups: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; rows: [string, string][] }[] = [
    { icon: 'business-outline', title: 'Employment', rows: [['Department', item.department || '—'], ['Designation', item.designation || '—']] },
    { icon: 'location-outline', title: 'Work Details', rows: [['Campus', item.campus || '—'], ['Employment Type', item.employmentType || '—']] },
    { icon: 'call-outline', title: 'Contact', rows: [['Phone', item.phone || '—'], ['Email', item.email || '—']] },
    { icon: 'people-outline', title: 'Reporting & Tenure', rows: [['Reporting Manager', item.reportingManager || '—'], ['Joining Date', prettyDate(item.joiningDate)]] },
  ];

  return (
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.onBrand, fontWeight: '700', fontSize: 15 }}>{initials(item)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          {compact ? (
            <>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{displayName(item)}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{item.employeeCode}</Text>
              <View style={{ marginTop: 6 }}><StatusPill colors={colors} status={item.status} /></View>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700', fontSize: 16, flexShrink: 1 }}>{displayName(item)}</Text>
                <StatusPill colors={colors} status={item.status} />
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{item.employeeCode}</Text>
            </>
          )}
        </View>
        <Pressable onPress={onEdit} hitSlop={8} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
        </Pressable>
        <Pressable onPress={onRemove} hitSlop={8} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="trash-outline" size={18} color={colors.dangerText} />
        </Pressable>
      </View>
      <View style={{ height: 1, backgroundColor: colors.border, marginTop: 14, marginBottom: 14 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 16, columnGap: 12 }}>
        {groups.map((group) => (
          <View key={group.title} style={{ flexGrow: 1, flexBasis: compact ? '46%' : 200, minWidth: compact ? '46%' : 180 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={group.icon} size={14} color={colors.textSecondary} />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{group.title}</Text>
            </View>
            {group.rows.map(([label, value]) => (
              <View key={label} style={{ marginBottom: 8 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, marginTop: 2 }}>{value}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function PrimaryButton({ colors, label, onPress, disabled }: { colors: ThemeColors; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ minHeight: 40, justifyContent: 'center', backgroundColor: colors.brand, opacity: disabled ? 0.7 : 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 }}>
      <Text style={{ color: colors.onBrand, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function GhostButton({ colors, label, onPress }: { colors: ThemeColors; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
      <Text style={{ color: colors.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
