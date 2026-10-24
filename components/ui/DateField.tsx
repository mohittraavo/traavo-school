import React, { useState } from 'react';
import { Modal, Platform, Pressable, Text, View, type ViewStyle } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';

function parseIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toIso(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function labelFor(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Select date';
  return parseIso(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function DateField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { colors, name } = useTheme();
  const [open, setOpen] = useState(false);
  const box: ViewStyle = {
    height: 40,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingLeft: 10,
    paddingRight: 8,
  };

  if (Platform.OS === 'web') {
    return React.createElement('input', {
      type: 'date',
      value: value || '',
      onChange: (event: { currentTarget: { value: string } }) => onChange(event.currentTarget.value),
      style: {
        ...box,
        boxSizing: 'border-box',
        borderStyle: 'solid',
        color: value ? colors.text : colors.textMuted,
        colorScheme: name,
        fontSize: 14,
        fontFamily: 'inherit',
      },
    });
  }

  const apply = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed') {
      setOpen(false);
      return;
    }
    if (date) onChange(toIso(date));
  };

  return (
    <View>
      <Pressable onPress={() => setOpen(true)} style={{ ...box, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: value ? colors.text : colors.textMuted, fontSize: 14 }}>{labelFor(value)}</Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
      </Pressable>
      {open && Platform.OS === 'android' ? (
        <DateTimePicker value={parseIso(value)} mode="date" display="default" onChange={apply} />
      ) : null}
      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', padding: 16 }}>
            <Pressable onPress={() => undefined} style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 12 }}>
              <DateTimePicker value={parseIso(value)} mode="date" display="inline" themeVariant={name} onChange={apply} />
              <Pressable onPress={() => setOpen(false)} style={{ alignSelf: 'flex-end', backgroundColor: colors.brand, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 }}>
                <Text style={{ color: colors.onBrand, fontWeight: '700' }}>Done</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}
