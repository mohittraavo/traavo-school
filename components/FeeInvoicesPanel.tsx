import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useForm, useWatch } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import {
  BILLING_PERIODS,
  PAYMENT_METHODS,
  issueFeeInvoice,
  listFeeInvoices,
  previewFeeInvoice,
  recordFeePayment,
  type FeeInvoice,
  type FeeInvoicePreview,
} from '../api/feeInvoices';
import { apiJson } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { DateField } from './ui/DateField';
import { DataTable } from './ui/DataTable';

type StudentOption = { id: number; label: string };
type IssueForm = { studentId: string; feePeriod: string; baseAmount: string; concession: string; lateFine: string; dueDate: string };

function explain(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (message.toLowerCase().includes('static resource')) return 'Invoices could not be loaded.';
  return message;
}

function money(value: string) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function inr(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}

export type FeeInvoicesHandle = { openIssue: () => void };

const FeeInvoicesPanel = forwardRef<FeeInvoicesHandle, { onCount?: (count: number) => void }>(function FeeInvoicesPanel({ onCount }, ref) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const compact = width < 820;
  const fieldBasis = compact ? '100%' as const : 240;
  const { session } = useAuth();
  const [rows, setRows] = useState<FeeInvoice[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showIssue, setShowIssue] = useState(false);
  const [preview, setPreview] = useState<FeeInvoicePreview | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [paying, setPaying] = useState<FeeInvoice | null>(null);
  const [settlement, setSettlement] = useState({ receiptNo: '', paymentDate: '', amount: '', method: PAYMENT_METHODS[1], reference: '', remarks: '' });
  const [payError, setPayError] = useState('');
  const [savingPay, setSavingPay] = useState(false);
  const [receipt, setReceipt] = useState<FeeInvoice | null>(null);
  const form = useForm<IssueForm>({ defaultValues: { studentId: '', feePeriod: 'Annual', baseAmount: '', concession: '0', lateFine: '0', dueDate: '' } });
  const values = useWatch({ control: form.control });
  const net = money(values.baseAmount || '') - money(values.concession || '') + money(values.lateFine || '');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const invoices = await listFeeInvoices();
      setRows(invoices);
      onCount?.(invoices.length);
    } catch (exception) {
      setRows([]);
      setError(explain(exception, 'Could not load invoices.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    listFeeInvoices()
      .then((invoices) => {
        if (!active) return;
        setRows(invoices);
        onCount?.(invoices.length);
      })
      .catch((exception: unknown) => {
        if (!active) return;
        setError(explain(exception, 'Could not load invoices.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    apiJson<any[]>('/api/students')
      .then((list) => {
        if (!active) return;
        setStudents((Array.isArray(list) ? list : []).map((student) => ({
          id: Number(student.id),
          label: `${student.firstName || ''} ${student.lastName || ''} (${student.admissionNo || 'No admission'} · ${student.classGrade || 'Class'})`.trim(),
        })));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [onCount]);

  const openIssue = () => {
    form.reset({ studentId: '', feePeriod: 'Annual', baseAmount: '', concession: '0', lateFine: '0', dueDate: '' });
    setPreview(null);
    setPreviewError('');
    setShowIssue(true);
  };

  useImperativeHandle(ref, () => ({ openIssue }));

  const chooseStudent = async (studentId: string) => {
    form.setValue('studentId', studentId, { shouldValidate: true });
    setPreview(null);
    setPreviewError('');
    if (!studentId) return;
    try {
      const next = await previewFeeInvoice(Number(studentId));
      setPreview(next);
      form.setValue('baseAmount', String(next.baseAmount));
      form.setValue('concession', String(next.concession));
      form.setValue('lateFine', String(next.lateFine));
      if (next.suggestedDueDate) form.setValue('dueDate', next.suggestedDueDate);
    } catch (exception) {
      setPreviewError(exception instanceof Error ? exception.message : 'Could not read the fee structure for this student.');
    }
  };

  const submitIssue = form.handleSubmit(async (input) => {
    setPreviewError('');
    if (preview && input.dueDate <= preview.effectiveDate) {
      setPreviewError(`Due date must be after the effective date (${preview.effectiveDate}). That is when this invoice becomes a due.`);
      return;
    }
    try {
      await issueFeeInvoice({
        studentId: Number(input.studentId),
        feePeriod: input.feePeriod,
        baseAmount: money(input.baseAmount),
        concession: money(input.concession),
        lateFine: money(input.lateFine),
        dueDate: input.dueDate,
      });
      setShowIssue(false);
      await load();
    } catch (exception) {
      setPreviewError(exception instanceof Error ? exception.message : 'Could not issue the invoice.');
    }
  });

  const openSettlement = (row: FeeInvoice) => {
    const year = new Date().getFullYear();
    const serial = String(Math.floor(1000 + Math.random() * 9000));
    setPayError('');
    setSettlement({
      receiptNo: `REC-${year}-${serial}`,
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: String(Math.max(row.totalBill - row.amountPaid, 0)),
      method: PAYMENT_METHODS[1],
      reference: '',
      remarks: '',
    });
    setPaying(row);
  };

  const submitPayment = async () => {
    if (!paying || savingPay) return;
    const outstanding = Math.max(paying.totalBill - paying.amountPaid, 0);
    const amount = money(settlement.amount);
    if (!settlement.paymentDate) {
      setPayError('Payment date is required.');
      return;
    }
    if (amount <= 0) {
      setPayError('Settlement amount must be greater than 0.');
      return;
    }
    if (amount > outstanding) {
      setPayError('Settlement cannot exceed the outstanding balance.');
      return;
    }
    setSavingPay(true);
    setPayError('');
    try {
      const updated = await recordFeePayment(paying.id, {
        amount,
        receiptNo: settlement.receiptNo,
        paymentDate: settlement.paymentDate,
        paymentMethod: settlement.method,
        referenceNo: settlement.reference,
        remarks: settlement.remarks,
      });
      setPaying(null);
      setReceipt(updated);
      await load();
    } catch (exception) {
      setPayError(exception instanceof Error ? exception.message : 'Could not record the settlement.');
    } finally {
      setSavingPay(false);
    }
  };

  const printReceipt = (invoice: FeeInvoice) => {
    if (Platform.OS !== 'web') return;
    const school = session?.school || 'School';
    const settled = invoice.status === 'PAID';
    const page = window.open('', '_blank', 'noopener,noreferrer');
    if (!page) return;
    page.document.write(`<!doctype html><title>${invoice.receiptNo}</title><body style="font-family:Inter,sans-serif;padding:32px;color:#14213d"><h1>Digital Fee Payment Receipt</h1><p>${school}</p><p>${invoice.receiptNo} · ${invoice.paymentDate}</p><p>${invoice.studentName}<br>${invoice.gradeLabel} · ${invoice.admissionNo}</p><p>${invoice.paymentMethod}<br>${invoice.referenceNo}</p><h2>Total Settlement Received: ₹${invoice.lastSettlementAmount || invoice.amountPaid}</h2><p>${settled ? 'PAID & SETTLED' : invoice.status}</p></body>`);
    page.document.close();
    page.focus();
    page.print();
  };

  const statusStyle = useMemo(() => ({
    PAID: { bg: colors.successBg, text: colors.successText },
    PARTIAL: { bg: colors.warningBg, text: colors.warningText },
    PENDING: { bg: colors.surface2, text: colors.textSecondary },
    OVERDUE: { bg: colors.dangerBg, text: colors.dangerText },
  }), [colors]);

  const inputStyle = { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: colors.text, backgroundColor: colors.surface };

  return (
    <View style={{ gap: 12 }}>
      {error ? <Text style={{ color: colors.dangerText }}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.brand} /> : (
        <DataTable
          rows={rows}
          empty="No invoices yet. Generate one from an active fee structure."
          keyExtractor={(row) => row.id}
          columns={[
            { key: 'no', header: 'Invoice No', flex: 1.2, minWidth: 140, render: (row) => <Text style={{ color: colors.brand, fontWeight: '700' }}>{row.invoiceNo}</Text> },
            { key: 'student', header: 'Student Name', flex: 1.4, minWidth: 150, render: (row) => (
              <View>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{row.studentName}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{row.gradeLabel}</Text>
              </View>
            ) },
            { key: 'period', header: 'Fee Period', flex: 1.2, minWidth: 140, render: (row) => <Text style={{ color: colors.text }}>{row.feePeriod}</Text> },
            { key: 'bill', header: 'Total Bill', flex: 0.9, minWidth: 100, render: (row) => <Text style={{ color: colors.text, fontWeight: '700' }}>{inr(row.totalBill)}</Text> },
            { key: 'paid', header: 'Amount Paid', flex: 0.9, minWidth: 100, render: (row) => <Text style={{ color: row.amountPaid > 0 ? colors.successText : colors.textMuted, fontWeight: '700' }}>{inr(row.amountPaid)}</Text> },
            { key: 'due', header: 'Due Date', width: 110, render: (row) => <Text style={{ color: colors.text }}>{row.dueDate}</Text> },
            { key: 'status', header: 'Status', width: 100, render: (row) => (
              <View style={{ alignSelf: 'flex-start', backgroundColor: statusStyle[row.status].bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: statusStyle[row.status].text, fontSize: 11, fontWeight: '800' }}>{row.status}</Text>
              </View>
            ) },
            { key: 'settlement', header: 'Settlement', width: 120, render: (row) => row.status === 'PAID' ? (
              <Pressable onPress={() => setReceipt(row)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 }}>
                <Ionicons name="receipt-outline" size={14} color={colors.textSecondary} />
                <Text style={{ color: colors.text, fontWeight: '600' }}>Receipt</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => openSettlement(row)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brand, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 }}>
                <Ionicons name="card-outline" size={14} color={colors.onBrand} />
                <Text style={{ color: colors.onBrand, fontWeight: '700' }}>Record Pay</Text>
              </Pressable>
            ) },
          ]}
        />
      )}
      <Modal visible={showIssue} transparent animationType="fade" onRequestClose={() => setShowIssue(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(20,33,61,0.45)', justifyContent: 'center', alignItems: 'center', padding: compact ? 12 : 20 }}>
          <View style={{ width: '100%', maxWidth: 640, maxHeight: height - (compact ? 24 : 80), backgroundColor: colors.surface, borderRadius: 16, padding: compact ? 14 : 20, gap: 12, overflow: 'hidden' }}>
            <ScrollView contentContainerStyle={{ gap: 12 }} style={{ maxHeight: height - (compact ? 80 : 140) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Generate Single Student Fee Invoice</Text>
                <Text style={{ color: colors.textSecondary, marginTop: 4 }}>Issue an individual tuition or composite fee bill for an enrolled pupil.</Text>
              </View>
              <Pressable onPress={() => setShowIssue(false)}><Text style={{ fontSize: 20, color: colors.textMuted }}>×</Text></Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              <View style={{ flexGrow: 1, flexBasis: fieldBasis }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Select Student *</Text>
                {Platform.OS === 'web' ? React.createElement('select', {
                  value: values.studentId,
                  onChange: (event: { target: { value: string } }) => chooseStudent(event.target.value),
                  style: { width: '100%', height: 40, borderRadius: 8, border: `1px solid ${colors.border}`, padding: '0 10px' },
                }, React.createElement('option', { value: '' }, 'Choose a student'), students.map((student) => React.createElement('option', { key: student.id, value: String(student.id) }, student.label))) : (
                  <TextInput value={values.studentId} onChangeText={chooseStudent} placeholder="Student id" style={inputStyle} />
                )}
              </View>
              <View style={{ flexGrow: 1, flexBasis: fieldBasis }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Enrollment ID</Text>
                <TextInput editable={false} value={preview?.enrollmentId || ''} style={[inputStyle, { backgroundColor: colors.surface2 }]} />
              </View>
              <View style={{ flexGrow: 1, flexBasis: fieldBasis }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Billing Period / Quarter</Text>
                {Platform.OS === 'web' ? React.createElement('select', {
                  value: values.feePeriod,
                  onChange: (event: { target: { value: string } }) => form.setValue('feePeriod', event.target.value),
                  style: { width: '100%', height: 40, borderRadius: 8, border: `1px solid ${colors.border}`, padding: '0 10px' },
                }, BILLING_PERIODS.map((period) => React.createElement('option', { key: period, value: period }, period))) : null}
              </View>
              <View style={{ flexGrow: 1, flexBasis: fieldBasis }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Base Amount (₹) *</Text>
                <TextInput value={values.baseAmount} onChangeText={(value) => form.setValue('baseAmount', value)} keyboardType="decimal-pad" style={inputStyle} />
              </View>
              <View style={{ flexGrow: 1, flexBasis: fieldBasis }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Concession / Discount (₹)</Text>
                <TextInput value={values.concession} onChangeText={(value) => form.setValue('concession', value)} keyboardType="decimal-pad" style={[inputStyle, { color: colors.successText }]} />
              </View>
              <View style={{ flexGrow: 1, flexBasis: fieldBasis }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Late Fine Surcharge (₹)</Text>
                <TextInput value={values.lateFine} onChangeText={(value) => form.setValue('lateFine', value)} keyboardType="decimal-pad" style={[inputStyle, { color: colors.dangerText }]} />
              </View>
              <View style={{ width: '100%' }}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Payment Due Date *</Text>
                <DateField value={values.dueDate || ''} onChange={(value) => form.setValue('dueDate', value)} />
                {preview ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Effective date {preview.effectiveDate}. Due date has to be later than this, from {preview.feeStructureName}.</Text> : null}
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, backgroundColor: colors.surface2 }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Net Payable Invoice Amount:</Text>
              <Text style={{ color: colors.brand, fontWeight: '800', fontSize: 18 }}>{inr(net)}</Text>
            </View>
            {previewError ? <Text style={{ color: colors.dangerText }}>{previewError}</Text> : null}
            <View style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 10 }}>
              <Pressable onPress={() => setShowIssue(false)}><Text style={{ color: colors.textSecondary, fontWeight: '700', padding: 10 }}>Cancel</Text></Pressable>
              <Pressable onPress={submitIssue} style={{ minHeight: 40, backgroundColor: colors.brand, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' }}>
                <Text style={{ color: colors.onBrand, fontWeight: '700' }}>{form.formState.isSubmitting ? 'Issuing...' : 'Issue Student Invoice'}</Text>
              </Pressable>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={paying !== null} transparent animationType="fade" onRequestClose={() => setPaying(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(20,33,61,0.45)', justifyContent: 'center', alignItems: 'center', padding: compact ? 12 : 20 }}>
          <View style={{ width: '100%', maxWidth: 560, maxHeight: height - (compact ? 24 : 80), backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' }}>
            <ScrollView contentContainerStyle={{ padding: compact ? 14 : 22, gap: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Record Fee Settlement — {paying?.invoiceNo}</Text>
                  <Text style={{ color: colors.textSecondary, marginTop: 6 }}>Student: {paying?.studentName} ({paying?.gradeLabel})</Text>
                </View>
                <Pressable onPress={() => setPaying(null)}><Text style={{ fontSize: 22, color: colors.textMuted }}>×</Text></Pressable>
              </View>
              <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface2, padding: 14, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ color: colors.textSecondary }}>Student Name & Grade:</Text>
                  <Text style={{ color: colors.text, fontWeight: '800', flexShrink: 1, textAlign: 'right' }}>{paying?.studentName} ({paying?.gradeLabel})</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ color: colors.textSecondary }}>Outstanding Balance:</Text>
                  <Text style={{ color: colors.dangerText, fontWeight: '800' }}>{inr(Math.max((paying?.totalBill || 0) - (paying?.amountPaid || 0), 0))}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                <View style={{ flexGrow: 1, flexBasis: compact ? '100%' : 220 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Receipt Number</Text>
                  <TextInput editable={false} value={settlement.receiptNo} style={[inputStyle, { backgroundColor: colors.surface2 }]} />
                </View>
                <View style={{ flexGrow: 1, flexBasis: compact ? '100%' : 220 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Payment Date *</Text>
                  <DateField value={settlement.paymentDate} onChange={(paymentDate) => setSettlement((current) => ({ ...current, paymentDate }))} />
                </View>
                <View style={{ flexGrow: 1, flexBasis: compact ? '100%' : 220 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Settlement Amount (₹) *</Text>
                  <TextInput value={settlement.amount} onChangeText={(amount) => setSettlement((current) => ({ ...current, amount }))} keyboardType="decimal-pad" style={[inputStyle, { color: colors.successText, fontWeight: '700' }]} />
                </View>
                <View style={{ flexGrow: 1, flexBasis: compact ? '100%' : 220 }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Payment Method *</Text>
                  {Platform.OS === 'web' ? React.createElement('select', {
                    value: settlement.method,
                    onChange: (event: { target: { value: string } }) => setSettlement((current) => ({ ...current, method: event.target.value })),
                    style: { width: '100%', height: 42, borderRadius: 8, border: `1px solid ${colors.border}`, padding: '0 10px', color: colors.text },
                  }, PAYMENT_METHODS.map((method) => React.createElement('option', { key: method, value: method }, method))) : (
                    <TextInput value={settlement.method} onChangeText={(method) => setSettlement((current) => ({ ...current, method }))} style={inputStyle} />
                  )}
                </View>
              </View>
              <View>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Reference Number / Cheque #</Text>
                <TextInput value={settlement.reference} onChangeText={(reference) => setSettlement((current) => ({ ...current, reference }))} placeholder="TXN or cheque number" placeholderTextColor={colors.textMuted} style={inputStyle} />
              </View>
              <View>
                <Text style={{ color: colors.textSecondary, fontWeight: '600', marginBottom: 6 }}>Settlement Remarks</Text>
                <TextInput value={settlement.remarks} onChangeText={(remarks) => setSettlement((current) => ({ ...current, remarks }))} placeholder="Notes for this collection" placeholderTextColor={colors.textMuted} multiline style={[inputStyle, { minHeight: 72 }]} />
              </View>
              {payError ? <Text style={{ color: colors.dangerText }}>{payError}</Text> : null}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 }}>
                <Pressable onPress={() => setPaying(null)}><Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text></Pressable>
                <Pressable onPress={submitPayment} style={{ backgroundColor: colors.brand, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
                  <Text style={{ color: colors.onBrand, fontWeight: '800' }}>{savingPay ? 'Saving...' : 'Reconcile & Issue Receipt'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={receipt !== null} transparent animationType="fade" onRequestClose={() => setReceipt(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(20,33,61,0.45)', justifyContent: 'center', alignItems: 'center', padding: compact ? 12 : 20 }}>
          <View style={{ width: '100%', maxWidth: 640, maxHeight: height - (compact ? 24 : 80), backgroundColor: colors.surface, borderRadius: 16, padding: compact ? 14 : 22, gap: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Digital Fee Payment Receipt</Text>
                <Text style={{ color: colors.textSecondary, marginTop: 4 }}>Official electronic settlement receipt for student accounting</Text>
              </View>
              <Pressable onPress={() => setReceipt(null)}><Text style={{ fontSize: 22, color: colors.textMuted }}>×</Text></Pressable>
            </View>
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{session?.school || 'School'}</Text>
                  <Text style={{ color: colors.textSecondary, marginTop: 4 }}>Official Fee Collection Voucher</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontWeight: '800', color: colors.text }}>{receipt?.receiptNo}</Text>
                  <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{receipt?.paymentDate}</Text>
                  <View style={{ marginTop: 8, backgroundColor: colors.successBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: colors.successText, fontSize: 11, fontWeight: '800' }}>{receipt?.status === 'PAID' ? 'PAID & SETTLED' : receipt?.status}</Text>
                  </View>
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Student Details</Text>
                  <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginTop: 4 }}>{receipt?.studentName}</Text>
                  <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{receipt?.gradeLabel} · {receipt?.admissionNo}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>Payment Particulars</Text>
                  <Text style={{ color: colors.text, fontWeight: '800', marginTop: 4 }}>{receipt?.paymentMethod?.startsWith('UPI') ? 'UPI' : receipt?.paymentMethod}</Text>
                  <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{receipt?.referenceNo || '—'}</Text>
                </View>
              </View>
              <View style={{ height: 1, backgroundColor: colors.border }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Total Settlement Received:</Text>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.successText }}>{receipt ? inr(receipt.lastSettlementAmount || receipt.amountPaid) : ''}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
              <Pressable onPress={() => setReceipt(null)}><Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Close</Text></Pressable>
              <Pressable onPress={() => { if (receipt) printReceipt(receipt); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.brand, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 }}>
                <Ionicons name="print-outline" size={16} color={colors.onBrand} />
                <Text style={{ color: colors.onBrand, fontWeight: '800' }}>Print Receipt</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

export default FeeInvoicesPanel;
