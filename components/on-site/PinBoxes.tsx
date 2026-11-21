import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { OS } from '@/components/on-site/ui';
import { FONT } from '@/lib/ui/fonts';

/**
 * A short numeric code as separate boxes: the one waiting for a digit is outlined in blue, the filled ones are tinted
 * with the digit in blue. One hidden input holds the value, so paste, backspace and the number pad behave as usual.
 */
export function PinBoxes({ value, onChange, length = 4, autoFocus = true, testID }: {
    value: string;
    onChange: (v: string) => void;
    length?: number;
    autoFocus?: boolean;
    testID?: string;
}) {
    const input = React.useRef<TextInput>(null);
    const [focused, setFocused] = React.useState(false);
    const active = Math.min(value.length, length - 1);

    return (
        <TouchableOpacity activeOpacity={1} onPress={() => input.current?.focus()} accessibilityLabel={testID} style={{ alignSelf: 'stretch' }}>
            <View className="flex-row justify-center" style={{ gap: 12 }}>
                {Array.from({ length }, (_, i) => {
                    const digit = value[i];
                    const isActive = focused && i === active && value.length < length;
                    return (
                        <View
                            key={i}
                            className="items-center justify-center"
                            style={{
                                width: 62,
                                height: 74,
                                borderRadius: 16,
                                borderWidth: 2,
                                borderColor: isActive ? OS.blue : digit ? '#BFD2FA' : '#CBD5EA',
                                backgroundColor: digit ? OS.blueSoft : '#FFFFFF',
                            }}
                        >
                            <Text style={{ fontFamily: FONT.bold, fontSize: 34, lineHeight: 42, color: OS.blue }}>
                                {digit ?? (isActive ? '|' : '')}
                            </Text>
                        </View>
                    );
                })}
            </View>
            <TextInput
                ref={input}
                value={value}
                onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, length))}
                keyboardType="number-pad"
                maxLength={length}
                autoFocus={autoFocus}
                caretHidden
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%' }}
                testID={testID}
            />
        </TouchableOpacity>
    );
}
