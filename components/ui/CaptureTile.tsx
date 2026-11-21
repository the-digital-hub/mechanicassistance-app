import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';

/**
 * A square capture tile: the whole tile is the button. Empty it shows an icon, a title and what tapping does; with a photo it
 * shows the picture (a dark tile with a play icon for a video), a round X to remove it and, when `onPressFilled` is given,
 * a pencil to write a note about it.
 */
export function CaptureTile({ title, hint, icon, uri, isVideo, onPress, onRemove, onPressFilled, hasNote, selected, height = 150, testID }: {
    title: string;
    hint: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    uri?: string | null;
    isVideo?: boolean;
    onPress?: () => void;
    onRemove?: () => void;
    /** Filled tile: tapping it does this (e.g. open its note). */
    onPressFilled?: () => void;
    hasNote?: boolean;
    selected?: boolean;
    height?: number;
    testID?: string;
}) {
    const filled = !!uri;
    return (
        <View style={{ flex: 1, minWidth: 140 }}>
            <TouchableOpacity
                onPress={filled ? onPressFilled : onPress}
                activeOpacity={filled && !onPressFilled ? 1 : 0.8}
                accessibilityRole="button"
                accessibilityLabel={title}
                className="items-center justify-center overflow-hidden"
                style={{
                    height,
                    borderRadius: 18,
                    backgroundColor: filled ? '#0B1530' : '#EEF4FF',
                    borderWidth: selected ? 2.5 : filled ? 0 : 1.5,
                    borderColor: selected ? '#1E56E3' : '#CFDDFB',
                }}
                testID={testID}
            >
                {!filled ? (
                    <View className="items-center px-3" style={{ gap: 8 }}>
                        <View className="items-center justify-center" style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF' }}>
                            <Ionicons name={icon} size={26} color="#1E56E3" />
                        </View>
                        <Text className="font-outfit-bold text-center" style={{ fontSize: 16, lineHeight: 21, color: '#0B1530' }} numberOfLines={2}>{title}</Text>
                        <Text className="font-outfit-medium text-center" style={{ fontSize: 13, lineHeight: 17, color: '#1E56E3' }}>{hint}</Text>
                    </View>
                ) : isVideo ? (
                    <View className="items-center" style={{ gap: 6 }}>
                        <Ionicons name="play-circle-outline" size={46} color="rgba(255,255,255,0.88)" />
                        <Text className="font-outfit-medium" style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)' }}>{title}</Text>
                    </View>
                ) : (
                    <Image source={{ uri: uri ?? undefined }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                )}
                {filled && onPressFilled ? (
                    <View className="absolute flex-row items-center" style={{ left: 8, bottom: 8, gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: 'rgba(11,21,48,0.72)' }}>
                        <Ionicons name={hasNote ? 'document-text' : 'create-outline'} size={14} color="#FFFFFF" />
                    </View>
                ) : null}
            </TouchableOpacity>
            {filled && onRemove ? (
                <TouchableOpacity
                    onPress={onRemove}
                    hitSlop={8}
                    accessibilityRole="button"
                    className="absolute items-center justify-center"
                    style={{ right: 8, top: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(11,21,48,0.72)' }}
                >
                    <Ionicons name="close" size={18} color="#FFFFFF" />
                </TouchableOpacity>
            ) : null}
        </View>
    );
}
