import React from 'react';
import { Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Controller, type Control, type RegisterOptions } from 'react-hook-form';
import { useTheme } from '../../theme/ThemeContext';
import { DateField } from './DateField';
import { isCompactWidth } from '../../theme/layout';

type FormFieldProps = {
  control: Control<Record<string, string>>;
  name: string;
  label: string;
  rules?: RegisterOptions<Record<string, string>>;
  required?: boolean;
  hint?: string;
  options?: string[];
  span?: 2;
  date?: boolean;
  keyboardType?: 'default' | 'number-pad';
};

export function FormField({ control, name, label, rules, required, hint, options, span, date, keyboardType = 'default' }: FormFieldProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const stacked = isCompactWidth(width) || span === 2;

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field, fieldState }) => {
        const selected = field.value || '';
        const invalid = Boolean(fieldState.error);
        return (
          <View nativeID={`field-${name}`} style={{ width: stacked ? '100%' : '48%', minWidth: stacked ? 0 : 220, flexGrow: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>
              {label}{required ? ' *' : ''}{hint ? ` (${hint})` : ''}
            </Text>
            {date ? (
              <DateField value={selected} onChange={(next) => { field.onChange(next); field.onBlur(); }} />
            ) : options ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {options.map((option) => {
                  const active = selected.toLowerCase() === option.toLowerCase();
                  return (
                    <Pressable
                      key={option}
                      onPress={() => { field.onChange(option); field.onBlur(); }}
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
                placeholder={hint || label}
                placeholderTextColor={colors.textMuted}
                value={selected}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                keyboardType={keyboardType}
                style={{
                  borderWidth: 1,
                  borderColor: invalid ? colors.dangerText : colors.border,
                  backgroundColor: colors.surface,
                  color: colors.text,
                  padding: 10,
                  borderRadius: 9,
                }}
              />
            )}
            {fieldState.error?.message ? <Text style={{ marginTop: 5, fontSize: 12, color: colors.dangerText }}>{fieldState.error.message}</Text> : null}
          </View>
        );
      }}
    />
  );
}
