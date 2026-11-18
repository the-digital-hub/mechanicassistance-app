import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, PanResponder, StyleSheet, TouchableOpacity, View } from 'react-native';

/** Where the small picture rests. The top-left is kept free for the call's own buttons. */
export type PipCorner = 'tr' | 'br' | 'bl';
export const PIP_SIZES = [0.8, 1, 1.4] as const;

const BASE_W = 104;
const BASE_H = 144;
const MARGIN = 14;
const TAP_SLOP = 6;

export function pipSize(sizeIndex: number, landscape = false): { w: number; h: number } {
    const scale = PIP_SIZES[sizeIndex] ?? 1;
    // Sideways, the small picture lies down too.
    return landscape
        ? { w: Math.round(BASE_H * scale), h: Math.round(BASE_W * scale) }
        : { w: Math.round(BASE_W * scale), h: Math.round(BASE_H * scale) };
}

function anchor(corner: PipCorner, stage: { w: number; h: number }, size: { w: number; h: number }) {
    return {
        x: corner === 'bl' ? MARGIN : stage.w - MARGIN - size.w,
        y: corner === 'tr' ? MARGIN : stage.h - MARGIN - size.h,
    };
}

/**
 * The small picture of the call: drag it to another corner (it snaps), tap it to swap it with the
 * big picture, and use the little arrows to make it bigger or smaller.
 */
export function DraggablePip({ stage, corner, sizeIndex, landscape = false, onCornerChange, onResize, onTap, resizeLabel, swapLabel, children }: {
    stage: { w: number; h: number };
    corner: PipCorner;
    sizeIndex: number;
    landscape?: boolean;
    onCornerChange: (corner: PipCorner) => void;
    onResize: () => void;
    onTap: () => void;
    resizeLabel: string;
    swapLabel: string;
    children: React.ReactNode;
}) {
    const size = pipSize(sizeIndex, landscape);
    const translate = React.useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    // The responder is created once: it reads the latest values from here.
    const live = React.useRef({ stage, size, corner, onCornerChange, onTap });
    live.current = { stage, size, corner, onCornerChange, onTap };

    const responder = React.useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > TAP_SLOP || Math.abs(g.dy) > TAP_SLOP,
                onPanResponderMove: (_e, g) => translate.setValue({ x: g.dx, y: g.dy }),
                onPanResponderRelease: (_e, g) => {
                    const { stage: st, size: sz, corner: from, onCornerChange: change, onTap: tap } = live.current;
                    if (Math.abs(g.dx) < TAP_SLOP && Math.abs(g.dy) < TAP_SLOP) {
                        translate.setValue({ x: 0, y: 0 });
                        tap();
                        return;
                    }
                    const start = anchor(from, st, sz);
                    const dropX = start.x + g.dx;
                    const dropY = start.y + g.dy;
                    // Nearest resting corner to where the picture was dropped.
                    const corners: PipCorner[] = ['tr', 'br', 'bl'];
                    const target = corners.reduce((best, c) => {
                        const a = anchor(c, st, sz);
                        const b = anchor(best, st, sz);
                        return Math.hypot(a.x - dropX, a.y - dropY) < Math.hypot(b.x - dropX, b.y - dropY) ? c : best;
                    }, from);
                    const end = anchor(target, st, sz);
                    // Move the anchor now and let the picture glide from where it was dropped.
                    translate.setValue({ x: dropX - end.x, y: dropY - end.y });
                    change(target);
                    Animated.spring(translate, { toValue: { x: 0, y: 0 }, useNativeDriver: true, bounciness: 6 }).start();
                },
                onPanResponderTerminate: () => Animated.spring(translate, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start(),
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const position =
        corner === 'tr' ? { top: MARGIN, right: MARGIN } : corner === 'br' ? { bottom: MARGIN, right: MARGIN } : { bottom: MARGIN, left: MARGIN };

    return (
        <Animated.View
            style={[styles.pip, position, { width: size.w, height: size.h, transform: translate.getTranslateTransform() }]}
            {...responder.panHandlers}
            accessibilityRole="button"
            accessibilityLabel={swapLabel}
            testID="call-swap"
        >
            <View style={styles.inner} pointerEvents="none">{children}</View>
            <TouchableOpacity
                onPress={onResize}
                hitSlop={8}
                style={styles.resize}
                accessibilityRole="button"
                accessibilityLabel={resizeLabel}
                testID="call-pip-resize"
            >
                <Ionicons name={sizeIndex >= PIP_SIZES.length - 1 ? 'contract-outline' : 'expand-outline'} size={14} color="#FFFFFF" />
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    // Outer view carries the shadow, inner one clips the video to the radius.
    pip: {
        position: 'absolute', borderRadius: 16, zIndex: 3,
        shadowColor: '#000000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 10 },
        elevation: 10,
    },
    inner: {
        flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1A2438',
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    },
    resize: {
        position: 'absolute', left: 6, top: 6, width: 26, height: 26, borderRadius: 13,
        backgroundColor: 'rgba(15,23,41,0.7)', alignItems: 'center', justifyContent: 'center',
    },
});
