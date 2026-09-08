import { Provider as AntProvider } from '@ant-design/react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { type ReactNode, useEffect } from 'react';

import { getAntTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { mode, isDark } = useTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(isDark ? '#000000' : '#FFFFFF');
  }, [isDark]);

  return (
    <AntProvider theme={getAntTheme(mode)}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {children}
    </AntProvider>
  );
}
