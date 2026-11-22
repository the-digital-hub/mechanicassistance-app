import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/** The height the on-screen keyboard takes (0 while it is down): for a sheet that has to fit in what is left above it. */
export function useKeyboardHeight(): number {
    const [height, setHeight] = useState(0);
    useEffect(() => {
        const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
        const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setHeight(0));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);
    return height;
}
