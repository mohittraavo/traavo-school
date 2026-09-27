import React, { useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Platform, useWindowDimensions } from 'react-native';
import { Controller, useForm, type RegisterOptions } from 'react-hook-form';
import { useTheme } from '../theme/ThemeContext';
import { apiJson } from '../api/client';

type FieldDef = {
  key: string;
  label: string;
  required?: boolean;
  hint?: string;
  options?: string[];
  span?: 2;
};

const FORM_SECTIONS: Array<{ title: string; fields: FieldDef[] }> = [
  {
    title: 'Admission',
    fields: [
      { key: 'admissionNo', label: 'Admission No', required: true },
      { key: 'admissionDate', label: 'Admission Date', hint: 'YYYY-MM-DD' },
      { key: 'firstName', label: 'First Name', required: true },
      { key: 'lastName', label: 'Last Name', required: true },
      { key: 'classGrade', label: 'Class / Grade', required: true },
      { key: 'section', label: 'Section', required: true },
      { key: 'rollNo', label: 'Roll No' },
      { key: 'academicSession', label: 'Academic Session' },
    ],
  },
  {
    title: 'Personal',
    fields: [
      { key: 'dob', label: 'Date of Birth', required: true, hint: 'YYYY-MM-DD' },
      { key: 'gender', label: 'Gender', required: true, options: ['Male', 'Female', 'Other'] },
      { key: 'bloodGroup', label: 'Blood Group' },
      { key: 'motherTongue', label: 'Mother Tongue' },
      { key: 'mediumOfInstruction', label: 'Medium of Instruction' },
    ],
  },
  {
    title: 'Identity & UDISE',
    fields: [
      { key: 'apaarId', label: 'APAAR ID', hint: '12-digit' },
      { key: 'udisePen', label: 'UDISE PEN', hint: '11-digit' },
      { key: 'studentAadhaar', label: 'Student Aadhaar', hint: '12-digit' },
      { key: 'aadhaarStatus', label: 'Aadhaar Status', options: ['Verified', 'Pending', 'Exempted'] },
      { key: 'udiseStudentCode', label: 'UDISE Student Code' },
      { key: 'birthCertificateNo', label: 'Birth Certificate No' },
      { key: 'birthCertificateAuthority', label: 'Birth Certificate Authority' },
      { key: 'domicileState', label: 'Domicile State' },
      { key: 'domicileCertificateNo', label: 'Domicile Certificate No' },
    ],
  },
  {
    title: 'Category & welfare',
    fields: [
      { key: 'admissionQuota', label: 'Admission Quota' },
      { key: 'category', label: 'Category', options: ['General', 'OBC', 'SC', 'ST', 'EWS'] },
      { key: 'religion', label: 'Religion' },
      { key: 'minorityStatus', label: 'Minority Status', options: ['Yes', 'No'] },
      { key: 'bplCardNo', label: 'BPL Card No' },
      { key: 'familyAnnualIncome', label: 'Family Annual Income' },
    ],
  },
  {
    title: 'CWSN / Special needs',
    fields: [
      { key: 'cwsnSpecialNeeds', label: 'CWSN Special Needs', options: ['Yes', 'No'] },
      { key: 'disabilityType', label: 'Disability Type' },
      { key: 'disabilityPercentage', label: 'Disability Percentage' },
      { key: 'udidNo', label: 'UDID No' },
      { key: 'specialAidsProvided', label: 'Special Aids Provided', span: 2 },
    ],
  },
  {
    title: 'Father',
    fields: [
      { key: 'fatherName', label: 'Father Name', required: true },
      { key: 'fatherMobile', label: 'Father Mobile', required: true, hint: '10-digit' },
      { key: 'fatherEmail', label: 'Father Email' },
      { key: 'fatherQualification', label: 'Father Qualification' },
      { key: 'fatherOccupation', label: 'Father Occupation' },
      { key: 'fatherDesignation', label: 'Father Designation' },
      { key: 'fatherOrganization', label: 'Father Organization' },
      { key: 'fatherAnnualIncome', label: 'Father Annual Income' },
      { key: 'fatherAadhaar', label: 'Father Aadhaar', hint: '12-digit' },
      { key: 'fatherPAN', label: 'Father PAN' },
    ],
  },
  {
    title: 'Mother',
    fields: [
      { key: 'motherName', label: 'Mother Name' },
      { key: 'motherMobile', label: 'Mother Mobile', hint: '10-digit' },
      { key: 'motherEmail', label: 'Mother Email' },
      { key: 'motherQualification', label: 'Mother Qualification' },
      { key: 'motherOccupation', label: 'Mother Occupation' },
      { key: 'motherDesignation', label: 'Mother Designation' },
      { key: 'motherOrganization', label: 'Mother Organization' },
      { key: 'motherAnnualIncome', label: 'Mother Annual Income' },
      { key: 'motherAadhaar', label: 'Mother Aadhaar', hint: '12-digit' },
      { key: 'motherPAN', label: 'Mother PAN' },
    ],
  },
  {
    title: 'Guardian & emergency',
    fields: [
      { key: 'guardianName', label: 'Guardian Name' },
      { key: 'guardianRelation', label: 'Guardian Relation' },
      { key: 'guardianPhone', label: 'Guardian Phone' },
      { key: 'guardianEmail', label: 'Guardian Email' },
      { key: 'guardianOccupation', label: 'Guardian Occupation' },
      { key: 'emergencyDoctorName', label: 'Emergency Doctor Name' },
      { key: 'emergencyDoctorPhone', label: 'Emergency Doctor Phone' },
      { key: 'preferredHospital', label: 'Preferred Hospital' },
    ],
  },
  {
    title: 'Address',
    fields: [
      { key: 'residentialAddress', label: 'Residential Address', span: 2 },
      { key: 'permanentAddress', label: 'Permanent Address', span: 2 },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'pincode', label: 'Pincode' },
      { key: 'distanceFromSchoolKm', label: 'Distance From School (KM)' },
    ],
  },
  {
    title: 'Previous school',
    fields: [
      { key: 'previousSchoolName', label: 'Previous School Name' },
      { key: 'previousBoard', label: 'Previous Board' },
      { key: 'previousClassPassed', label: 'Previous Class Passed' },
      { key: 'tcNumber', label: 'TC Number' },
      { key: 'tcDate', label: 'TC Date', hint: 'YYYY-MM-DD' },
      { key: 'tcCounterSigned', label: 'TC Counter-Signed', options: ['Yes', 'No'] },
    ],
  },
  {
    title: 'Transport',
    fields: [
      { key: 'transportRequired', label: 'Transport Required', options: ['Yes', 'No'] },
      { key: 'transportMode', label: 'Transport Mode' },
      { key: 'busRouteNo', label: 'Bus Route No' },
      { key: 'busStopPickupPoint', label: 'Bus Stop / Pickup Point' },
      { key: 'morningPickupTime', label: 'Morning Pickup Time' },
      { key: 'afternoonDropTime', label: 'Afternoon Drop Time' },
    ],
  },
  {
    title: 'Bank & scholarship',
    fields: [
      { key: 'bankAccountHolderName', label: 'Bank Account Holder Name' },
      { key: 'bankName', label: 'Bank Name' },
      { key: 'bankAccountNumber', label: 'Bank Account Number' },
      { key: 'bankIFSC', label: 'Bank IFSC Code' },
      { key: 'bankBranch', label: 'Bank Branch' },
      { key: 'scholarshipAvailed', label: 'Scholarship Availed', options: ['Yes', 'No'] },
    ],
  },
  {
    title: 'Health',
    fields: [
      { key: 'heightCm', label: 'Height (cm)' },
      { key: 'weightKg', label: 'Weight (kg)' },
      { key: 'bmi', label: 'BMI' },
      { key: 'visionLeft', label: 'Vision Left' },
      { key: 'visionRight', label: 'Vision Right' },
      { key: 'allergies', label: 'Allergies' },
      { key: 'chronicConditions', label: 'Chronic Conditions' },
      { key: 'vaccinationStatus', label: 'Vaccination Status' },
    ],
  },
];

