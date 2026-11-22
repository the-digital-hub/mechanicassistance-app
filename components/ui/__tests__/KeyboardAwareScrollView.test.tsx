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
    const padding = (UNSAFE_getByType: (t: unknown) => { props: { contentContainerStyle: unknown } }) => {
        const { ScrollView } = require('react-native');
        const style = ([] as unknown[]).concat(UNSAFE_getByType(ScrollView).props.contentContainerStyle).filter(Boolean);
        return Object.assign({}, ...style).paddingBottom;
    };

    it('makes room only for the part of itself the keyboard covers, and gives it back when it closes', () => {
        jest.useFakeTimers();
        const { ScrollView, Dimensions } = require('react-native');
        // The scroll view reaches the bottom of the screen: the keyboard covers 300 of it.
        const screen = Dimensions.get('window').height;
        ScrollView.prototype.measureInWindow = (cb: (x: number, y: number, w: number, h: number) => void) => cb(0, 100, 300, screen - 100);
        const { UNSAFE_getByType } = render(
            <KeyboardAwareScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                <Text>content</Text>
            </KeyboardAwareScrollView>,
        );
        expect(padding(UNSAFE_getByType)).toBe(24);

        act(() => { handlers[showEvent]({ endCoordinates: { height: 300 } }); });
        act(() => { jest.advanceTimersByTime(500); });
        expect(padding(UNSAFE_getByType)).toBe(324);

        act(() => { handlers[hideEvent]({}); });
        expect(padding(UNSAFE_getByType)).toBe(24);
        delete ScrollView.prototype.measureInWindow;
        jest.useRealTimers();
    });

    it('adds nothing when the screen already makes room for the keyboard', () => {
        jest.useFakeTimers();
        const { ScrollView } = require('react-native');
        // It ends well above the keyboard (a KeyboardAvoidingView around it already shrank it).
        ScrollView.prototype.measureInWindow = (cb: (x: number, y: number, w: number, h: number) => void) => cb(0, 100, 300, 200);
        const { UNSAFE_getByType } = render(
            <KeyboardAwareScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                <Text>content</Text>
            </KeyboardAwareScrollView>,
        );
        act(() => { handlers[showEvent]({ endCoordinates: { height: 300 } }); });
        act(() => { jest.advanceTimersByTime(500); });
        expect(padding(UNSAFE_getByType)).toBe(24);
        delete ScrollView.prototype.measureInWindow;
        jest.useRealTimers();
    });

    it('keeps buttons tappable with the keyboard open and lets a drag dismiss it', () => {
        const { UNSAFE_getByType } = render(<KeyboardAwareScrollView><Text>content</Text></KeyboardAwareScrollView>);
        const { ScrollView } = require('react-native');
        const props = UNSAFE_getByType(ScrollView).props;
        expect(props.keyboardShouldPersistTaps).toBe('handled');
        expect(props.keyboardDismissMode).toBe('interactive');
    });
});
