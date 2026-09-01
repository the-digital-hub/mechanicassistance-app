import { useVideoPlayer, VideoView } from 'expo-video';
import { X } from 'lucide-react-native';
import React from 'react';
import { Modal, TouchableOpacity, View } from 'react-native';

interface VideoPlayerModalProps {
    /** Absolute URL of the clip, or null when nothing is playing. */
    url: string | null;
    onClose: () => void;
}

/**
 * Full-screen playback for a request's video attachment.
 *
 * A modal rather than an inline player in the strip: a list can hold several
 * clips, and mounting a player per thumbnail would keep that many decoders
 * alive. The player is created once and re-pointed at whatever `url` is open.
 */
export function VideoPlayerModal({ url, onClose }: VideoPlayerModalProps) {
    const player = useVideoPlayer(url, (instance) => {
        instance.loop = false;
    });

    React.useEffect(() => {
        if (url) player.play();
        else player.pause();
    }, [url, player]);

    return (
        <Modal visible={!!url} animationType="fade" transparent onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' }}>
                <TouchableOpacity
                    onPress={onClose}
                    style={{ position: 'absolute', top: 60, right: 24, zIndex: 1, padding: 8 }}
                >
                    <X size={26} color="#FFFFFF" />
                </TouchableOpacity>

                {url && (
                    <VideoView
                        player={player}
                        style={{ width: '100%', height: '70%' }}
                        contentFit="contain"
                        nativeControls
                        fullscreenOptions={{ enable: true }}
                    />
                )}
            </View>
        </Modal>
    );
}
