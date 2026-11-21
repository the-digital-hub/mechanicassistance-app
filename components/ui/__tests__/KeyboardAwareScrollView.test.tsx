import { act, render } from '@testing-library/react-native';
import React from 'react';
import { Keyboard, Platform, Text } from 'react-native';

import { KeyboardAwareScrollView } from '../KeyboardAwareScrollView';

const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

// The keyboard is mocked in jest: capture the listeners the component registers so the test can fire the events.
const handlers: Record<string, (e: unknown) => void> = {};
beforeEach(() => {
    for (const k of Object.keys(handlers)) delete handlers[k];
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, fn: (e: unknown) => void) => {
        handlers[name] = fn;
        return { remove: () => { delete handlers[name]; } };
    }) as never);
});

describe('KeyboardAwareScrollView', () => {
    it('makes room for the keyboard while it is open, and gives it back when it closes', () => {
        const { UNSAFE_getByType } = render(
            <KeyboardAwareScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                <Text>content</Text>
            </KeyboardAwareScrollView>,
        );
        const { ScrollView } = require('react-native');
        const padding = () => {
            const style = ([] as unknown[]).concat(UNSAFE_getByType(ScrollView).props.contentContainerStyle).filter(Boolean);
            return Object.assign({}, ...style).paddingBottom;
        };
        expect(padding()).toBe(24);

        act(() => { handlers[showEvent]({ endCoordinates: { height: 300 } }); });
        expect(padding()).toBe(324);

        act(() => { handlers[hideEvent]({}); });
        expect(padding()).toBe(24);
    });

    it('keeps buttons tappable with the keyboard open and lets a drag dismiss it', () => {
        const { UNSAFE_getByType } = render(<KeyboardAwareScrollView><Text>content</Text></KeyboardAwareScrollView>);
        const { ScrollView } = require('react-native');
        const props = UNSAFE_getByType(ScrollView).props;
        expect(props.keyboardShouldPersistTaps).toBe('handled');
        expect(props.keyboardDismissMode).toBe('interactive');
    });
});
