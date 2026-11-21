import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** True while the on-screen keyboard is up: for a fixed bottom bar that would otherwise sit blurred behind it. */
export function useKeyboardOpen(): boolean {
    const [open, setOpen] = useState(false);
    useEffect(() => {
        const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setOpen(true));
        const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setOpen(false));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);
    return open;
}
