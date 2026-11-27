import { useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { hasReachedEnd } from '@/lib/legal/policies';

/**
 * Whether a ScrollView has been scrolled to its end (or its content fits and there is nothing to scroll): the legal texts can only be
 * accepted after being read to the bottom. Spread `scrollProps` on the ScrollView; `reset()` closes it again when the text changes.
 */
export function useScrolledToEnd() {
    const [reachedEnd, setReachedEnd] = useState(false);
    const metrics = useRef({ layout: 0, content: 0, offset: 0 });
    const check = () => {
        const { layout, content, offset } = metrics.current;
        if (hasReachedEnd(layout, content, offset)) setReachedEnd(true);
    };
    const scrollProps = {
        scrollEventThrottle: 100,
        onLayout: (e: LayoutChangeEvent) => {
            metrics.current.layout = e.nativeEvent.layout.height;
            check();
        },
        onContentSizeChange: (_width: number, height: number) => {
            metrics.current.content = height;
            check();
        },
        onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
            metrics.current.offset = e.nativeEvent.contentOffset.y;
            check();
        },
    };
    return { reachedEnd, reset: () => setReachedEnd(false), scrollProps };
}
