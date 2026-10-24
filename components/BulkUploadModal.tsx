import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, Platform, Alert, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { apiDownload, apiFetch } from '../api/client';

type ImportError = { row?: number; admissionNo?: string; messages?: string[] };

export default function BulkUploadModal({
  visible,
  onClose,
  onImported,
  title = 'Bulk upload',
  description = 'Upload Excel (.xlsx) or CSV. Columns are matched by header name (* and hints in parentheses are ignored). Valid rows are imported even if others fail.',
  templatePath = '/api/students/template',
  templateFilename = 'students-template.xlsx',
  uploadPath = '/api/students/bulk-upload',
  accept = '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv',
  acceptedLabel = 'Accepted: .xlsx / .xls / .csv',
  exportPath,
  exportFilename = 'export.csv',
}: {
  visible: boolean;
  onClose: () => void;
  onImported: () => Promise<void> | void;
  title?: string;
  description?: string;
  templatePath?: string;
  templateFilename?: string;
  uploadPath?: string;
  accept?: string;
  acceptedLabel?: string;
  exportPath?: string;
  exportFilename?: string;
}) {
  const { colors } = useTheme();
  const { height, width } = useWindowDimensions();
  const compact = width < 820;
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState('');
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [exporting, setExporting] = useState(false);

  const ghostBtn = { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: colors.surface, borderRadius: 9, borderWidth: 1, borderColor: colors.border, alignItems: 'center' as const, justifyContent: 'center' as const, flexDirection: 'row' as const, gap: 8 };
  const primaryBtn = { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.brand, borderRadius: 9, alignItems: 'center' as const, justifyContent: 'center' as const, flexDirection: 'row' as const, gap: 8 };

  const reset = () => {
    setFileName('');
    setUploading(false);
    setSummary('');
    setErrors([]);
    setExporting(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const downloadTemplate = async () => {
    try {
      await apiDownload(templatePath, templateFilename);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not download template. Is the backend running on port 8083?');
    }
  };

  const downloadExport = async () => {
    if (!exportPath) return;
    setExporting(true);
    try {
      await apiDownload(exportPath, exportFilename);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Could not export. Is the backend running on port 8083?');
    } finally {
      setExporting(false);
    }
  };

  const pickAndUpload = () => {
    if (typeof document === 'undefined') {
      Alert.alert('Not supported', 'Bulk upload is supported on the web build');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];
      setFileName(file.name);
      setUploading(true);
      setSummary('');
      setErrors([]);
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await apiFetch(uploadPath, { method: 'POST', body: fd });
        const json = await res.json();
        if (!res.ok && json.message) {
          setSummary(json.message);
          setUploading(false);
          return;
        }
        const imported = json.imported ?? 0;
        const failed = json.failed ?? (json.errors ? json.errors.length : 0);
        setSummary(`Imported ${imported} of ${json.total ?? imported + failed}. Failed: ${failed}.`);
        if (json.errors && json.errors.length) setErrors(json.errors);
        await onImported();
      } catch (e) {
        console.error(e);
        setSummary('Upload failed. Is the backend running on port 8083?');
      }
      setUploading(false);
    };
    input.click();
  };

  return (
    <Modal visible={visible} transparent animationType={Platform.OS === 'web' ? 'none' : 'fade'} onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20, 33, 61, 0.52)', padding: compact ? 12 : 24, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 520, maxHeight: height - (compact ? 24 : 80), backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: 'hidden', ...(Platform.OS === 'web' ? { boxShadow: '0 28px 70px rgba(20,33,61,0.22)' } : { elevation: 16 }) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: compact ? 14 : 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="cloud-upload-outline" size={22} color={colors.brand} />
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>{title}</Text>
            </View>
            <Pressable onPress={close} style={{ width: 32, height: 32, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={16} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: compact ? 14 : 24 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
              {description}
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <Pressable onPress={downloadTemplate} style={ghostBtn}>
                <Ionicons name="download-outline" size={16} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Download template</Text>
              </Pressable>
              {exportPath ? (
                <Pressable onPress={downloadExport} disabled={exporting} style={[ghostBtn, exporting ? { opacity: 0.7 } : null]}>
                  <Ionicons name="share-outline" size={16} color={colors.textSecondary} />
                  <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{exporting ? 'Exporting...' : 'Export directory'}</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface2, borderRadius: 12, padding: 22, alignItems: 'center', marginBottom: 14 }}>
              <Ionicons name="document-attach-outline" size={32} color={colors.brand} />
              <Text style={{ marginTop: 10, fontWeight: '700', color: colors.text }}>{fileName || 'No file selected'}</Text>
              <Text style={{ marginTop: 4, color: colors.textMuted, fontSize: 12 }}>{acceptedLabel}</Text>
            </View>

            {summary ? (
              <View style={{ backgroundColor: errors.length ? colors.warningBg : colors.successBg, borderRadius: 10, padding: 10, marginBottom: 12 }}>
                <Text style={{ color: errors.length ? colors.warningText : colors.successText, fontSize: 13 }}>{summary}</Text>
              </View>
            ) : null}

            {errors.map((e, idx) => (
              <View key={idx} style={{ padding: 10, borderWidth: 1, borderColor: colors.dangerBg, backgroundColor: colors.dangerBg, marginBottom: 8, borderRadius: 10 }}>
                <Text style={{ fontWeight: '700', color: colors.dangerText }}>Row: {e.row} Admission: {e.admissionNo || '-'}</Text>
                <Text style={{ color: colors.dangerText }}>{(e.messages || []).join('\n')}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Pressable onPress={close} style={ghostBtn}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={pickAndUpload} disabled={uploading} style={[primaryBtn, uploading ? { opacity: 0.7 } : null]}>
              <Ionicons name="cloud-upload-outline" size={16} color={colors.onBrand} />
              <Text style={{ color: colors.onBrand, fontWeight: '600' }}>{uploading ? 'Uploading...' : 'Upload'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
