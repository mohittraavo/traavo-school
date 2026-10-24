import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { DrawerContentScrollView } from '../navigation/drawer';
import TravoLogo from './TravoLogo';
import { useTheme } from '../theme/ThemeContext';

const NAV = [
  { label: 'Dashboard', hint: 'School pulse and KPIs', glyph: 'DB', route: 'Dashboard' },
  { label: 'Campuses', hint: 'Campuses and capacity', glyph: 'CM', route: 'Campuses' },
  { label: 'Students', hint: 'Roster, bulk upload, export', glyph: 'SD', route: 'Students' },
  { label: 'Staff', hint: 'Faculty and staff', glyph: 'TC', route: 'Staff' },
  { label: 'Fee Structures', hint: 'Fee plans and schedules', glyph: 'FS', route: 'Fee Structures' },
  { label: 'Admissions', hint: 'Applications and intake', glyph: 'AD', route: 'Admissions' },
  { label: 'Classes & Structure', hint: 'Academics · grades and sections', glyph: 'CS', route: 'Classes & Structure', section: 'Academics' },
  { label: 'Settings', hint: 'School configuration', glyph: 'SE', route: 'Settings' },
];

export default function Sidebar(props: any) {
  const { colors } = useTheme();
  const { session, onLogout } = props;

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={[styles.drawerContainer, { backgroundColor: colors.surface }]}>
      <View style={[styles.railBrand, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <TravoLogo size={36} />
        <Text style={styles.logoShell}>
          <Text style={{ color: colors.text, fontWeight: '600', fontSize: 22 }}>Traa</Text>
          <Text style={{ color: colors.brand, fontWeight: '600', fontSize: 22 }}>vo</Text>
        </Text>
      </View>

      <View style={styles.nav}>
        {NAV.map((item) => {
          const current = props.state?.routes[props.state.index]?.name;
          const active = current === item.route || (item.route === 'Students' && current === 'Student Form') || (item.route === 'Staff' && current === 'Teaching Assignments');
          return (
            <React.Fragment key={item.route}>
            {'section' in item && item.section ? (
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 8, marginLeft: 4, textTransform: 'uppercase' }}>{item.section}</Text>
            ) : null}
            <Pressable
              onPress={() => props.navigation.navigate(item.route)}
              style={[
                styles.menuBtn,
                { borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brand : colors.surface },
              ]}
            >
              <View
                style={[
                  styles.glyph,
                  {
                    borderColor: active ? 'rgba(255,255,255,0.45)' : colors.border,
                    backgroundColor: active ? 'rgba(255,255,255,0.18)' : colors.surface2,
                  },
                ]}
              >
                <Text style={{ color: active ? colors.onBrand : colors.brand, fontSize: 10, fontWeight: '700' }}>{item.glyph}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: active ? colors.onBrand : colors.text, fontWeight: '600', fontSize: 13 }}>{item.label}</Text>
                <Text style={{ color: active ? colors.onBrand : colors.textSecondary, fontSize: 11.5, marginTop: 1 }}>{item.hint}</Text>
              </View>
            </Pressable>
            </React.Fragment>
          );
        })}
      </View>

      <View style={{ flex: 1 }} />

      <View style={[styles.profileCard, { borderColor: colors.border, backgroundColor: colors.surface2 }]}>
        <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
          <Text style={{ color: colors.onBrand, fontWeight: '700' }}>{session?.name?.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{session?.name}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{session?.role}</Text>
        </View>
      </View>

      <Pressable onPress={onLogout} style={[styles.ghostBtn, { borderColor: colors.border }]}>
        <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 13 }}>Sign out</Text>
      </Pressable>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  drawerContainer: { flexGrow: 1, paddingTop: 0, paddingBottom: 16 },
  railBrand: {
    minHeight: 84,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
  },
  logoShell: { fontFamily: 'Inter', fontWeight: '600' },
  nav: { padding: 12, gap: 8 },
  menuBtn: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  glyph: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ghostBtn: {
    marginHorizontal: 12,
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 10,
    alignItems: 'center',
  },
});
