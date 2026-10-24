import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export type Crumb = { label: string; route?: string };

export default function Topbar({ toggle, session, onLogout, title, crumbs, navigation }: any) {
  const { colors, toggle: toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const { width } = useWindowDimensions();
  const showMenuButton = width < 820;
  const compact = showMenuButton;

  return (
    <View style={[styles.topbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }, compact && styles.topbarCompact]}>
      <View style={styles.row}>
        <View style={styles.left}>
          {showMenuButton ? (
            <Pressable onPress={toggle} style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 18 }}>☰</Text>
            </Pressable>
          ) : null}
          <View style={styles.heading}>
            <Breadcrumbs crumbs={crumbs} navigation={navigation} />
            <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>{title || 'Dashboard'}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={toggleTheme}
            style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            accessibilityLabel="Toggle theme"
          >
            <Text style={{ color: colors.textSecondary, fontSize: 17 }}>◐</Text>
          </Pressable>

          <View>
            <Pressable
              onPress={() => setMenuOpen((open) => !open)}
              style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>👤</Text>
            </Pressable>
            {menuOpen ? (
              <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={{ color: colors.textMuted, fontSize: 12, paddingHorizontal: 9, paddingVertical: 6 }}>
                  {session?.name}{Platform.OS === 'web' ? '' : ''}
                </Text>
                <Pressable
                  onPress={() => {
                    setMenuOpen(false);
                    onLogout?.();
                  }}
                  style={styles.menuItem}
                >
                  <Text style={{ color: colors.text, fontSize: 13 }}>Sign out</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function Breadcrumbs({ crumbs, navigation }: { crumbs?: Crumb[]; navigation?: { navigate?: (route: string) => void } }) {
  const { colors } = useTheme();
  const trail = crumbs?.length ? crumbs : [{ label: 'Dashboard' }];
  return (
    <View style={styles.crumbs}>
      {trail.map((crumb, index) => {
        const current = index === trail.length - 1;
        const pressable = Boolean(crumb.route) && !current;
        return (
          <View key={`${crumb.label}-${index}`} style={styles.crumbItem}>
            {index > 0 ? <Text style={[styles.crumbSep, { color: colors.textMuted }]}>/</Text> : null}
            {pressable ? (
              <Pressable onPress={() => navigation?.navigate?.(crumb.route!)} hitSlop={6}>
                <Text style={[styles.crumbText, { color: colors.brand }]}>{crumb.label}</Text>
              </Pressable>
            ) : (
              <Text style={[styles.crumbText, { color: current ? colors.textSecondary : colors.textMuted, fontWeight: current ? '600' : '500' }]}>{crumb.label}</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    minHeight: 84,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    zIndex: 50,
    justifyContent: 'center',
  },
  topbarCompact: {
    minHeight: 72,
    paddingHorizontal: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  heading: { flex: 1, minWidth: 0, gap: 2 },
  crumbs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  crumbItem: { flexDirection: 'row', alignItems: 'center' },
  crumbText: { fontSize: 12, fontFamily: 'Inter' },
  crumbSep: { fontSize: 12, marginHorizontal: 6 },
  title: { fontSize: 22, fontWeight: '700', fontFamily: 'Inter' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    position: 'absolute',
    right: 0,
    top: 46,
    minWidth: 196,
    borderWidth: 1,
    borderRadius: 9,
    padding: 4,
    zIndex: 90,
  },
  menuItem: { paddingVertical: 8, paddingHorizontal: 9, borderRadius: 7 },
});
