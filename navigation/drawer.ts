import { ScrollView } from 'react-native';

/** Native uses Stack, not Drawer — keep Reanimated/Worklets out of the Android/iOS bundle. */
export function createDrawerNavigator(): any {
  return null;
}

export const DrawerContentScrollView = ScrollView;
