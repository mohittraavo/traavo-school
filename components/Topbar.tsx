import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export default function Topbar({ toggle, session, onLogout, title }: any) {
  const { colors, toggle: toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const { width } = useWindowDimensions();
  const showMenuButton = width < 820;

  return (
    <View style={[styles.topbar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          {showMenuButton ? (
            <Pressable onPress={toggle} style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.textSecondary, fontSize: 18 }}>☰</Text>
            </Pressable>
          ) : null}
          <Text style={[styles.title, { color: colors.text }]}>{title || 'Dashboard'}</Text>
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

const styles = StyleSheet.create({
  topbar: {
    minHeight: 84,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    zIndex: 50,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  title: { fontSize: 24, fontWeight: '700', fontFamily: 'Poppins' },
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
