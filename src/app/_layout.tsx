import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { VaultProvider } from '@/context/vault-context';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <VaultProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppTabs />
      </ThemeProvider>
    </VaultProvider>
  );
}
