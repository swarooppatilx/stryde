import { Provider as AntProvider } from '@ant-design/react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { type ReactNode, useEffect } from 'react';
import { Colors, getAntTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { logger } from '@/utils/logger';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { mode, isDark } = useTheme();

  useEffect(() => {
    // The window shows through during a screen transition, so it has to be the page colour.
    SystemUI.setBackgroundColorAsync(Colors[mode].background).catch((error) =>
      logger.warn('[Theme] Setting the window background failed', error)
    );
  }, [mode]);

  return (
    <AntProvider theme={getAntTheme(mode)}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {children}
    </AntProvider>
  );
}
