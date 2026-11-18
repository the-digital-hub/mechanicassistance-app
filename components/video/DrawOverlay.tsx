import React from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { Point, Stroke } from '@/lib/video/callMessages';

const INK = '#FFD60A';
/** Points go out in small batches so a long stroke is not a flood of messages. */
const SEND_EVERY_MS = 60;

const toPath = (pts: Point[], w: number, h: number) =>
    pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${(x * w).toFixed(1)} ${(y * h).toFixed(1)}`).join(' ');

const newId = () => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * The technician's markings over the picture. Everyone sees the strokes; when `editable`
 * (the technician looking at the owner's camera) a finger draws, and each stroke is
 * reported through `onStroke` as it grows (`end` on lift) so the other phone can follow.
 */
export function DrawOverlay({ strokes, editable, onStroke, onLocalStroke }: {
    strokes: Stroke[];
    editable: boolean;
    /** A batch of new points of stroke `id`. */
    onStroke: (id: string, pts: Point[], end: boolean) => void;
    /** The same batch, for this phone's own drawing. */
    onLocalStroke: (id: string, pts: Point[]) => void;
}) {
    const [size, setSize] = React.useState({ w: 1, h: 1 });
    const sizeRef = React.useRef(size);
    sizeRef.current = size;
    const current = React.useRef<{ id: string; pending: Point[]; last: number } | null>(null);
    // Latest handlers for the responder, which is created once.
    const handlers = React.useRef({ onStroke, onLocalStroke });
    handlers.current = { onStroke, onLocalStroke };

    const point = (x: number, y: number): Point => {
        const { w, h } = sizeRef.current;
        return [Math.min(1, Math.max(0, x / w)), Math.min(1, Math.max(0, y / h))];
    };
    const flush = (end: boolean) => {
        const c = current.current;
        if (!c) return;
        if (c.pending.length || end) {
            handlers.current.onStroke(c.id, c.pending, end);
            handlers.current.onLocalStroke(c.id, c.pending);
            c.pending = [];
            c.last = Date.now();
        }
        if (end) current.current = null;
    };

    const responder = React.useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderGrant: (e) => {
                    current.current = { id: newId(), pending: [point(e.nativeEvent.locationX, e.nativeEvent.locationY)], last: 0 };
                    flush(false);
                },
                onPanResponderMove: (e) => {
                    const c = current.current;
                    if (!c) return;
                    c.pending.push(point(e.nativeEvent.locationX, e.nativeEvent.locationY));
                    if (Date.now() - c.last >= SEND_EVERY_MS) flush(false);
                },
                onPanResponderRelease: () => flush(true),
                onPanResponderTerminate: () => flush(true),
            }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    return (
        <View
            style={StyleSheet.absoluteFill}
            pointerEvents={editable ? 'auto' : 'none'}
            onLayout={(e) => setSize({ w: e.nativeEvent.layout.width || 1, h: e.nativeEvent.layout.height || 1 })}
            {...(editable ? responder.panHandlers : {})}
            testID="draw-overlay"
        >
            <Svg width={size.w} height={size.h} pointerEvents="none">
                {strokes.map((s) => (
                    <Path
                        key={s.id}
                        d={toPath(s.pts.length === 1 ? [s.pts[0], s.pts[0]] : s.pts, size.w, size.h)}
                        stroke={INK}
                        strokeWidth={4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                    />
                ))}
            </Svg>
        </View>
    );
}
