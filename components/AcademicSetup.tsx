import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  createClass,
  createDepartment,
  createHouse,
  createSection,
  createSubject,
  deleteClass,
  deleteDepartment,
  deleteHouse,
  deleteSection,
  deleteSubject,
  loadAcademicSetup,
  saveCampus,
  saveProfile,
  updateClass,
  updateDepartment,
  updateHouse,
  updateSection,
  updateSubject,
  type AcademicClass,
  type AcademicOptions,
  type Campus,
  type ClassSection,
  type CurriculumSubject,
  type SchoolProfile,
  type StaffDepartment,
  type StudentHouse,
} from '../api/academicSetup';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/tokens';

type Tab = 'profile' | 'campuses' | 'structure' | 'houses';
type Dialog =
  | { kind: 'class'; item: AcademicClass | null }
  | { kind: 'section'; item: ClassSection | null }
  | { kind: 'subject'; item: CurriculumSubject | null }
  | { kind: 'campus'; item: Campus }
  | { kind: 'house'; item: StudentHouse | null };

const EMPTY_OPTIONS: AcademicOptions = {
  schoolTypes: [],
  sessions: [],
  schoolStatuses: [],
  recordStatuses: ['Active', 'Inactive'],
  subjectTypes: ['Core Subject'],
  houseColors: ['Blue'],
  teachers: [],
};

const HOUSE_SWATCH: Record<string, string> = {
  Red: '#e11d48',
  Blue: '#2563eb',
  Green: '#059669',
  Yellow: '#d97706',
  Purple: '#7c3aed',
  Orange: '#ea580c',
};

function yearLabel(value: string) {
  return (value || '').replace('-', ' - ');
}

