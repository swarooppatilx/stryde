import { Component, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tappable } from '@/components/tappable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';
import { logger } from '@/utils/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Root-level boundary so an unhandled render error does not take down the whole app; narrower boundaries (e.g. MapErrorBoundary) handle isolated widgets. */
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown, info: { componentStack?: string }) {
    logger.error(
      '[AppErrorBoundary] Unhandled error:',
      error instanceof Error ? error.stack : error,
      info.componentStack
    );
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  override render() {
    if (this.state.hasError) {
      return <AppErrorFallback onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

interface AppErrorFallbackProps {
  title?: string;
  subtitle?: string;
  buttonLabel?: string;
  onRetry: () => void;
}

export function AppErrorFallback({
  title = 'Something went wrong',
  subtitle = 'The app hit an unexpected error. Try again — if it keeps happening, restart the app.',
  buttonLabel = 'Try Again',
  onRetry,
}: AppErrorFallbackProps) {
  return (
    <ThemedView type="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="headline" style={styles.title}>
          {title}
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
          {subtitle}
        </ThemedText>
        <Tappable accessibilityRole="button" style={styles.button} onPress={onRetry}>
          <ThemedText type="button" style={styles.buttonLabel}>
            {buttonLabel}
          </ThemedText>
        </Tappable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.five,
  },
  button: {
    backgroundColor: Brand.primary,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: BorderRadius.md,
  },
  buttonLabel: {
    color: Brand.white,
  },
});
