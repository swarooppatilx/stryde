import { useState } from 'react';
import type { ITrayNavigation } from './types';

function useTrayNavigation(
  defaultView: string,
  onViewChange?: (view: string) => void
): ITrayNavigation {
  const [state, setState] = useState<{ stack: string[]; direction: number }>({
    stack: [defaultView],
    direction: 1,
  });

  const view = state.stack.at(-1) ?? defaultView;

  const setView = (next: string) => {
    setState((current) => {
      if (current.stack[current.stack.length - 1] === next) return current;
      return { stack: [...current.stack, next], direction: 1 };
    });
    onViewChange?.(next);
  };

  const goBack = () => {
    setState((current) => {
      if (current.stack.length < 2) return current;
      const stack = current.stack.slice(0, -1);
      const previous = stack.at(-1);
      if (previous) onViewChange?.(previous);
      return { stack, direction: -1 };
    });
  };

  const reset = (next: string) => {
    setState({ stack: [next], direction: 1 });
  };

  return {
    view,
    direction: state.direction,
    canGoBack: state.stack.length > 1,
    setView,
    goBack,
    reset,
  };
}

export type { ITrayNavigation };
export { useTrayNavigation };
