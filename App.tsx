import { StatusBar } from 'expo-status-bar';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, SafeAreaView, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { NavigationContainer, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Topbar from './components/Topbar';
import Sidebar from './components/Sidebar';
import { createDrawerNavigator } from './navigation/drawer';
import StudentsManager from './components/StudentsManager';
import StudentFormPage from './components/StudentFormModal';
import StaffDirectory, { StaffDashboardSummary } from './components/StaffDirectory';
import TeachingAssignments from './components/TeachingAssignments';
import FeeStructureManager from './components/FeeStructureManager';
import FeeDashboardSummary from './components/FeeDashboardSummary';
import AcademicSetup from './components/AcademicSetup';
import AdmissionsManager, { AdmissionsDashboardSummary } from './components/AdmissionsManager';
import TravoLogo from './components/TravoLogo';
import { LoadableErrorBoundary } from './components/ui/LoadableErrorBoundary';
import { ThemeProvider, useAppStyles, useTheme } from './theme/ThemeContext';
import { AuthProvider, useAuth, type SchoolSession } from './auth/AuthContext';

if (Platform.OS === 'web') {
  // Side-effect imports that only exist on web.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-gesture-handler');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./theme.css');
}

// --- Types & Mock Data (kept from original) ---
type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT';
type Session = SchoolSession;

type Campus = {
  id: string;
  name: string;
  city: string;
  students: number;
  teachers: number;
  attendance: string;
  fees: string;
};

const campuses: Campus[] = [
  { id: 'main', name: 'Green Valley Main Campus', city: 'Noida', students: 2140, teachers: 118, attendance: '96.8%', fees: '₹18.2L' },
  { id: 'east', name: 'Green Valley East Campus', city: 'Greater Noida', students: 1665, teachers: 92, attendance: '95.5%', fees: '₹14.7L' },
  { id: 'south', name: 'Green Valley South Campus', city: 'Ghaziabad', students: 1324, teachers: 76, attendance: '94.9%', fees: '₹11.4L' },
];

// --- Navigation setup ---
const Stack = createNativeStackNavigator();
const Drawer = Platform.OS === 'web' ? createDrawerNavigator() : null;

// --- App (root) ---
export default function App() {
  return (
    <ThemeProvider>
      <LoadableErrorBoundary>
        <AuthProvider>
          <AppRoot />
        </AuthProvider>
      </LoadableErrorBoundary>
    </ThemeProvider>
  );
}

function AppRoot() {
  const { session, logout, booting } = useAuth();
  const { width } = useWindowDimensions();
  const isMobile = width < 820;
  const styles = useAppStyles();
  const { name, colors } = useTheme();

  if (booting) {
    return (
      <SafeAreaView style={[styles.safeArea, { alignItems: 'center', justifyContent: 'center' }]}>
        <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
        <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Loading workspace...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <NavigationContainer linking={Platform.OS === 'web' ? (session ? drawerLinking : authLinking) : undefined}>
        {session ? (
          <AppDrawer session={session} onLogout={logout} isMobile={isMobile} />
        ) : (
          <AuthStack isMobile={isMobile} />
        )}
      </NavigationContainer>
    </SafeAreaView>
  );
}

// --- Auth stack (Sign in / Sign up) ---
function AuthStack({ isMobile }: { isMobile: boolean }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SignIn">
        {(props) => <AuthScreen {...props} isMobile={isMobile} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function AuthScreen({ isMobile }: { isMobile: boolean }) {
  const styles = useAppStyles();
  const { login } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('admin@greenvalley.edu');
  const [password, setPassword] = useState('Admin@123');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requestOtp = () => {
    if (!email.trim()) {
      setError('Enter the school email to receive the OTP.');
      return;
    }
    setError('');
    setOtpSent(true);
  };

  const handleGoogle = () => {
    setError('Google sign-in is not configured for this school workspace.');
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required to sign in.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const verifySignup = () => {
    setError('New accounts are created by the school admin. Sign in with your issued credentials.');
  };

  return (
    <ScrollView style={[styles.loginScroll, isMobile && styles.loginScrollMobile]} contentContainerStyle={[styles.loginScrollContent, isMobile && styles.loginScrollContentMobile]} showsVerticalScrollIndicator bounces={false}>
      {!isMobile ? (
        <View style={[styles.loginLeftCard, isMobile && styles.loginLeftCardMobile]}>
          <View style={styles.logoRow}>
            <TravoLogo size={54} />
            <Text style={styles.brandText}><Text style={styles.brandTra}>Traa</Text><Text style={styles.brandVo}>vo</Text></Text>
          </View>
          <Text style={styles.loginKicker}>School Workspace</Text>
          <Text style={styles.heroTitle}>Traavo School Management</Text>
          <Text style={styles.heroSubtitle}>Manage students, campuses, staff, and admissions from one secure school workspace.</Text>
          <View style={styles.loginValueCard}>
            <Text style={styles.infoTitle}>Bulk student intake</Text>
            <Text style={styles.infoText}>Upload Excel, download templates, and keep UDISE / APAAR records clean.</Text>
          </View>
          <View style={styles.loginValueCard}>
            <Text style={styles.infoTitle}>Campus operations</Text>
            <Text style={styles.infoText}>Track attendance, fees, and staff from the same Traavo design system as TCMS.</Text>
          </View>
        </View>
      ) : (
        <View style={styles.mobileHeader}>
          <View style={styles.logoRow}>
            <TravoLogo size={36} />
            <Text style={styles.brandText}><Text style={styles.brandTra}>Traa</Text><Text style={styles.brandVo}>vo</Text></Text>
          </View>
        </View>
      )}

      <View style={[styles.loginRightCard, isMobile && styles.loginRightCardMobile]}>
        <View style={[styles.formCard, isMobile && styles.formCardMobile]}>
          <Text style={styles.eyebrow}>School access</Text>
          <Text style={styles.formTitle}>{mode === 'signin' ? 'Sign in' : 'Create account'}</Text>
          <Text style={styles.helperText}>{mode === 'signin' ? 'Use your email and password to continue.' : 'Create your school account with email and OTP verification.'}</Text>

          <View style={styles.toggleRow}>
            <Pressable style={[styles.toggleButton, mode === 'signin' && styles.toggleButtonActive]} onPress={() => { setMode('signin'); setError(''); }}>
              <Text style={[styles.toggleText, mode === 'signin' && styles.toggleTextActive]}>Sign in</Text>
            </Pressable>
            <Pressable style={[styles.toggleButton, mode === 'signup' && styles.toggleButtonActive]} onPress={() => { setMode('signup'); setError(''); setOtpSent(false); }}>
              <Text style={[styles.toggleText, mode === 'signup' && styles.toggleTextActive]}>Sign up</Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.errorBox}>{error}</Text> : null}

          {mode === 'signin' ? (
            <View style={styles.formStack}>
              <View style={styles.fieldWrap}><Text style={styles.label}>School email</Text><TextInput value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"/></View>
              <View style={styles.fieldWrap}><Text style={styles.label}>Password</Text><TextInput value={password} onChangeText={setPassword} style={styles.input} secureTextEntry autoCapitalize="none" autoCorrect={false}/></View>

              <Pressable style={[styles.primaryButton, submitting && { opacity: 0.7 }]} onPress={handleSignIn} disabled={submitting}>
                <Text style={styles.primaryButtonText}>{submitting ? 'Signing in...' : 'Sign in'}</Text>
              </Pressable>

              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.socialRow}><Pressable style={[styles.socialButton, styles.googleButton]} onPress={handleGoogle}><Text style={[styles.socialButtonText, styles.googleButtonText]}>Continue with Google</Text></Pressable></View>
            </View>
          ) : (
            <View style={styles.formStack}>
              {!otpSent ? (
                <>
                  <View style={styles.fieldWrap}><Text style={styles.label}>School email</Text><TextInput value={email} onChangeText={setEmail} style={styles.input} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"/></View>
                  <Pressable style={styles.primaryButton} onPress={requestOtp}><Text style={styles.primaryButtonText}>Send OTP</Text></Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.notice}>A 4-digit OTP has been sent to {email}.</Text>
                  <View style={styles.fieldWrap}><Text style={styles.label}>Verification code</Text><TextInput value={otp} onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0,4))} style={styles.input} keyboardType="number-pad" maxLength={4} placeholder="4821"/></View>
                  <Pressable style={styles.primaryButton} onPress={verifySignup}><Text style={styles.primaryButtonText}>Verify & create account</Text></Pressable>
                </>
              )}
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

// --- Drawer / App ---
function AppDrawer({ session, onLogout, isMobile }: { session: Session; onLogout: () => void; isMobile: boolean }) {
  const isWeb = Platform.OS === 'web';
  const { colors } = useTheme();
  const styles = useAppStyles();

  if (isWeb && Drawer) {
    return (
      <Drawer.Navigator
        initialRouteName="Dashboard"
        screenOptions={{
          headerShown: false,
          drawerType: isMobile ? 'front' : 'permanent',
          overlayColor: 'rgba(20, 33, 61, 0.34)',
          drawerStyle: isMobile ? { backgroundColor: colors.surface, width: 280 } : { width: 260, backgroundColor: colors.surface, borderRightWidth: 1, borderRightColor: colors.border },
        }}
        drawerContent={(props: any) => <CustomDrawerContent {...props} session={session} onLogout={onLogout} />}
      >
        <Drawer.Screen name="Dashboard">
          {(props: any) => <ScreenWrapper {...props} session={session} onLogout={onLogout}><DashboardScreen session={session} onLogout={onLogout} isMobile={isMobile} /></ScreenWrapper>}
        </Drawer.Screen>
        <Drawer.Screen name="Campuses">
          {(props: any) => <ScreenWrapper {...props} session={session} onLogout={onLogout}><CampusesScreen session={session} /></ScreenWrapper>}
        </Drawer.Screen>
        <Drawer.Screen name="Staff">
          {(props: any) => <ScreenWrapper {...props} session={session} onLogout={onLogout}><StaffDirectory /></ScreenWrapper>}
        </Drawer.Screen>
        <Drawer.Screen name="Teaching Assignments">
          {(props: any) => <ScreenWrapper {...props} session={session} onLogout={onLogout}><TeachingAssignments /></ScreenWrapper>}
        </Drawer.Screen>
        <Drawer.Screen name="Students">
          {(props: any) => <ScreenWrapper {...props} session={session} onLogout={onLogout}><StudentsManager session={session} /></ScreenWrapper>}
        </Drawer.Screen>
        <Drawer.Screen name="Student Form">
          {(props: any) => (
            <ScreenWrapper {...props} session={session} onLogout={onLogout}>
              <StudentFormPage
                key={String(props.route?.params?.editingId ?? 'new')}
                student={props.route?.params?.student ?? null}
                editingId={props.route?.params?.editingId ?? null}
                onClose={() => props.navigation.navigate('Students')}
                onSaved={() => props.navigation.navigate('Students')}
              />
            </ScreenWrapper>
          )}
        </Drawer.Screen>
        <Drawer.Screen name="Fee Structures">
          {(props: any) => <ScreenWrapper {...props} session={session} onLogout={onLogout}><FeeStructureManager /></ScreenWrapper>}
        </Drawer.Screen>
        <Drawer.Screen name="Admissions">
          {(props: any) => <ScreenWrapper {...props} session={session} onLogout={onLogout}><AdmissionsManager /></ScreenWrapper>}
        </Drawer.Screen>
        <Drawer.Screen name="Classes & Structure">
          {(props: any) => <ScreenWrapper {...props} session={session} onLogout={onLogout}><AcademicSetup /></ScreenWrapper>}
        </Drawer.Screen>
        <Drawer.Screen name="Settings">
          {(props: any) => <ScreenWrapper {...props} session={session} onLogout={onLogout}><SettingsScreen session={session} onLogout={onLogout} /></ScreenWrapper>}
        </Drawer.Screen>
      </Drawer.Navigator>
    );
  }

  // Native fallback: simple Stack navigation with a Menu screen (avoids gesture-handler/reanimated native dependencies)
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs">
        {(props: any) => (
          <ScreenWrapper {...props} session={session} onLogout={onLogout}>
            <DashboardScreen session={session} onLogout={onLogout} isMobile={isMobile} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen name="Campuses">
        {(props: any) => (
          <ScreenWrapper {...props} session={session} onLogout={onLogout}>
            <CampusesScreen session={session} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen name="Staff">
        {(props: any) => (
          <ScreenWrapper {...props} session={session} onLogout={onLogout}>
            <StaffDirectory />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen name="Teaching Assignments">
        {(props: any) => (
          <ScreenWrapper {...props} session={session} onLogout={onLogout}>
            <TeachingAssignments />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen name="Students">
        {(props: any) => (
          <ScreenWrapper {...props} session={session} onLogout={onLogout}>
            <StudentsManager session={session} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen name="Student Form">
        {(props: any) => (
          <ScreenWrapper {...props} session={session} onLogout={onLogout}>
            <StudentFormPage
              key={String(props.route?.params?.editingId ?? 'new')}
              student={props.route?.params?.student ?? null}
              editingId={props.route?.params?.editingId ?? null}
              onClose={() => props.navigation.navigate('Students')}
              onSaved={() => props.navigation.navigate('Students')}
            />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen name="Fee Structures">
        {(props: any) => (
          <ScreenWrapper {...props} session={session} onLogout={onLogout}>
            <FeeStructureManager />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen name="Admissions">
        {(props: any) => (
          <ScreenWrapper {...props} session={session} onLogout={onLogout}>
            <AdmissionsManager />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen name="Classes & Structure">
        {(props: any) => (
          <ScreenWrapper {...props} session={session} onLogout={onLogout}>
            <AcademicSetup />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen name="Settings">
        {(props: any) => (
          <ScreenWrapper {...props} session={session} onLogout={onLogout}>
            <SettingsScreen session={session} onLogout={onLogout} />
          </ScreenWrapper>
        )}
      </Stack.Screen>
      <Stack.Screen name="Menu">
        {(props: any) => (
          <ScrollView style={styles.dashboardScroll} contentContainerStyle={styles.dashboardContent}>
            <Text style={styles.pageTitle}>Menu</Text>
            <View style={{ marginTop: 12 }}>
              <Pressable onPress={() => props.navigation.navigate('MainTabs')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Dashboard</Text></Pressable>
              <Pressable onPress={() => props.navigation.navigate('Campuses')} style={[styles.secondaryButton, { marginTop: 8 }]}><Text style={styles.secondaryButtonText}>Campuses</Text></Pressable>
              <Pressable onPress={() => props.navigation.navigate('Staff')} style={[styles.secondaryButton, { marginTop: 8 }]}><Text style={styles.secondaryButtonText}>Staff</Text></Pressable>
              <Pressable onPress={() => props.navigation.navigate('Students')} style={[styles.secondaryButton, { marginTop: 8 }]}><Text style={styles.secondaryButtonText}>Students</Text></Pressable>
              <Pressable onPress={() => props.navigation.navigate('Fee Structures')} style={[styles.secondaryButton, { marginTop: 8 }]}><Text style={styles.secondaryButtonText}>Fee Structures</Text></Pressable>
              <Pressable onPress={() => props.navigation.navigate('Admissions')} style={[styles.secondaryButton, { marginTop: 8 }]}><Text style={styles.secondaryButtonText}>Admissions</Text></Pressable>
              <Pressable onPress={() => props.navigation.navigate('Classes & Structure')} style={[styles.secondaryButton, { marginTop: 8 }]}><Text style={styles.secondaryButtonText}>Classes & Structure</Text></Pressable>
              <Pressable onPress={() => props.navigation.navigate('Settings')} style={[styles.secondaryButton, { marginTop: 8 }]}><Text style={styles.secondaryButtonText}>Settings</Text></Pressable>
            </View>
          </ScrollView>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

const PAGE_META: Record<string, { title: string; crumbs: { label: string; route?: string }[] }> = {
  MainTabs: { title: 'Dashboard', crumbs: [{ label: 'Dashboard' }] },
  Dashboard: { title: 'Dashboard', crumbs: [{ label: 'Dashboard' }] },
  Campuses: { title: 'Campuses', crumbs: [{ label: 'Dashboard', route: 'Dashboard' }, { label: 'Campuses' }] },
  Staff: { title: 'Staff', crumbs: [{ label: 'Dashboard', route: 'Dashboard' }, { label: 'Staff' }] },
  'Teaching Assignments': { title: 'Teaching Assignments', crumbs: [{ label: 'Dashboard', route: 'Dashboard' }, { label: 'Staff', route: 'Staff' }, { label: 'Teaching Assignments' }] },
  Students: { title: 'Students', crumbs: [{ label: 'Dashboard', route: 'Dashboard' }, { label: 'Students' }] },
  'Student Form': { title: 'Student', crumbs: [{ label: 'Dashboard', route: 'Dashboard' }, { label: 'Students', route: 'Students' }, { label: 'Student' }] },
  'Fee Structures': { title: 'Fee Structures', crumbs: [{ label: 'Dashboard', route: 'Dashboard' }, { label: 'Fee Structures' }] },
  Admissions: { title: 'Admissions', crumbs: [{ label: 'Dashboard', route: 'Dashboard' }, { label: 'Admissions' }] },
  'Classes & Structure': { title: 'Classes & Structure', crumbs: [{ label: 'Dashboard', route: 'Dashboard' }, { label: 'Academics' }, { label: 'Classes & Structure' }] },
  Settings: { title: 'Settings', crumbs: [{ label: 'Dashboard', route: 'Dashboard' }, { label: 'Settings' }] },
  Menu: { title: 'Menu', crumbs: [{ label: 'Dashboard', route: 'MainTabs' }, { label: 'Menu' }] },
};

function webLocation() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  return window.location;
}

const drawerLinking = {
  prefixes: [webLocation()?.origin ?? ''],
  getInitialURL: () => webLocation()?.href ?? null,
  config: {
    screens: {
      Dashboard: '',
      Campuses: 'campuses',
      Staff: 'staff',
      'Teaching Assignments': 'staff/assignments',
      Students: 'students',
      'Student Form': 'students/form',
      'Fee Structures': 'fee-structures',
      Admissions: 'admissions',
      'Classes & Structure': 'classes',
      Settings: 'settings',
    },
  },
};

const authLinking = {
  prefixes: [webLocation()?.origin ?? ''],
  config: { screens: { SignIn: '*' } },
};

function ScreenWrapper({ children, navigation, session, onLogout }: any) {
  const route = useRoute();
  const { colors } = useTheme();
  const formLabel = (route.params as { editingId?: number | null } | undefined)?.editingId ? 'Edit student' : 'Add student';
  const meta = route.name === 'Student Form'
    ? { title: formLabel, crumbs: [{ label: 'Dashboard', route: 'Dashboard' }, { label: 'Students', route: 'Students' }, { label: formLabel }] }
    : (PAGE_META[route.name] || { title: route.name, crumbs: [{ label: 'Dashboard', route: 'Dashboard' }, { label: route.name }] });
  const routeNames: string[] = navigation?.getState?.()?.routeNames || [];
  const home = routeNames.includes('Dashboard') ? 'Dashboard' : 'MainTabs';
  const crumbs = meta.crumbs.map((crumb) => (crumb.route === 'Dashboard' ? { ...crumb, route: home } : crumb));
  const toggle = () => {
    if (navigation && typeof navigation.toggleDrawer === 'function') return navigation.toggleDrawer();
    if (navigation && typeof navigation.navigate === 'function') return navigation.navigate('Menu');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {Platform.OS === 'web' ? (
        <Pressable
          nativeID="skip-to-content"
          accessibilityRole="link"
          onPress={() => {
            const node = document.getElementById('main-content');
            if (node instanceof HTMLElement) node.focus();
          }}
        >
          <Text style={{ color: colors.onBrand, fontWeight: '700' }}>Skip to content</Text>
        </Pressable>
      ) : null}
      <Topbar toggle={toggle} session={session} onLogout={onLogout} title={meta.title} crumbs={crumbs} navigation={navigation} />
      <View nativeID="main-content" style={{ flex: 1, backgroundColor: colors.bg }} {...(Platform.OS === 'web' ? { tabIndex: -1 } : {})}>
        <LoadableErrorBoundary>{children}</LoadableErrorBoundary>
      </View>
    </SafeAreaView>
  );
}

function CustomDrawerContent(props: any & { session: Session; onLogout: () => void }) {
  return <Sidebar {...props} />;
}

// --- Additional screens (stubs using existing UI pieces) ---
function CampusesScreen({ session }: { session: Session }) {
  const styles = useAppStyles();
  const { colors } = useTheme();
  return (
    <ScrollView style={styles.dashboardScroll} contentContainerStyle={styles.dashboardContent}>
      {campuses.map((c) => (
        <View key={c.id} style={[styles.panel, { marginTop: 12 }]}>
          <Text style={styles.panelTitle}>{c.name}</Text>
          <Text style={{ color: colors.textSecondary, marginTop: 8 }}>{c.city}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function SettingsScreen({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const styles = useAppStyles();
  const { colors } = useTheme();
  return (
    <ScrollView style={styles.dashboardScroll} contentContainerStyle={styles.dashboardContent}>
      <View style={[styles.panel, { marginTop: 12 }]}>
        <Text style={styles.panelTitle}>Account</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 8 }}>{session.email}</Text>
        <Pressable style={[styles.secondaryButton, { marginTop: 12 }]} onPress={onLogout}><Text style={styles.secondaryButtonText}>Sign out</Text></Pressable>
      </View>
    </ScrollView>
  );
}

// --- Kept original Dashboard UI as a screen component for Drawer ---
function DashboardScreen({ session, onLogout, isMobile }: { session: Session; onLogout: () => void; isMobile: boolean }) {
  const styles = useAppStyles();
  const [selectedCampus, setSelectedCampus] = useState<string>(campuses[0].id);
  const campus = useMemo(() => campuses.find((item) => item.id === selectedCampus) ?? campuses[0], [selectedCampus]);

  const metricsByRole: Record<Role, { label: string; value: string; detail: string }[]> = {
    SUPER_ADMIN: [
      { label: 'Total students', value: '5,149', detail: 'Across all campuses' },
      { label: 'Teachers', value: '286', detail: 'Active staff' },
      { label: 'Revenue', value: '₹44.3L', detail: 'Monthly collections' },
      { label: 'Attendance', value: '95.7%', detail: 'School wide' },
    ],
    ADMIN: [
      { label: 'Admissions', value: '42', detail: 'Pending approvals' },
      { label: 'Fee collection', value: '₹7.8L', detail: 'Current week' },
      { label: 'Classes active', value: '42', detail: 'Across campuses' },
      { label: 'Open issues', value: '06', detail: 'Operational review' },
    ],
    TEACHER: [
      { label: 'Classes today', value: '06', detail: 'On schedule' },
      { label: 'Attendance', value: '96.2%', detail: 'This week' },
      { label: 'Assignments', value: '14', detail: 'Awaiting review' },
      { label: 'Students', value: '42', detail: 'Mentored' },
    ],
    STUDENT: [
      { label: 'Timetable', value: '07', detail: 'Classes this week' },
      { label: 'Attendance', value: '98.4%', detail: 'Present' },
      { label: 'Assignments', value: '03', detail: 'Due soon' },
      { label: 'Fees', value: '₹9,800', detail: 'Next due date' },
    ],
  };

  const quickActions: Record<Role, string[]> = {
    SUPER_ADMIN: ['Campus overview', 'Revenue report', 'Policy review', 'Compliance'],
    ADMIN: ['Admissions', 'Staff approval', 'Fee collection', 'Reports'],
    TEACHER: ['Attendance', 'Assignments', 'Timetable', 'Marks'],
    STUDENT: ['My timetable', 'Assignments', 'Results', 'Fees'],
  };

  return (
    <ScrollView style={styles.dashboardScroll} contentContainerStyle={[styles.dashboardContent, isMobile && styles.dashboardContentMobile]}>
      <View style={[styles.heroBanner, isMobile && styles.heroBannerMobile]}>
        <View style={isMobile && styles.heroBannerCopy}>
          <Text style={styles.eyebrow}>{session.school}</Text>
        </View>
        <Text style={styles.statusBadge}>Healthy</Text>
      </View>

      <AdmissionsDashboardSummary />

      <StaffDashboardSummary />

      <FeeDashboardSummary />

      <View style={styles.statsGrid}>
        {metricsByRole[session.role].map((item) => {
          return (
            <View key={item.label} style={[styles.metricCard, isMobile && styles.metricCardMobile]}>
              <Text style={styles.metricLabel}>{item.label}</Text>
              <Text style={styles.metricValue}>{item.value}</Text>
              <Text style={styles.metricDetail}>{item.detail}</Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.dashboardTwoCol, isMobile && styles.dashboardTwoColMobile]}>
        <View style={[styles.panel, isMobile && styles.panelMobile]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>{campus.name}</Text>
          </View>

          <View style={styles.segmentedWrap}>
            {campuses.map((campusItem) => (
              <Pressable
                key={campusItem.id}
                style={campusItem.id === selectedCampus ? styles.segmentChipActive : styles.segmentChip}
                onPress={() => setSelectedCampus(campusItem.id)}
              >
                <Text style={campusItem.id === selectedCampus ? styles.segmentChipTextActive : styles.segmentChipText}>
                  {campusItem.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.campusMetrics}>
            <View style={[styles.statCell, isMobile && styles.statCellMobile]}>
              <Text style={styles.statLabel}>Students</Text>
              <Text style={styles.statValue}>{campus.students}</Text>
            </View>
            <View style={[styles.statCell, isMobile && styles.statCellMobile]}>
              <Text style={styles.statLabel}>Teachers</Text>
              <Text style={styles.statValue}>{campus.teachers}</Text>
            </View>
            <View style={[styles.statCell, isMobile && styles.statCellMobile]}>
              <Text style={styles.statLabel}>Attendance</Text>
              <Text style={styles.statValue}>{campus.attendance}</Text>
            </View>
            <View style={[styles.statCell, isMobile && styles.statCellMobile]}>
              <Text style={styles.statLabel}>Fees</Text>
              <Text style={styles.statValue}>{campus.fees}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.panel, isMobile && styles.panelMobile]}>
          <Text style={styles.panelTitle}>Quick actions</Text>
          <View style={[styles.actionGrid, isMobile && styles.actionGridMobile]}>
            {quickActions[session.role].map((item) => (
              <Pressable key={item} style={[styles.secondaryAction, isMobile && styles.secondaryActionMobile]}>
                <Text style={styles.secondaryActionText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View style={[styles.dashboardTwoCol, isMobile && styles.dashboardTwoColMobile]}>
        <View style={[styles.panel, isMobile && styles.panelMobile]}>
          <Text style={styles.panelTitle}>Campus network</Text>
          <View style={styles.campusList}>
            {campuses.map((item) => (
              <Pressable
                key={item.id}
                style={item.id === selectedCampus ? styles.campusTileActive : styles.campusTile}
                onPress={() => setSelectedCampus(item.id)}
              >
                <View>
                  <Text style={styles.campusTileTitle}>{item.name}</Text>
                  <Text style={styles.campusTileCity}>{item.city}</Text>
                </View>
                <Text style={styles.campusTileMeta}>{item.students} students</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.panel, isMobile && styles.panelMobile]}>
          <Text style={styles.panelTitle}>Today</Text>
          <View style={styles.listStack}>
            <View style={styles.listRow}>
              <Text style={styles.listLabel}>Principal review</Text>
              <Text style={styles.listValue}>Today · 5:00 PM</Text>
            </View>
            <View style={styles.listRow}>
              <Text style={styles.listLabel}>Parent orientation</Text>
              <Text style={styles.listValue}>Tomorrow · 10:30 AM</Text>
            </View>
            <View style={styles.listRow}>
              <Text style={styles.listLabel}>Fee reminder</Text>
              <Text style={styles.listValue}>Wednesday · 9:15 AM</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
