import React from 'react';
import { Dimensions, Keyboard, Platform, ScrollView, TextInput, type ScrollViewProps } from 'react-native';

/** Where a view is on the screen (top and height). `measureInWindow` exists on the native view; the ScrollView types just do not list it. */
function inWindow(node: ScrollView | null, done: (top: number, height: number) => void) {
    (node as unknown as { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null)?.measureInWindow?.((_x, y, _w, h) => done(y, h));
}

/**
 * A ScrollView for screens with text fields. When the keyboard opens it makes room for it and scrolls the field being typed in up to the
 * top of what is left visible, so there is space to see (and write) several lines, not just a sliver of the first. It follows the field
 * as the person moves from one to the next. Buttons stay tappable with the keyboard open and dragging down dismisses it.
 *
 * It does not use iOS's `automaticallyAdjustKeyboardInsets`: that one only guarantees the field is not hidden, which left a multiline
 * field showing its first line and nothing more.
 */
export const KeyboardAwareScrollView = React.forwardRef<ScrollView, ScrollViewProps & {
    /** Room kept between the top of the visible area and the field. */
    topGap?: number;
    /** Scroll the focused field up when the keyboard opens (default). Off for a short screen whose field is already in view: nothing should move. */
    focusScroll?: boolean;
}>(function KeyboardAwareScrollView({ topGap = 24, focusScroll = true, contentContainerStyle, children, onLayout, ...rest }, forwardedRef) {
    const ref = React.useRef<ScrollView>(null);
    const [keyboard, setKeyboard] = React.useState(0);
    // How much of this scroll view the keyboard really covers. A screen that already shrinks for the keyboard (a KeyboardAvoidingView
    // around it) is not covered at all: adding room there made the content jump up for nothing.
    const [covered, setCovered] = React.useState(0);
    const handled = React.useRef<unknown>(null);

    const setRefs = (node: ScrollView | null) => {
        (ref as React.MutableRefObject<ScrollView | null>).current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<ScrollView | null>).current = node;
    };

    React.useEffect(() => {
        const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKeyboard(e.endCoordinates.height));
        const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
            setKeyboard(0);
            handled.current = null;
        });
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);

    React.useEffect(() => {
        if (keyboard <= 0) { setCovered(0); return; }
        const measure = () => inWindow(ref.current, (y, h) => {
            const top = Dimensions.get('window').height - keyboard;
            setCovered(Math.max(0, Math.round(y + h - top)));
        });
        // Once the screen has settled around the keyboard (it may be animating its own room), and again a little later.
        const a = setTimeout(measure, 80);
        const b = setTimeout(measure, 400);
        return () => { clearTimeout(a); clearTimeout(b); };
    }, [keyboard]);

    // While the keyboard is up: bring the focused field to the top, once per field (checked a few times a second, so moving to the
    // next field is followed too).
    React.useEffect(() => {
        if (keyboard <= 0 || !focusScroll) return;
        const bring = () => {
            const field = TextInput.State.currentlyFocusedInput?.();
            // The inner content view: where the field's position is measured from (not in the TypeScript types yet).
            const inner = (ref.current as unknown as { getInnerViewRef?: () => unknown } | null)?.getInnerViewRef?.();
            if (!field || !inner || handled.current === field) return;
            handled.current = field;
            // Only when it would be hidden: a field already in view stays where it is.
            field.measureInWindow((_fx: number, fy: number, _fw: number, fh: number) => {
                inWindow(ref.current, (sy, sh) => {
                    const visibleBottom = Math.min(sy + sh, Dimensions.get('window').height - keyboard);
                    // `fh` can be tall (a growing box): what has to be seen is its top and a bit of what is under it.
                    const hiddenBelow = fy + Math.min(fh, 140) + 16 > visibleBottom;
                    const hiddenAbove = fy < sy;
                    if (!hiddenBelow && !hiddenAbove) return;
                    field.measureLayout(
                        inner as never,
                        (_lx, y) => ref.current?.scrollTo({ y: Math.max(0, y - topGap), animated: true }),
                        () => { handled.current = null; },
                    );
                });
            });
        };
        const first = setTimeout(bring, 120); // after the room for the keyboard has been laid out
        const id = setInterval(bring, 300);
        return () => {
            clearTimeout(first);
            clearInterval(id);
        };
    }, [keyboard, topGap, focusScroll]);

    return (
        <ScrollView
            ref={setRefs}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            {...rest}
            onLayout={onLayout}
            // The room for the keyboard is what lets the content scroll high enough, even when it is short.
            contentContainerStyle={[contentContainerStyle, keyboard > 0 && focusScroll && covered > 0 ? { paddingBottom: ((contentContainerStyle as { paddingBottom?: number } | undefined)?.paddingBottom ?? 0) + covered } : null]}
        >
            {children}
        </ScrollView>
    );
});
