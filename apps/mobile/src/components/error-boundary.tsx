import { Component, type ReactNode } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BorderRadius, Brand, Spacing } from '@/constants/theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Root-level safety net. Without this, any unhandled render error anywhere
 * in the tree takes down the entire app with no recovery — a real risk
 * during a live demo. Narrower boundaries (e.g. MapErrorBoundary) still make
 * sense where a broken widget shouldn't kill an otherwise-fine screen; this
 * one is the last resort.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }) {
    console.error(
      '[AppErrorBoundary] Unhandled error:',
      error instanceof Error ? error.stack : error,
      info.componentStack
    );
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
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
        <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={onRetry}>
          <ThemedText type="button" style={styles.buttonLabel}>
            {buttonLabel}
          </ThemedText>
        </TouchableOpacity>
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
