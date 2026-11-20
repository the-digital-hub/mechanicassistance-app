import React from 'react';
import { Text, View } from 'react-native';

/** The last line said, as a caption over the picture; it fades away after a few seconds of silence. */
export function CaptionsBar({ caption, translated }: { caption: { id: string; text: string; mine: boolean } | null; /** The line in the reader's language, when translation is on and it has arrived. */ translated?: string | null }) {
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
                {translated ? (
                    <>
                        <Text className="font-outfit-medium" style={{ fontSize: 16, lineHeight: 22, color: '#FFFFFF', textAlign: 'center' }} testID="call-caption-translated">{translated}</Text>
                        <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 19, color: '#AAB6D3', textAlign: 'center', marginTop: 2 }}>{caption.text}</Text>
                    </>
                ) : (
                    <Text className="font-outfit-medium" style={{ fontSize: 16, lineHeight: 22, color: caption.mine ? '#BFD2FF' : '#FFFFFF', textAlign: 'center' }}>{caption.text}</Text>
                )}
            </View>
        </View>
    );
}