const ALL_FIELDS = FORM_SECTIONS.flatMap((section) => section.fields);

const DIGIT_RULES: Record<string, { re: RegExp; message: string }> = {
  studentAadhaar: { re: /^\d{12}$/, message: 'Student Aadhaar must be 12 digits' },
  fatherAadhaar: { re: /^\d{12}$/, message: 'Father Aadhaar must be 12 digits' },
  motherAadhaar: { re: /^\d{12}$/, message: 'Mother Aadhaar must be 12 digits' },
  fatherMobile: { re: /^\d{10}$/, message: 'Father Mobile must be 10 digits' },
  motherMobile: { re: /^\d{10}$/, message: 'Mother Mobile must be 10 digits' },
  udisePen: { re: /^\d{11}$/, message: 'UDISE PEN must be 11 digits' },
  apaarId: { re: /^\d{12}$/, message: 'APAAR ID must be 12 digits' },
};

const DATE_MESSAGES: Record<string, string> = {
  admissionDate: 'Admission Date must be YYYY-MM-DD',
  dob: 'Date of Birth must be YYYY-MM-DD',
  tcDate: 'TC Date must be YYYY-MM-DD',
};

function rulesFor(field: FieldDef): RegisterOptions {
  return {
    validate: (value) => {
      const s = value == null ? '' : String(value).trim();
      if (!s) return field.required ? `${field.label} is required` : true;
      const digits = DIGIT_RULES[field.key];
      if (digits && !digits.re.test(s)) return digits.message;
      if (DATE_MESSAGES[field.key] && !/^\d{4}-\d{2}-\d{2}$/.test(s)) return DATE_MESSAGES[field.key];
      if (field.key === 'gender' && !/^(Male|Female|Other)$/i.test(s)) return 'Gender must be Male, Female or Other';
      return true;
    },
  };
}

function emptyValues(): Record<string, string> {
  return ALL_FIELDS.reduce((acc, field) => {
    acc[field.key] = '';
    return acc;
  }, {} as Record<string, string>);
}

