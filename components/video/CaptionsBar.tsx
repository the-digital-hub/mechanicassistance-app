import React from 'react';
import { Text, View } from 'react-native';

/** The last line said, as a caption over the picture; it fades away after a few seconds of silence. */
export function CaptionsBar({ caption }: { caption: { id: string; text: string; mine: boolean } | null }) {
    const [visibleId, setVisibleId] = React.useState<string | null>(null);
    React.useEffect(() => {
        if (!caption) return;
        setVisibleId(caption.id);
        const timer = setTimeout(() => setVisibleId(null), 5000);
        return () => clearTimeout(timer);
    }, [caption]);
    if (!caption || visibleId !== caption.id) return null;
    return (
        <View pointerEvents="none" style={{ position: 'absolute', left: 14, right: 14, bottom: 58, zIndex: 4, alignItems: 'center' }} testID="call-caption">
            <View style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: 'rgba(11,21,48,0.82)' }}>
                <Text className="font-outfit-medium" style={{ fontSize: 16, lineHeight: 22, color: caption.mine ? '#BFD2FF' : '#FFFFFF', textAlign: 'center' }}>{caption.text}</Text>
            </View>
        </View>
    );
}
