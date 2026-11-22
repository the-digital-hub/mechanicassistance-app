import React from 'react';
import { Keyboard, Platform, ScrollView, type ScrollViewProps } from 'react-native';

/**
 * The scrollable body of a bottom sheet with a text field. The sheet fits above the keyboard (its owner caps the height), so the body
 * scrolls instead of growing off the screen; when the keyboard opens it goes to the end, where the field and the send button are.
 */
export function KeyboardSheetScroll({ children, style, contentContainerStyle, resetKey, ...rest }: ScrollViewProps & {
    /** When this changes (the sheet opening again) the body goes back to the top. */
    resetKey?: unknown;
}) {
    const ref = React.useRef<ScrollView>(null);
    React.useEffect(() => {
        ref.current?.scrollTo({ y: 0, animated: false });
    }, [resetKey]);
    React.useEffect(() => {
        const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
            setTimeout(() => ref.current?.scrollToEnd({ animated: true }), 220);
        });
        return () => show.remove();
    }, []);
    return (
        <ScrollView
            ref={ref}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            style={[{ flexGrow: 0 }, style]}
            contentContainerStyle={contentContainerStyle}
            {...rest}
        >
            {children}
        </ScrollView>
    );
}
