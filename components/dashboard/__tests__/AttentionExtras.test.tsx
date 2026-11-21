import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { AttentionQuickButton, AttentionTimer, formatTimeLeft } from '../AttentionExtras';

// The i18n mock echoes keys with their params, so the format chosen shows in the key.
const t = (key: string, opts?: Record<string, unknown>) => `${key.split('.').pop()}:${Object.values(opts ?? {}).join(',')}`;

describe('formatTimeLeft', () => {
    it('picks days, hours, minutes or a second-by-second clock by how much is left', () => {
        expect(formatTimeLeft((2 * 1440 + 3 * 60) * 60_000, t)).toBe('days:2,3');
        expect(formatTimeLeft((5 * 60 + 12) * 60_000, t)).toBe('hours:5,12');
        expect(formatTimeLeft(12 * 60_000, t)).toBe('minutes:12');
        expect(formatTimeLeft(3 * 60_000 + 5_000, t)).toBe('seconds:3,05');
    });
});

describe('AttentionTimer', () => {
    it('shows the time left, and nothing once it ran out', () => {
        const soon = new Date(Date.now() + 2 * 3600_000).toISOString();
        const view = render(<AttentionTimer spec={{ deadline: soon, label: (time) => `left ${time}` }} />);
        expect(view.getByTestId('attention-timer')).toBeTruthy();
        const past = new Date(Date.now() - 1000).toISOString();
        const gone = render(<AttentionTimer spec={{ deadline: past, label: (time) => time }} />);
        expect(gone.queryByTestId('attention-timer')).toBeNull();
    });
});

describe('AttentionQuickButton', () => {
    it('does its action when pressed, but not while busy', () => {
        const onPress = jest.fn();
        const idle = render(<AttentionQuickButton quick={{ label: 'Confirm now', onPress }} />);
        fireEvent.press(idle.getByTestId('attention-quick'));
        expect(onPress).toHaveBeenCalledTimes(1);
        const busy = render(<AttentionQuickButton quick={{ label: 'Confirm now', onPress, busy: true }} />);
        fireEvent.press(busy.getByTestId('attention-quick'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });
});
