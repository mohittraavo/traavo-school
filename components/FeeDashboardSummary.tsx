import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { listFeeStructures } from '../api/feeStructures';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/tokens';
import { finalNet, inr, type FeeStructure } from './feeStructureModel';

export default function FeeDashboardSummary() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const styles = makeStyles(colors, width < 820);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listFeeStructures()
      .then((rows) => { if (active) setStructures(rows); })
      .catch((exception) => { if (active) setError(exception instanceof Error ? exception.message : 'Could not load fee summary.'); });
    return () => { active = false; };
  }, []);

  const activeStructures = structures.filter((structure) => structure.status === 'Active');
  const configuredValue = activeStructures.reduce((sum, structure) => sum + structure.classSchedules.reduce((inner, schedule) => inner + finalNet(schedule), 0), 0);
  const coveredClasses = new Set(activeStructures.flatMap((structure) => structure.classSchedules.map((schedule) => schedule.className))).size;

  return (
    <View style={styles.wrap}>
      <View style={styles.heading}>
        <Text style={styles.kicker}>FEES</Text>
      </View>
      <View style={styles.row}>
        <View style={styles.card}>
          <View style={styles.top}><Text style={styles.label}>TOTAL CONFIGURED</Text><Ionicons name="cash-outline" size={16} color={colors.textMuted} /></View>
          <Text style={styles.value}>{inr(configuredValue)}</Text>
          <Text style={styles.hint}>Across active fee structures</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.top}><Text style={[styles.label, { color: colors.successText }]}>ACTIVE STRUCTURES</Text><Ionicons name="checkmark-circle-outline" size={16} color={colors.successText} /></View>
          <Text style={[styles.value, { color: colors.successText }]}>{activeStructures.length}</Text>
          <Text style={styles.hint}>Ready for billing</Text>
        </View>
        <View style={styles.card}>
          <View style={styles.top}><Text style={[styles.label, { color: colors.dangerText }]}>CLASSES COVERED</Text><Ionicons name="alert-circle-outline" size={16} color={colors.dangerText} /></View>
          <Text style={[styles.value, { color: colors.dangerText }]}>{coveredClasses}</Text>
          <Text style={styles.hint}>On active structures</Text>
        </View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function makeStyles(colors: ThemeColors, compact: boolean) {
  return StyleSheet.create({
    wrap: { gap: 12 },
    heading: { gap: 4 },
    kicker: { color: colors.brand, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
    title: { color: colors.text, fontSize: 20, fontWeight: '700' },
    subtitle: { color: colors.textSecondary, fontSize: 13, lineHeight: 18, maxWidth: 720 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    card: {
      flexGrow: 1,
      flexBasis: compact ? '100%' : 220,
      minWidth: compact ? 0 : 160,
      width: compact ? '100%' : undefined,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      gap: 6,
    },
    top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
    value: { color: colors.text, fontSize: 28, fontWeight: '700' },
    hint: { color: colors.textSecondary, fontSize: 12 },
    error: { color: colors.dangerText, fontSize: 12 },
  });
}