function valuesFromStudent(student: any): Record<string, string> {
  const values = emptyValues();
  if (!student) return values;
  for (const field of ALL_FIELDS) {
    const raw = student[field.key];
    values[field.key] = raw == null ? '' : String(raw);
  }
  return values;
}

export default function StudentFormModal({
  visible,
  student,
  editingId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  student: any;
  editingId: number | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const defaultValues = useMemo(() => valuesFromStudent(student), [student]);
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<Record<string, string>>({
    defaultValues,
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    shouldFocusError: true,
  });
  const [submitError, setSubmitError] = useState('');
  const fieldAnchors = useRef<Record<string, any>>({});

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    padding: 10,
    borderRadius: 9,
  } as const;
  const primaryBtn = { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.brand, borderRadius: 9, alignItems: 'center' as const, justifyContent: 'center' as const };
  const ghostBtn = { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.surface, borderRadius: 9, borderWidth: 1, borderColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const };

  const onSubmit = async (form: Record<string, string>) => {
    setSubmitError('');
    try {
      const method = editingId ? 'PUT' : 'POST';
      const path = editingId ? `/api/students/${editingId}` : '/api/students';
      await apiJson(path, { method, body: JSON.stringify(form) });
      await onSaved();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to save student');
    }
  };

  const onInvalid = (errs: Record<string, any>) => {
    const first = ALL_FIELDS.find((field) => errs[field.key]);
    const node = first ? fieldAnchors.current[first.key] : null;
    node?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  };

  return (
    <Modal visible={visible} transparent animationType={Platform.OS === 'web' ? 'none' : 'fade'}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20, 33, 61, 0.52)', padding: 24, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 760, maxHeight: Math.min(720, Math.max(480, height - 80)), backgroundColor: colors.surface, opacity: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: 'hidden', ...(Platform.OS === 'web' ? { boxShadow: '0 28px 70px rgba(20,33,61,0.22)' } : { elevation: 16 }) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{editingId ? 'Edit student' : 'Add student'}</Text>
            <Pressable onPress={onClose} style={{ width: 32, height: 32, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.text, fontSize: 16 }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: Math.min(560, Math.max(280, height - 260)), backgroundColor: colors.surface }} contentContainerStyle={{ padding: 24, paddingBottom: 12 }}>
            {submitError ? (
              <View style={{ backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, marginBottom: 14 }}>
                <Text style={{ color: colors.warningText, fontSize: 13 }}>{submitError}</Text>
              </View>
            ) : null}

            {FORM_SECTIONS.map((section) => (
              <View key={section.title} style={{ marginBottom: 18 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 10 }}>{section.title}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {section.fields.map((field) => (
                    <Controller
                      key={field.key}
                      control={control}
                      name={field.key}
                      rules={rulesFor(field)}
                      render={({ field: rhf, fieldState }) => {
                        const selected = (rhf.value || '') + '';
                        const invalid = !!fieldState.error;
                        return (
                          <View
                            ref={(el) => { fieldAnchors.current[field.key] = el; }}
                            style={{ width: field.span === 2 ? '100%' : '48%', minWidth: field.span === 2 ? '100%' : 220, flexGrow: 1 }}
                          >
                            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
                              {field.label}{field.required ? ' *' : ''}{field.hint ? ` (${field.hint})` : ''}
                            </Text>
                            {field.options ? (
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                {field.options.map((option) => {
                                  const active = selected.toLowerCase() === option.toLowerCase();
                                  return (
                                    <Pressable
                                      key={option}
                                      onPress={() => { rhf.onChange(option); rhf.onBlur(); }}
                                      style={{
                                        borderWidth: 1,
                                        borderColor: active ? colors.brand : invalid ? colors.dangerText : colors.border,
                                        backgroundColor: active ? colors.brand : colors.surface2,
                                        borderRadius: 999,
                                        paddingHorizontal: 10,
                                        paddingVertical: 7,
                                      }}
                                    >
                                      <Text style={{ color: active ? colors.onBrand : colors.text, fontSize: 12, fontWeight: '600' }}>{option}</Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            ) : (
                              <TextInput
                                placeholder={field.hint || field.label}
                                placeholderTextColor={colors.textMuted}
                                value={selected}
                                onBlur={rhf.onBlur}
                                onChangeText={rhf.onChange}
                                keyboardType={DIGIT_RULES[field.key] ? 'number-pad' : 'default'}
                                style={[inputStyle, invalid ? { borderColor: colors.dangerText } : null]}
                              />
                            )}
                            {fieldState.error?.message ? (
                              <Text style={{ marginTop: 5, fontSize: 12, color: colors.dangerText }}>{fieldState.error.message}</Text>
                            ) : null}
                          </View>
                        );
                      }}
                    />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
            <Pressable onPress={onClose} style={ghostBtn}><Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text></Pressable>
            <Pressable onPress={handleSubmit(onSubmit, onInvalid)} style={[primaryBtn, isSubmitting ? { opacity: 0.7 } : null]}>
              <Text style={{ color: colors.onBrand, fontWeight: '600' }}>{isSubmitting ? 'Saving...' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
