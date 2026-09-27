import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export default function TravoLogo({ size = 36 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: colors.brand, fontWeight: '800', fontSize: Math.max(14, size * 0.42) }}>T</Text>
    </View>
  );
}
