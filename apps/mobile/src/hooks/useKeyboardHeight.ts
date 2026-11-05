import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** The on-screen keyboard's height right now, 0 while it is closed. */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(show, (event) => setHeight(event.endCoordinates.height));
    const hidden = Keyboard.addListener(hide, () => setHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return height;
}
