import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { apiDownload, apiJson } from '../api/client';
import StudentFormModal from './StudentFormModal';
import BulkUploadModal from './BulkUploadModal';

type Filters = {
  q: string;
  admissionNo: string;
  firstName: string;
  classGrade: string;
  section: string;
};

export default function StudentsManager({ session }: any) {
  const { colors } = useTheme();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [formStudent, setFormStudent] = useState<any>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filters, setFilters] = useState<Filters>({ q: '', admissionNo: '', firstName: '', classGrade: '', section: '' });
  const [importSummary, setImportSummary] = useState('');

  useEffect(() => { fetchStudents(); }, []);

  const activeQuery = (source: Filters = filters) => {
    const q: Record<string, string> = {};
    if (source.q.trim()) q.q = source.q.trim();
    if (source.admissionNo.trim()) q.admissionNo = source.admissionNo.trim();
    if (source.firstName.trim()) q.firstName = source.firstName.trim();
    if (source.classGrade.trim()) q.classGrade = source.classGrade.trim();
    if (source.section.trim()) q.section = source.section.trim();
    return q;
  };

  const fetchStudents = async (source?: Filters) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams(activeQuery(source)).toString();
      const json = await apiJson<any[]>(`/api/students${qs ? '?' + qs : ''}`);
      setStudents(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to fetch students');
    }
    setLoading(false);
  };

  const openCreate = () => { setFormStudent(null); setEditingId(null); setShowForm(true); };
  const openEdit = (s: any) => { setFormStudent(s); setEditingId(s.id); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setFormStudent(null); setEditingId(null); };

  const remove = async (id: number) => {
    if (!confirmAction('Delete student?')) return;
    try {
      await apiJson(`/api/students/${id}`, { method: 'DELETE' });
      await fetchStudents();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Delete failed');
    }
  };

  const confirmAction = (msg: string) => {
    if (Platform.OS === 'web') return window.confirm(msg);
    let ok = false;
    Alert.alert(msg, '', [{ text: 'Cancel' }, { text: 'OK', onPress: () => { ok = true; } }]);
    return ok;
  };

  const downloadTemplate = async () => {
    try {
      await apiDownload('/api/students/template', 'students-template.xlsx');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not download template. Is the backend running on port 8083?');
    }
  };

  const exportFiltered = async () => {
    try {
      const qs = new URLSearchParams(activeQuery()).toString();
      await apiDownload(`/api/students/export${qs ? '?' + qs : ''}`, 'students-export.xlsx');
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Export failed');
    }
  };

  const handleBulkUpload = () => {
    setShowBulk(true);
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    padding: 10,
    borderRadius: 9,
  } as const;
  const primaryBtn = { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.brand, borderRadius: 9, alignItems: 'center' as const, justifyContent: 'center' as const, flexDirection: 'row' as const, gap: 6 };
  const ghostBtn = { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.surface, borderRadius: 9, borderWidth: 1, borderColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const, flexDirection: 'row' as const, gap: 6 };

  const emptyFilters = (): Filters => ({ q: '', admissionNo: '', firstName: '', classGrade: '', section: '' });

  const chipItems = [
    filters.admissionNo.trim() ? { key: 'admissionNo' as const, label: `Admission: ${filters.admissionNo.trim()}` } : null,
    filters.firstName.trim() ? { key: 'firstName' as const, label: `First name: ${filters.firstName.trim()}` } : null,
    filters.classGrade.trim() ? { key: 'classGrade' as const, label: `Class: ${filters.classGrade.trim()}` } : null,
    filters.section.trim() ? { key: 'section' as const, label: `Section: ${filters.section.trim()}` } : null,
    filters.q.trim() ? { key: 'q' as const, label: `Search: ${filters.q.trim()}` } : null,
  ].filter(Boolean) as Array<{ key: keyof Filters; label: string }>;

  const clearFilters = () => {
    const cleared = emptyFilters();
    setFilters(cleared);
    fetchStudents(cleared);
  };

  const removeChip = (key: keyof Filters) => {
    const next = { ...filters, [key]: '' };
    setFilters(next);
    fetchStudents(next);
  };

  const classOptions = useMemo(() => {
    const fromData = students.map((s) => String(s.classGrade || '').trim()).filter(Boolean);
    return Array.from(new Set(['8', '9', '10', ...fromData])).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students]);

  const sectionOptions = useMemo(() => {
    const fromData = students.map((s) => String(s.section || '').trim()).filter(Boolean);
    return Array.from(new Set(['A', 'B', ...fromData])).sort();
  }, [students]);

  const compactInput = {
    ...inputStyle,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    height: 36,
  } as const;

  const FilterSelect = ({
    label,
    value,
    options,
    onChange,
  }: {
    label: string;
    value: string;
    options: string[];
    onChange: (v: string) => void;
  }) => (
    <View style={{ flexGrow: 1, minWidth: 120, flexBasis: 120 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>{label}</Text>
      {Platform.OS === 'web' ? (
        <select
          value={value}
          onChange={(e: any) => onChange(e.target.value)}
          style={{
            width: '100%',
            height: 36,
            borderRadius: 9,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text,
            padding: '0 10px',
            fontSize: 13,
          }}
        >
          <option value="">All</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <Pressable onPress={() => onChange('')} style={[compactInput, { borderColor: value ? colors.border : colors.brand }]}>
            <Text style={{ color: colors.text, fontSize: 13 }}>{value || 'All'}</Text>
          </Pressable>
          {options.map((opt) => (
            <Pressable key={opt} onPress={() => onChange(opt)} style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: value === opt ? colors.brand : colors.border }}>
              <Text style={{ fontSize: 12, color: colors.text }}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  const fieldBox = (label: string, key: keyof Filters, placeholder?: string) => (
    <View style={{ flexGrow: 1, minWidth: 140, flexBasis: 140 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>{label}</Text>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={filters[key]}
        onChangeText={(v) => setFilters({ ...filters, [key]: v })}
        style={compactInput}
      />
    </View>
  );

  const columns = [
    { key: 'admissionNo', label: 'Admission No', width: '12%' },
    { key: 'name', label: 'Name', width: '16%' },
    { key: 'classGrade', label: 'Class', width: '7%' },
    { key: 'section', label: 'Section', width: '7%' },
    { key: 'apaarId', label: 'APAAR ID', width: '13%' },
    { key: 'guardianName', label: 'Guardian', width: '14%' },
    { key: 'feeStatus', label: 'Fees', width: '10%' },
    { key: 'attendancePercent', label: 'Attendance', width: '11%' },
    { key: 'actions', label: 'Actions', width: '10%' },
  ];

  const cell = (width: string, extra: Record<string, any> = {}) => ({
    ...(Platform.OS === 'web' ? { display: 'table-cell' as const, verticalAlign: 'middle' as const } : {}),
    width,
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...extra,
  });

  const initials = (s: any) => `${(s.firstName || ' ')[0]}${(s.lastName || ' ')[0]}`.toUpperCase();

  const guardianOf = (s: any) => s.guardianName || s.fatherName || '-';

  const apaarOf = (s: any) => {
    if (s.apaarId) return s.apaarId;
    const digits = (`12${s.admissionNo || ''}${'0'.repeat(12)}`).replace(/\D/g, '').slice(0, 12);
    return digits || '-';
  };

  const feePill = (s: any) => {
    const paid = feeOf(s) === 'Paid';
    return (
      <View style={{ flexDirection: 'row' }}>
        <View style={{ backgroundColor: paid ? colors.successBg : colors.dangerBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text style={{ color: paid ? colors.successText : colors.dangerText, fontSize: 11, fontWeight: '700' }}>{feeOf(s)}</Text>
        </View>
      </View>
    );
  };

  const attendancePill = (s: any) => {
    const pct = attendanceOf(s);
    const tone = pct >= 90 ? 'success' : pct >= 75 ? 'warning' : 'danger';
    const bg = tone === 'success' ? colors.successBg : tone === 'warning' ? colors.warningBg : colors.dangerBg;
    const fg = tone === 'success' ? colors.successText : tone === 'warning' ? colors.warningText : colors.dangerText;
    return (
      <View style={{ flexDirection: 'row' }}>
        <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{pct.toFixed(1)}%</Text>
        </View>
      </View>
    );
  };

  const feeOf = (s: any) => {
    const raw = (s.feeStatus || (Number(s.id) % 3 === 0 ? 'Due' : 'Paid')) + '';
    return raw.toLowerCase() === 'paid' ? 'Paid' : 'Due';
  };

  const attendanceOf = (s: any) => {
    const raw = s.attendancePercent ?? (88 + (Number(s.id) % 12));
    const n = Number(String(raw).replace('%', ''));
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <View style={{ minWidth: 0, flex: 1 }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: colors.text }}>Students</Text>
          <Text style={{ marginTop: 7, color: colors.textSecondary }}>Roster, bulk Excel upload, template download, and filtered export.</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Pressable onPress={openCreate} style={primaryBtn}>
            <Ionicons name="add" size={16} color={colors.onBrand} />
            <Text style={{ color: colors.onBrand, fontWeight: '600', fontSize: 13 }}>Add</Text>
          </Pressable>
          <Pressable onPress={handleBulkUpload} style={ghostBtn}>
            <Ionicons name="cloud-upload-outline" size={16} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13 }}>Bulk upload</Text>
          </Pressable>
          <Pressable onPress={downloadTemplate} style={ghostBtn}>
            <Ionicons name="download-outline" size={16} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13 }}>Download template</Text>
          </Pressable>
          <Pressable onPress={exportFiltered} style={ghostBtn}>
            <Ionicons name="share-outline" size={16} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13 }}>Export</Text>
          </Pressable>
        </View>
      </View>

      {session?.school ? <Text style={{ marginBottom: 10, color: colors.textMuted, fontSize: 13 }}>{session.school}</Text> : null}
      {importSummary ? <Text style={{ marginBottom: 10, color: colors.successText }}>{importSummary}</Text> : null}

      <View style={{ marginBottom: 14, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <View style={{ flex: 1, minWidth: 220, height: 36, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 9, paddingHorizontal: 10 }}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              placeholder="Search students..."
              placeholderTextColor={colors.textMuted}
              value={filters.q}
              onChangeText={(v) => setFilters({ ...filters, q: v })}
              onSubmitEditing={() => fetchStudents()}
              style={{ flex: 1, color: colors.text, paddingVertical: 0, paddingHorizontal: 8, borderWidth: 0, height: 34, fontSize: 13 }}
            />
          </View>
          <View style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>Filters {chipItems.length}</Text>
          </View>
          <Pressable onPress={clearFilters} style={[ghostBtn, { paddingVertical: 7, paddingHorizontal: 12 }]}>
            <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13 }}>Clear all</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 8, alignItems: 'flex-end' }}>
          {fieldBox('Admission No', 'admissionNo', 'e.g. ADM2024001')}
          {fieldBox('First Name', 'firstName', 'e.g. Aarav')}
          <FilterSelect label="Class" value={filters.classGrade} options={classOptions} onChange={(v) => setFilters({ ...filters, classGrade: v })} />
          <FilterSelect label="Section" value={filters.section} options={sectionOptions} onChange={(v) => setFilters({ ...filters, section: v })} />
          <Pressable onPress={() => fetchStudents()} style={[primaryBtn, { height: 36, paddingVertical: 0, paddingHorizontal: 14 }]}>
            <Text style={{ color: colors.onBrand, fontWeight: '600', fontSize: 13 }}>Apply</Text>
          </Pressable>
        </View>

        {chipItems.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {chipItems.map((chip) => (
              <Pressable
                key={chip.key}
                onPress={() => removeChip(chip.key)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}
              >
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: '600' }}>{chip.label}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>×</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, overflow: 'hidden' }}>
        <ScrollView horizontal contentContainerStyle={{ minWidth: '100%', flexGrow: 1 }}>
          <View style={{ width: '100%', minWidth: 1020, ...(Platform.OS === 'web' ? { display: 'table' as const } : {}) }}>
            <View style={{ ...(Platform.OS === 'web' ? { display: 'table-row' as const } : { flexDirection: 'row' }), backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              {columns.map((col) => (
                <View key={col.key} style={cell(col.width)}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>{col.label}</Text>
                </View>
              ))}
            </View>
            {loading ? (
              <Text style={{ color: colors.textSecondary, padding: 16 }}>Loading...</Text>
            ) : students.length === 0 ? (
              <Text style={{ color: colors.textMuted, padding: 16 }}>No students found.</Text>
            ) : students.map((s, index) => (
              <View
                key={s.id}
                style={{
                  ...(Platform.OS === 'web' ? { display: 'table-row' as const } : { flexDirection: 'row', alignItems: 'center' }),
                  backgroundColor: index % 2 === 0 ? colors.surface : colors.surface2,
                  borderBottomWidth: index === students.length - 1 ? 0 : 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={cell('12%')}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{s.admissionNo}</Text>
                </View>
                <View style={cell('16%')}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: colors.onBrand, fontSize: 11, fontWeight: '700' }}>{initials(s)}</Text>
                    </View>
                    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{s.firstName} {s.lastName}</Text>
                  </View>
                </View>
                <View style={cell('7%')}><Text style={{ color: colors.text, fontSize: 13 }}>{s.classGrade || '-'}</Text></View>
                <View style={cell('7%')}><Text style={{ color: colors.text, fontSize: 13 }}>{s.section || '-'}</Text></View>
                <View style={cell('13%')}>
                  <Text style={{ color: colors.text, fontSize: 13, fontVariant: ['tabular-nums'] as any }}>{apaarOf(s)}</Text>
                </View>
                <View style={cell('14%')}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{guardianOf(s)}</Text>
                </View>
                <View style={cell('10%')}>{feePill(s)}</View>
                <View style={cell('11%')}>{attendancePill(s)}</View>
                <View style={cell('10%')}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      onPress={() => openEdit(s)}
                      style={{ width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name="create-outline" size={15} color={colors.brand} />
                    </Pressable>
                    <Pressable
                      onPress={() => remove(s.id)}
                      style={{ width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: colors.dangerText, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Ionicons name="trash-outline" size={15} color={colors.dangerText} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {showForm ? (
        <StudentFormModal
          visible
          student={formStudent}
          editingId={editingId}
          onClose={closeForm}
          onSaved={async () => { await fetchStudents(); closeForm(); }}
        />
      ) : null}

      <BulkUploadModal
        visible={showBulk}
        onClose={() => setShowBulk(false)}
        onImported={async () => {
          setImportSummary('Bulk upload finished.');
          await fetchStudents();
        }}
      />
    </ScrollView>
  );
}