function confirmAction(message: string) {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return Promise.resolve(window.confirm(message));
  }
  return new Promise<boolean>((resolve) => {
    Alert.alert('Confirm', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export default function AcademicSetup() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const medium = width >= 760;
  const compact = width < 820;
  const [tab, setTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [classes, setClasses] = useState<AcademicClass[]>([]);
  const [sections, setSections] = useState<ClassSection[]>([]);
  const [subjects, setSubjects] = useState<CurriculumSubject[]>([]);
  const [departments, setDepartments] = useState<StaffDepartment[]>([]);
  const [houses, setHouses] = useState<StudentHouse[]>([]);
  const [options, setOptions] = useState<AcademicOptions>(EMPTY_OPTIONS);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [departmentName, setDepartmentName] = useState('');
  const [editingDepartment, setEditingDepartment] = useState<StaffDepartment | null>(null);

  const classById = useMemo(() => new Map(classes.map((item) => [item.id, item])), [classes]);

  const applyBundle = (data: Awaited<ReturnType<typeof loadAcademicSetup>>, keepProfile = false) => {
    if (!keepProfile) setProfile(data.profile);
    setCampuses(data.campuses);
    setClasses(data.classes);
    setSections(data.sections);
    setSubjects(data.subjects);
    setDepartments(data.departments);
    setHouses(data.houses);
    setOptions(data.options);
  };

  const reload = async (keepProfile = false) => {
    const data = await loadAcademicSetup();
    applyBundle(data, keepProfile);
    return data;
  };

  useEffect(() => {
    let alive = true;
    loadAcademicSetup()
      .then((data) => {
        if (!alive) return;
        applyBundle(data);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'Could not load academic setup.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const run = async (work: () => Promise<void>, success: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
      setNotice(success);
      setDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (label: string, work: () => Promise<void>) => {
    const ok = await confirmAction(`Delete ${label}? This cannot be undone.`);
    if (!ok) return;
    await run(async () => {
      await work();
      await reload(true);
    }, `${label} deleted.`);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'School Profile' },
    { id: 'campuses', label: `Campuses (${campuses.length})` },
    { id: 'structure', label: `Academic Structure (${classes.length} Grades · ${subjects.length} Subjects)` },
    { id: 'houses', label: 'Departments & Houses' },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: compact ? 12 : 28, paddingBottom: 48 }}>
      {error ? <Banner text={error} tone="danger" colors={colors} /> : null}
      {notice ? <Banner text={notice} tone="success" colors={colors} /> : null}

      <View style={{ marginTop: 18, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => { setTab(item.id); setNotice(''); }}
              style={{
                backgroundColor: active ? colors.brand : 'transparent',
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 10,
                minHeight: 40,
                justifyContent: 'center',
                width: compact ? '100%' : undefined,
              }}
            >
              <Text style={{ color: active ? colors.onBrand : colors.textSecondary, fontWeight: '600', fontSize: 13 }}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading || !profile ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : null}

      {!loading && profile && tab === 'profile' ? (
        <Card colors={colors} title="Institutional Master Profile">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            <Field label="School Name" required colors={colors}><Input colors={colors} value={profile.schoolName} onChangeText={(schoolName) => setProfile({ ...profile, schoolName })} /></Field>
            <Field label="School Code" required colors={colors}><Input colors={colors} value={profile.schoolCode} onChangeText={(schoolCode) => setProfile({ ...profile, schoolCode })} autoCapitalize="characters" /></Field>
            <Field label="School Type" colors={colors}>
              <SelectBox colors={colors} value={profile.schoolType} options={options.schoolTypes} onChange={(schoolType) => setProfile({ ...profile, schoolType })} />
            </Field>
            <Field label="Contact Person / Principal" required colors={colors}><Input colors={colors} value={profile.contactPerson} onChangeText={(contactPerson) => setProfile({ ...profile, contactPerson })} /></Field>
            <Field label="Official Contact Email" required colors={colors}><Input colors={colors} value={profile.contactEmail} onChangeText={(contactEmail) => setProfile({ ...profile, contactEmail })} keyboardType="email-address" /></Field>
            <Field label="Administrative Telephone" required colors={colors}><Input colors={colors} value={profile.telephone} onChangeText={(telephone) => setProfile({ ...profile, telephone })} /></Field>
            <Field label="Official Website" colors={colors} wide={medium}><Input colors={colors} value={profile.website} onChangeText={(website) => setProfile({ ...profile, website })} /></Field>
            <Field label="Postal Address" colors={colors} wide={medium}><Input colors={colors} value={profile.postalAddress} onChangeText={(postalAddress) => setProfile({ ...profile, postalAddress })} /></Field>
            <Field label="Country" colors={colors}><Input colors={colors} value={profile.country} onChangeText={(country) => setProfile({ ...profile, country })} /></Field>
            <Field label="State / Province" colors={colors}><Input colors={colors} value={profile.state} onChangeText={(state) => setProfile({ ...profile, state })} /></Field>
            <Field label="City" colors={colors}><Input colors={colors} value={profile.city} onChangeText={(city) => setProfile({ ...profile, city })} /></Field>
            <Field label="Postal Code" colors={colors}><Input colors={colors} value={profile.postalCode} onChangeText={(postalCode) => setProfile({ ...profile, postalCode })} /></Field>
            <Field label="Active Academic Session" colors={colors}>
              <SelectBox colors={colors} value={profile.academicSession} options={options.sessions} onChange={(academicSession) => setProfile({ ...profile, academicSession })} />
            </Field>
            <Field label="School Status" colors={colors}>
              <SelectBox colors={colors} value={profile.schoolStatus} options={options.schoolStatuses} onChange={(schoolStatus) => setProfile({ ...profile, schoolStatus })} />
            </Field>
          </View>
          <View style={{ alignItems: 'flex-end', marginTop: 18 }}>
            <PrimaryButton colors={colors} label={busy ? 'Saving...' : 'Save Profile Changes'} disabled={busy} onPress={() => run(async () => setProfile(await saveProfile(profile)), 'School profile updated.')} />
          </View>
        </Card>
      ) : null}

      {!loading && tab === 'campuses' ? (
        <View style={{ marginTop: 16, flexDirection: wide ? 'row' : 'column', gap: 14 }}>
          {campuses.map((campus) => (
            <Pressable
              key={campus.id}
              onPress={() => setDialog({ kind: 'campus', item: campus })}
              style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 18,
                minWidth: wide ? 260 : 0,
                width: wide ? undefined : '100%',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8, flex: 1 }}>
                  <Ionicons name="location-outline" size={18} color={colors.brand} />
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, flex: 1 }}>{campus.name}</Text>
                </View>
                {campus.mainCampus ? <Pill label="Main campus" colors={colors} tone="brand" /> : <Pill label="Edit" colors={colors} />}
              </View>
              <Text style={{ color: colors.textSecondary, marginTop: 10 }}>{campus.address}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Code: {campus.code}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{campus.phone}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!loading && tab === 'structure' ? (
        <View style={{ marginTop: 16, flexDirection: wide ? 'row' : 'column', gap: 14, alignItems: 'stretch' }}>
          <StructureColumn
            colors={colors}
            index="1"
            title="Classes & Grades"
            subtitle={`AY ${yearLabel(classes[0]?.academicYear || '2026-2027')}`}
            action="+ Add Class"
            onAdd={() => setDialog({ kind: 'class', item: null })}
          >
            {classes.map((item) => (
              <RecordRow
                key={item.id}
                colors={colors}
                title={item.name}
                meta={`${item.code}  ·  Order #${item.displayOrder}`}
                badge={item.status}
                onEdit={() => setDialog({ kind: 'class', item })}
                onDelete={() => remove(item.name, () => deleteClass(item.id))}
              />
            ))}
          </StructureColumn>
          <StructureColumn
            colors={colors}
            index="2"
            title="Sections & Cohorts"
            subtitle="Class allocations & teachers"
            action="+ Add Section"
            onAdd={() => setDialog({ kind: 'section', item: null })}
          >
            {sections.map((item) => {
              const parent = classById.get(item.classId);
              return (
                <RecordRow
                  key={item.id}
                  colors={colors}
                  title={`${parent?.name || 'Class'} - ${item.name}`}
                  meta={`Capacity: ${item.capacity}  ·  ${item.teacher || 'In-charge teacher'}`}
                  badge={item.teacher ? 'Assigned' : item.status}
                  onEdit={() => setDialog({ kind: 'section', item })}
                  onDelete={() => remove(item.name, () => deleteSection(item.id))}
                />
              );
            })}
          </StructureColumn>
          <StructureColumn
            colors={colors}
            index="3"
            title="Curriculum Subjects"
            subtitle={`${subjects.length} course offerings`}
            action="+ Add Subject"
            onAdd={() => setDialog({ kind: 'subject', item: null })}
          >
            {subjects.map((item) => (
              <RecordRow
                key={item.id}
                colors={colors}
                title={item.name}
                code={item.code}
                badge={item.subjectType.replace(' Subject', '')}
                onEdit={() => setDialog({ kind: 'subject', item })}
                onDelete={() => remove(item.name, () => deleteSubject(item.id))}
              />
            ))}
          </StructureColumn>
        </View>
      ) : null}

      {!loading && tab === 'houses' ? (
        <View style={{ marginTop: 16, flexDirection: wide ? 'row' : 'column', gap: 14 }}>
          <Card colors={colors} title="Faculty & Staff Departments" extra={`${departments.length} departments`} style={{ flex: 1.2 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Input
                  colors={colors}
                  value={departmentName}
                  placeholder="Add department (e.g. Fine Arts & Music)"
                  onChangeText={setDepartmentName}
                />
              </View>
              <PrimaryButton
                colors={colors}
                label={editingDepartment ? 'Save' : 'Add'}
                disabled={busy}
                onPress={() => {
                  const name = departmentName.trim();
                  if (!name) {
                    setError('Department name is required.');
                    return;
                  }
                  run(async () => {
                    if (editingDepartment) await updateDepartment(editingDepartment.id, { name, code: editingDepartment.code });
                    else await createDepartment({ name, code: '' });
                    setDepartmentName('');
                    setEditingDepartment(null);
                    await reload(true);
                  }, editingDepartment ? 'Department updated.' : 'Department added.');
                }}
              />
            </View>
            <View style={{ marginTop: 8 }}>
              {departments.map((item) => (
                <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 }}>
                  <Text style={{ flex: 1, color: colors.text, fontWeight: '600' }}>{item.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, letterSpacing: 0.4 }}>{item.code}</Text>
                  <IconButton colors={colors} name="pencil-outline" onPress={() => { setEditingDepartment(item); setDepartmentName(item.name); }} />
                  <IconButton colors={colors} name="trash-outline" danger onPress={() => remove(item.name, () => deleteDepartment(item.id))} />
                </View>
              ))}
            </View>
          </Card>
          <Card
            colors={colors}
            title="Student Houses & Cohorts"
            extra={`${houses.length}`}
            action="+ Add House"
            onAction={() => setDialog({ kind: 'house', item: null })}
            style={{ flex: 1 }}
          >
            {houses.length === 0 ? (
              <Text style={{ color: colors.textSecondary, paddingVertical: 28, textAlign: 'center' }}>
                No houses yet. Add a house to group students into cohorts.
              </Text>
            ) : (
              houses.map((house) => (
                <View key={house.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Pressable onPress={() => setDialog({ kind: 'house', item: house })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 12, height: 36, borderRadius: 6, backgroundColor: HOUSE_SWATCH[house.color] || colors.brand }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '700' }}>{house.name}</Text>
                      <Text style={{ color: colors.textMuted, marginTop: 2, fontSize: 12 }}>{house.code} · {house.color}{house.description ? ` · ${house.description}` : ''}</Text>
                    </View>
                  </Pressable>
                  <IconButton colors={colors} name="pencil-outline" onPress={() => setDialog({ kind: 'house', item: house })} />
                  <IconButton colors={colors} name="trash-outline" danger onPress={() => remove(house.name, () => deleteHouse(house.id))} />
                </View>
              ))
            )}
          </Card>
        </View>
      ) : null}

      <SetupDialog
        dialog={dialog}
        busy={busy}
        colors={colors}
        options={options}
        campuses={campuses}
        classes={classes}
        onClose={() => setDialog(null)}
        onSubmit={(body, success) => run(async () => {
          await body();
          await reload(true);
        }, success)}
      />
    </ScrollView>
  );
}

function SetupDialog({
  dialog,
  busy,
  colors,
  options,
  campuses,
  classes,
  onClose,
  onSubmit,
}: {
  dialog: Dialog | null;
  busy: boolean;
  colors: ThemeColors;
  options: AcademicOptions;
  campuses: Campus[];
  classes: AcademicClass[];
  onClose: () => void;
  onSubmit: (work: () => Promise<void>, success: string) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const { width, height } = useWindowDimensions();
  const compact = width < 820;

  useEffect(() => {
    if (!dialog) return;
    const main = campuses.find((item) => item.mainCampus) || campuses[0];
    const year = classes[0]?.academicYear || '2026-2027';
    if (dialog.kind === 'class') {
      const item = dialog.item;
      setForm({
        academicYear: item?.academicYear || year,
        campusId: String(item?.campusId || main?.id || ''),
        name: item?.name || '',
        code: item?.code || '',
        displayOrder: String(item?.displayOrder || classes.length + 1),
        status: item?.status || 'Active',
      });
    } else if (dialog.kind === 'section') {
      const item = dialog.item;
      setForm({
        academicYear: item?.academicYear || year,
        campusId: String(item?.campusId || main?.id || ''),
        classId: String(item?.classId || classes[0]?.id || ''),
        name: item?.name || '',
        code: item?.code || '',
        capacity: String(item?.capacity || 35),
        status: item?.status || 'Active',
        teacher: item?.teacher || '',
      });
    } else if (dialog.kind === 'subject') {
      const item = dialog.item;
      setForm({
        academicYear: item?.academicYear || year,
        name: item?.name || '',
        code: item?.code || '',
        subjectType: item?.subjectType || 'Core Subject',
        displayOrder: String(item?.displayOrder || 1),
        status: item?.status || 'Active',
      });
    } else if (dialog.kind === 'campus') {
      const item = dialog.item;
      setForm({
        name: item.name,
        address: item.address,
        code: item.code,
        phone: item.phone,
        mainCampus: item.mainCampus ? 'yes' : 'no',
      });
    } else {
      const item = dialog.item;
      setForm({
        name: item?.name || '',
        code: item?.code || '',
        color: item?.color || 'Blue',
        description: item?.description || '',
      });
    }
  }, [dialog, campuses, classes]);

  if (!dialog) return null;
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const campusOptions = campuses.map((item) => ({ value: String(item.id), label: item.name }));
  const classOptions = classes.map((item) => ({ value: String(item.id), label: item.name }));

  const title = {
    class: dialog.kind === 'class' && dialog.item ? 'Edit Academic Class / Standard' : 'Add Academic Class / Standard',
    section: dialog.kind === 'section' && dialog.item ? 'Edit Class Section / Cohort' : 'Add Class Section / Cohort',
    subject: dialog.kind === 'subject' && dialog.item ? 'Edit Curriculum Subject' : 'Add Curriculum Subject',
    campus: 'Edit Campus',
    house: dialog.kind === 'house' && dialog.item ? 'Edit Student House' : 'Add Student House',
  }[dialog.kind];

  const subtitle = {
    class: 'Configure class name, code, order and active academic session.',
    section: 'Allocate section division, student capacity, and class teacher in-charge.',
    subject: 'Define course name, code, subject classification and syllabus order.',
    campus: 'Update the campus name, address, code and phone.',
    house: 'Name the house, give it a code, and choose a cohort color.',
  }[dialog.kind];

  const submit = () => {
    if (dialog.kind === 'class') {
      const body = {
        academicYear: form.academicYear,
        campusId: Number(form.campusId),
        name: form.name,
        code: form.code,
        displayOrder: Number(form.displayOrder),
        status: form.status,
      };
      onSubmit(
        () => (dialog.item ? updateClass(dialog.item.id, body) : createClass(body)).then(() => undefined),
        dialog.item ? 'Class updated.' : 'Class added.',
      );
    } else if (dialog.kind === 'section') {
      const body = {
        academicYear: form.academicYear,
        campusId: Number(form.campusId),
        classId: Number(form.classId),
        name: form.name,
        code: form.code,
        capacity: Number(form.capacity),
        status: form.status,
        teacher: form.teacher,
      };
      onSubmit(
        () => (dialog.item ? updateSection(dialog.item.id, body) : createSection(body)).then(() => undefined),
        dialog.item ? 'Section updated.' : 'Section added.',
      );
    } else if (dialog.kind === 'subject') {
      const body = {
        academicYear: form.academicYear,
        name: form.name,
        code: form.code,
        subjectType: form.subjectType,
        displayOrder: Number(form.displayOrder),
        status: form.status,
      };
      onSubmit(
        () => (dialog.item ? updateSubject(dialog.item.id, body) : createSubject(body)).then(() => undefined),
        dialog.item ? 'Subject updated.' : 'Subject added.',
      );
    } else if (dialog.kind === 'campus') {
      onSubmit(
        () => saveCampus(dialog.item.id, {
          name: form.name,
          address: form.address,
          code: form.code,
          phone: form.phone,
          mainCampus: form.mainCampus === 'yes',
        }).then(() => undefined),
        'Campus updated.',
      );
    } else if (dialog.kind === 'house') {
      const body = { name: form.name, code: form.code, color: form.color, description: form.description };
      onSubmit(
        () => (dialog.item ? updateHouse(dialog.item.id, body) : createHouse(body)).then(() => undefined),
        dialog.item ? 'House updated.' : 'House added.',
      );
    }
  };

  const action = dialog.kind === 'class' ? 'Save Class' : dialog.kind === 'section' ? 'Save Section' : dialog.kind === 'subject' ? 'Save Subject' : dialog.kind === 'campus' ? 'Save Campus' : 'Save House';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', padding: compact ? 12 : 16 }}>
        <View style={{ alignSelf: 'center', width: '100%', maxWidth: 520, maxHeight: height - (compact ? 24 : 80), backgroundColor: colors.surface, borderRadius: 18, padding: compact ? 14 : 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700' }}>{title}</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 13 }}>{subtitle}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={20} color={colors.textMuted} /></Pressable>
          </View>
          <ScrollView style={{ marginTop: 16, maxHeight: height - (compact ? 160 : 220) }} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
            {dialog.kind !== 'house' && dialog.kind !== 'campus' ? (
              <Field label="Academic Year" colors={colors} wide>
                <Input colors={colors} value={yearLabel(form.academicYear || '')} editable={false} />
              </Field>
            ) : null}
            {(dialog.kind === 'class' || dialog.kind === 'section') ? (
              <Field label="Campus" colors={colors} wide>
                <SelectBox colors={colors} value={form.campusId || ''} options={campusOptions} onChange={(value) => set('campusId', value)} />
              </Field>
            ) : null}
            {dialog.kind === 'class' ? (
              <>
                <Field label="Class / Grade Name" required colors={colors} wide><Input colors={colors} value={form.name || ''} placeholder="e.g. Grade 11 Science" onChangeText={(value) => set('name', value)} /></Field>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <Field label="Class Code" required colors={colors}><Input colors={colors} value={form.code || ''} placeholder="e.g. CLS-11-SCI" autoCapitalize="characters" onChangeText={(value) => set('code', value)} /></Field>
                  <Field label="Display Order" colors={colors}><Input colors={colors} value={form.displayOrder || ''} keyboardType="number-pad" onChangeText={(value) => set('displayOrder', value.replace(/\D/g, ''))} /></Field>
                </View>
                <Field label="Status" colors={colors} wide><SelectBox colors={colors} value={form.status || 'Active'} options={options.recordStatuses} onChange={(value) => set('status', value)} /></Field>
              </>
            ) : null}
            {dialog.kind === 'section' ? (
              <>
                <Field label="Parent Class" required colors={colors} wide><SelectBox colors={colors} value={form.classId || ''} options={classOptions} onChange={(value) => set('classId', value)} /></Field>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <Field label="Section Name" required colors={colors}><Input colors={colors} value={form.name || ''} placeholder="Section C" onChangeText={(value) => set('name', value)} /></Field>
                  <Field label="Section Code" required colors={colors}><Input colors={colors} value={form.code || ''} placeholder="SEC-C" autoCapitalize="characters" onChangeText={(value) => set('code', value)} /></Field>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <Field label="Student Capacity" colors={colors}><Input colors={colors} value={form.capacity || ''} keyboardType="number-pad" onChangeText={(value) => set('capacity', value.replace(/\D/g, ''))} /></Field>
                  <Field label="Status" colors={colors}><SelectBox colors={colors} value={form.status || 'Active'} options={options.recordStatuses} onChange={(value) => set('status', value)} /></Field>
                </View>
                <Field label="Class Teacher In-charge" colors={colors} wide>
                  <SelectBox colors={colors} value={form.teacher || ''} options={[{ value: '', label: 'Unassigned' }, ...options.teachers.map((teacher) => ({ value: teacher, label: teacher }))]} onChange={(value) => set('teacher', value)} />
                </Field>
              </>
            ) : null}
            {dialog.kind === 'subject' ? (
              <>
                <Field label="Subject Name" required colors={colors} wide><Input colors={colors} value={form.name || ''} placeholder="e.g. Computer Science & Coding" onChangeText={(value) => set('name', value)} /></Field>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <Field label="Subject Code" required colors={colors}><Input colors={colors} value={form.code || ''} placeholder="e.g. SUB-CSC" autoCapitalize="characters" onChangeText={(value) => set('code', value)} /></Field>
                  <Field label="Subject Type" colors={colors}><SelectBox colors={colors} value={form.subjectType || 'Core Subject'} options={options.subjectTypes} onChange={(value) => set('subjectType', value)} /></Field>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <Field label="Display Order" colors={colors}><Input colors={colors} value={form.displayOrder || ''} keyboardType="number-pad" onChangeText={(value) => set('displayOrder', value.replace(/\D/g, ''))} /></Field>
                  <Field label="Status" colors={colors}><SelectBox colors={colors} value={form.status || 'Active'} options={options.recordStatuses} onChange={(value) => set('status', value)} /></Field>
                </View>
              </>
            ) : null}
            {dialog.kind === 'campus' ? (
              <>
                <Field label="Campus Name" required colors={colors} wide><Input colors={colors} value={form.name || ''} onChangeText={(value) => set('name', value)} /></Field>
                <Field label="Address" required colors={colors} wide><Input colors={colors} value={form.address || ''} onChangeText={(value) => set('address', value)} /></Field>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <Field label="Code" required colors={colors}><Input colors={colors} value={form.code || ''} autoCapitalize="characters" onChangeText={(value) => set('code', value)} /></Field>
                  <Field label="Phone" required colors={colors}><Input colors={colors} value={form.phone || ''} onChangeText={(value) => set('phone', value)} /></Field>
                </View>
                <Field label="Main Campus" colors={colors} wide>
                  <SelectBox colors={colors} value={form.mainCampus || 'no'} options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} onChange={(value) => set('mainCampus', value)} />
                </Field>
              </>
            ) : null}
            {dialog.kind === 'house' ? (
              <>
                <Field label="House Name" required colors={colors} wide><Input colors={colors} value={form.name || ''} placeholder="e.g. Ashoka House" onChangeText={(value) => set('name', value)} /></Field>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  <Field label="House Code" required colors={colors}><Input colors={colors} value={form.code || ''} placeholder="HOUSE-ASH" autoCapitalize="characters" onChangeText={(value) => set('code', value)} /></Field>
                  <Field label="Color" colors={colors}><SelectBox colors={colors} value={form.color || 'Blue'} options={options.houseColors} onChange={(value) => set('color', value)} /></Field>
                </View>
                <Field label="Description" colors={colors} wide><Input colors={colors} value={form.description || ''} placeholder="Optional note" onChangeText={(value) => set('description', value)} /></Field>
              </>
            ) : null}
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <Pressable onPress={onClose} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <PrimaryButton colors={colors} label={busy ? 'Saving...' : action} disabled={busy} onPress={submit} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function StructureColumn({
  colors,
  index,
  title,
  subtitle,
  action,
  onAdd,
  children,
}: {
  colors: ThemeColors;
  index: string;
  title: string;
  subtitle: string;
  action: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const stacked = width < 1100;
  return (
    <View style={{ flex: 1, width: stacked ? '100%' : undefined, minWidth: stacked ? 0 : 260, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{index}. {title}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
        </View>
        <Pressable onPress={onAdd} style={{ backgroundColor: colors.brand, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}>
          <Text style={{ color: colors.onBrand, fontWeight: '700', fontSize: 12 }}>{action}</Text>
        </Pressable>
      </View>
      <ScrollView style={{ marginTop: 8, maxHeight: 560 }} nestedScrollEnabled>{children}</ScrollView>
    </View>
  );
}

function RecordRow({
  colors,
  title,
  meta,
  code,
  badge,
  onEdit,
  onDelete,
}: {
  colors: ThemeColors;
  title: string;
  meta?: string;
  code?: string;
  badge: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>{title}{code ? <Text style={{ color: colors.textMuted, fontWeight: '500' }}>  {code}</Text> : null}</Text>
        {meta ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 3 }}>{meta}</Text> : null}
      </View>
      <Pill label={badge} colors={colors} tone={badge === 'Inactive' ? 'muted' : 'success'} />
      <IconButton colors={colors} name="pencil-outline" onPress={onEdit} />
      <IconButton colors={colors} name="trash-outline" danger onPress={onDelete} />
    </View>
  );
}

function Card({
  colors,
  title,
  extra,
  action,
  onAction,
  children,
  style,
}: {
  colors: ThemeColors;
  title: string;
  extra?: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[{ marginTop: 16, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 18 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, flex: 1 }}>{title}</Text>
        {extra ? <Text style={{ color: colors.textMuted, fontSize: 12 }}>{extra}</Text> : null}
        {action && onAction ? (
          <Pressable onPress={onAction} style={{ backgroundColor: colors.brand, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 }}>
            <Text style={{ color: colors.onBrand, fontWeight: '700', fontSize: 12 }}>{action}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Field({ label, required, colors, children, wide }: { label: string; required?: boolean; colors: ThemeColors; children: React.ReactNode; wide?: boolean }) {
  const { width } = useWindowDimensions();
  const stacked = wide || width < 820;
  return (
    <View style={{ width: stacked ? '100%' : '31%', minWidth: stacked ? 0 : 180, flexGrow: 1 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
        {label}{required ? ' *' : ''}
      </Text>
      {children}
    </View>
  );
}

function Input({
  colors,
  value,
  onChangeText,
  placeholder,
  editable = true,
  keyboardType,
  autoCapitalize,
}: {
  colors: ThemeColors;
  value: string;
  onChangeText?: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  autoCapitalize?: 'none' | 'characters';
}) {
  return (
    <TextInput
      value={value}
      editable={editable}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize || 'sentences'}
      autoCorrect={false}
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: editable ? colors.surface : colors.surface2,
        color: colors.text,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'web' ? 10 : 8,
        fontSize: 14,
      }}
    />
  );
}

function SelectBox({
  colors,
  value,
  options,
  onChange,
}: {
  colors: ThemeColors;
  value: string;
  options: Array<string | { value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const normalized = options.map((option) => (typeof option === 'string' ? { value: option, label: option } : option));
  if (Platform.OS === 'web') {
    return React.createElement(
      'select',
      {
        value,
        onChange: (event: { target: { value: string } }) => onChange(event.target.value),
        style: {
          width: '100%',
          border: `1px solid ${colors.border}`,
          background: colors.surface,
          color: colors.text,
          borderRadius: 10,
          padding: '10px 12px',
          fontSize: 14,
          fontFamily: 'inherit',
        },
      },
      normalized.map((option) => React.createElement('option', { key: option.value || option.label, value: option.value }, option.label)),
    );
  }
  return (
    <View style={{ gap: 6 }}>
      {normalized.map((option) => {
        const active = option.value === value;
        return (
          <Pressable key={option.value || option.label} onPress={() => onChange(option.value)} style={{ borderWidth: 1, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brand : colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: active ? colors.onBrand : colors.text }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PrimaryButton({ colors, label, onPress, disabled }: { colors: ThemeColors; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ backgroundColor: colors.brand, opacity: disabled ? 0.7 : 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11, alignSelf: 'flex-start' }}>
      <Text style={{ color: colors.onBrand, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function Pill({ label, colors, tone = 'muted' }: { label: string; colors: ThemeColors; tone?: 'success' | 'brand' | 'muted' }) {
  const background = tone === 'success' ? colors.successBg : tone === 'brand' ? colors.accentBg : colors.surface2;
  const color = tone === 'success' ? colors.successText : tone === 'brand' ? colors.accentText : colors.textSecondary;
  return (
    <View style={{ backgroundColor: background, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
      <Text style={{ color, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function IconButton({ colors, name, onPress, danger }: { colors: ThemeColors; name: keyof typeof Ionicons.glyphMap; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={16} color={danger ? colors.dangerText : colors.textMuted} />
    </Pressable>
  );
}

function Banner({ text, tone, colors }: { text: string; tone: 'danger' | 'success'; colors: ThemeColors }) {
  return (
    <View style={{ marginTop: 14, backgroundColor: tone === 'danger' ? colors.dangerBg : colors.successBg, borderRadius: 12, padding: 12 }}>
      <Text style={{ color: tone === 'danger' ? colors.dangerText : colors.successText, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}
