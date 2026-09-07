import { Provider as AntProvider } from '@ant-design/react-native';
import type { ReactNode } from 'react';
import { StatusBar } from 'react-native';

import { getAntTheme } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { mode, background } = useTheme();

  return (
    <AntProvider theme={getAntTheme(mode)}>
      <StatusBar
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={background}
      />
      {children}
    </AntProvider>
  );
}
