/**
 * Props for a vertical ScrollView that holds text fields. On iOS the scroll adds the keyboard's height to its bottom inset by itself
 * and scrolls the field being typed in into view, so the keyboard never sits over what is being written; on Android (edge-to-edge) the window does not resize
 * for the keyboard, so every KeyboardAvoidingView uses behavior="padding" on both platforms. Taps on buttons work with the keyboard open, and dragging the list down dismisses it.
 * Spread it first, so a screen can still override any of them.
 */
export const KEYBOARD_SCROLL_PROPS = {
    automaticallyAdjustKeyboardInsets: true,
    keyboardShouldPersistTaps: 'handled',
    keyboardDismissMode: 'interactive',
} as const;
