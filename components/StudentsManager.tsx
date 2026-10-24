import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Platform, Alert, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { DataTable } from './ui/DataTable';
import { loadAcademicSetup } from '../api/academicSetup';
import { apiDownload, apiJson } from '../api/client';
import BulkUploadModal from './BulkUploadModal';

type Filters = {
  q: string;
  admissionNo: string;
  firstName: string;
  classGrade: string;
  section: string;
};

function FilterSelect({
  label,
  value,
  options,
  onChange,
  colors,
  compact,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  colors: { textSecondary: string; border: string; surface: string; text: string; brand: string };
  compact?: boolean;
}) {
  return (
    <View style={{ flexGrow: 1, minWidth: compact ? 0 : 120, flexBasis: compact ? '100%' : 120, width: compact ? '100%' : undefined }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 }}>{label}</Text>
      {Platform.OS === 'web' ? (
        <select
          value={value}
          onChange={(event: { target: { value: string } }) => onChange(event.target.value)}
          style={{
            width: '100%',
            height: 40,
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
          <Pressable onPress={() => onChange('')} style={{ borderWidth: 1, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, borderColor: value ? colors.border : colors.brand }}>
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
}

export default function StudentsManager({ session }: { session?: { school?: string } }) {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const compact = width < 820;
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBulk, setShowBulk] = useState(false);
  const [filters, setFilters] = useState<Filters>({ q: '', admissionNo: '', firstName: '', classGrade: '', section: '' });
  const [academicClasses, setAcademicClasses] = useState<string[]>([]);
  const [academicSections, setAcademicSections] = useState<string[]>([]);
  const [importSummary, setImportSummary] = useState('');
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const activeQuery = (source: Filters = filters) => {
    const q: Record<string, string> = {};
    if (source.q.trim()) q.q = source.q.trim();
    if (source.admissionNo.trim()) q.admissionNo = source.admissionNo.trim();
    if (source.firstName.trim()) q.firstName = source.firstName.trim();
    if (source.classGrade.trim()) q.classGrade = source.classGrade.trim();
    if (source.section.trim()) q.section = source.section.trim();
    return q;
  };

  const fetchStudents = useCallback(async (source?: Filters) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams(activeQuery(source ?? filtersRef.current)).toString();
      const json = await apiJson<any[]>(`/api/students${qs ? '?' + qs : ''}`);
      setStudents(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to fetch students');
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    fetchStudents(filtersRef.current);
    loadAcademicSetup()
      .then((data) => {
        setAcademicClasses(data.classes.map((item) => item.name));
        setAcademicSections(data.sections.map((item) => item.name));
      })
      .catch(() => undefined);
  }, [fetchStudents]));

  const openCreate = () => navigation.navigate('Student Form', { student: null, editingId: null });
  const openEdit = (s: any) => navigation.navigate('Student Form', { student: s, editingId: s.id });

  const remove = async (id: number) => {
    if (!(await confirmAction('Delete student?'))) return;
    try {
      await apiJson(`/api/students/${id}`, { method: 'DELETE' });
      await fetchStudents();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Delete failed');
    }
  };

  const confirmAction = async (msg: string) => {
    if (Platform.OS === 'web') return window.confirm(msg);
    return await new Promise<boolean>((resolve) => {
      Alert.alert(msg, '', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'OK', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
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
  const primaryBtn = { minHeight: 40, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.brand, borderRadius: 9, alignItems: 'center' as const, justifyContent: 'center' as const, flexDirection: 'row' as const, gap: 6 };
  const ghostBtn = { minHeight: 40, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.surface, borderRadius: 9, borderWidth: 1, borderColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const, flexDirection: 'row' as const, gap: 6 };

  const emptyFilters = (): Filters => ({ q: '', admissionNo: '', firstName: '', classGrade: '', section: '' });

  const chipItems = [
    filters.admissionNo.trim() ? { key: 'admissionNo' as const, label: `Admission: ${filters.admissionNo.trim()}` } : null,
    filters.firstName.trim() ? { key: 'firstName' as const, label: `First name: ${filters.firstName.trim()}` } : null,
    filters.classGrade.trim() ? { key: 'classGrade' as const, label: `Class: ${filters.classGrade.trim()}` } : null,
    filters.section.trim() ? { key: 'section' as const, label: `Section: ${filters.section.trim()}` } : null,
    filters.q.trim() ? { key: 'q' as const, label: `Search: ${filters.q.trim()}` } : null,
  ].filter((item): item is { key: keyof Filters; label: string } => item !== null);

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
    return Array.from(new Set([...academicClasses, ...fromData])).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students, academicClasses]);

  const sectionOptions = useMemo(() => {
    const fromData = students.map((s) => String(s.section || '').trim()).filter(Boolean);
    return Array.from(new Set([...academicSections, ...fromData])).sort();
  }, [students, academicSections]);

  const compactInput = {
    ...inputStyle,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    height: 36,
  } as const;

  const fieldBox = (label: string, key: keyof Filters, placeholder?: string) => (
    <View style={{ flexGrow: 1, minWidth: compact ? 0 : 140, flexBasis: compact ? '100%' : 140, width: compact ? '100%' : undefined }}>
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
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg, padding: compact ? 12 : 16 }} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <Pressable onPress={openCreate} style={primaryBtn}>
            <Ionicons name="add" size={16} color={colors.onBrand} />
            <Text style={{ color: colors.onBrand, fontWeight: '600', fontSize: 13 }}>Add</Text>
          </Pressable>
          <Pressable onPress={handleBulkUpload} style={ghostBtn}>
            <Ionicons name="cloud-upload-outline" size={16} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13 }}>Bulk upload</Text>
          </Pressable>
          <Pressable onPress={exportFiltered} style={ghostBtn}>
            <Ionicons name="share-outline" size={16} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13 }}>Export</Text>
          </Pressable>
      </View>

      {session?.school ? <Text style={{ marginBottom: 10, color: colors.textMuted, fontSize: 13 }}>{session.school}</Text> : null}
      {importSummary ? <Text style={{ marginBottom: 10, color: colors.successText }}>{importSummary}</Text> : null}

      <View style={{ marginBottom: 14, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <View style={{ flex: 1, minWidth: 0, flexBasis: compact ? '100%' : 180, width: compact ? '100%' : undefined, height: 40, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 9, paddingHorizontal: 10 }}>
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
          <FilterSelect label="Class" value={filters.classGrade} options={classOptions} colors={colors} compact={compact} onChange={(v) => setFilters({ ...filters, classGrade: v })} />
          <FilterSelect label="Section" value={filters.section} options={sectionOptions} colors={colors} compact={compact} onChange={(v) => setFilters({ ...filters, section: v })} />
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

      <DataTable
        rows={students}
        loading={loading}
        empty="No students found."
        keyExtractor={(student) => String(student.id)}
        renderCard={(student) => (
          <StudentCard
            student={student}
            colors={colors}
            initials={initials(student)}
            admissionNo={student.admissionNo || '—'}
            classGrade={student.classGrade || '—'}
            section={student.section || '—'}
            apaar={apaarOf(student)}
            guardian={guardianOf(student)}
            phone={student.fatherMobile || student.guardianPhone || '—'}
            fee={feeOf(student)}
            attendance={`${attendanceOf(student).toFixed(1)}%`}
            onEdit={() => openEdit(student)}
            onRemove={() => remove(student.id)}
          />
        )}
        columns={[
          { key: 'admissionNo', header: 'Admission No', flex: 1.1, minWidth: 120, render: (student) => <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{student.admissionNo}</Text> },
          { key: 'name', header: 'Name', flex: 1.7, minWidth: 180, render: (student) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.onBrand, fontSize: 11, fontWeight: '700' }}>{initials(student)}</Text>
              </View>
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1 }}>{student.firstName} {student.lastName}</Text>
            </View>
          ) },
          { key: 'class', header: 'Class', flex: 0.7, minWidth: 72, render: (student) => <Text style={{ color: colors.text, fontSize: 13 }}>{student.classGrade || '-'}</Text> },
          { key: 'section', header: 'Section', flex: 0.8, minWidth: 80, render: (student) => <Text style={{ color: colors.text, fontSize: 13 }}>{student.section || '-'}</Text> },
          { key: 'apaar', header: 'APAAR ID', flex: 1.2, minWidth: 130, render: (student) => <Text style={{ color: colors.text, fontSize: 13 }}>{apaarOf(student)}</Text> },
          { key: 'guardian', header: 'Guardian', flex: 1.3, minWidth: 130, render: (student) => <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{guardianOf(student)}</Text> },
          { key: 'fees', header: 'Fees', flex: 0.8, minWidth: 84, render: (student) => feePill(student) },
          { key: 'attendance', header: 'Attendance', flex: 1, minWidth: 110, render: (student) => attendancePill(student) },
          { key: 'actions', header: 'Actions', width: 76, render: (student) => (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable onPress={() => openEdit(student)} style={{ width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="create-outline" size={15} color={colors.brand} />
              </Pressable>
              <Pressable onPress={() => remove(student.id)} style={{ width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: colors.dangerText, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="trash-outline" size={15} color={colors.dangerText} />
              </Pressable>
            </View>
          ) },
        ]}
      />

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

function StudentCard({
  student,
  colors,
  initials,
  admissionNo,
  classGrade,
  section,
  apaar,
  guardian,
  phone,
  fee,
  attendance,
  onEdit,
  onRemove,
}: {
  student: { firstName?: string; lastName?: string };
  colors: { surface: string; border: string; brand: string; onBrand: string; text: string; textMuted: string; textSecondary: string; surface2: string; successText: string; successBg: string; dangerText: string; dangerBg: string; warningText: string; warningBg: string };
  initials: string;
  admissionNo: string;
  classGrade: string;
  section: string;
  apaar: string;
  guardian: string;
  phone: string;
  fee: string;
  attendance: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const paid = fee === 'Paid';
  const attendanceValue = Number(attendance.replace('%', ''));
  const attendanceTone = attendanceValue >= 90 ? 'success' : attendanceValue >= 75 ? 'warning' : 'danger';
  const attendanceColor = attendanceTone === 'success' ? colors.successText : attendanceTone === 'warning' ? colors.warningText : colors.dangerText;
  const groups: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; rows: [string, string][] }[] = [
    { icon: 'school-outline', title: 'Academics', rows: [['Class', classGrade], ['Section', section]] },
    { icon: 'card-outline', title: 'Identity', rows: [['APAAR ID', apaar], ['Admission No', admissionNo]] },
    { icon: 'people-outline', title: 'Guardian', rows: [['Guardian', guardian], ['Phone', phone]] },
    { icon: 'cash-outline', title: 'Fees & Attendance', rows: [['Fee Status', fee], ['Attendance', attendance]] },
  ];

  return (
    <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.onBrand, fontWeight: '700', fontSize: 15 }}>{initials}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{student.firstName} {student.lastName}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{admissionNo}</Text>
          <View style={{ marginTop: 6, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: paid ? colors.successBg : colors.dangerBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: paid ? colors.successText : colors.dangerText }} />
            <Text style={{ color: paid ? colors.successText : colors.dangerText, fontSize: 11, fontWeight: '700' }}>{fee.toUpperCase()}</Text>
          </View>
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
          <View key={group.title} style={{ flexGrow: 1, flexBasis: '46%', minWidth: '46%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={group.icon} size={14} color={colors.textSecondary} />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{group.title}</Text>
            </View>
            {group.rows.map(([label, value]) => (
              <View key={label} style={{ marginBottom: 8 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
                <Text style={{ color: label === 'Attendance' ? attendanceColor : label === 'Fee Status' ? (paid ? colors.successText : colors.dangerText) : colors.text, fontWeight: '700', fontSize: 14, marginTop: 2 }}>{value}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}
