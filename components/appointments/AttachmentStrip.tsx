import { ConfigService } from '@/lib/config/ConfigService';
import { parseAttachments } from '@/lib/media/attachments';
import { Play } from 'lucide-react-native';
import React, { useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { VideoPlayerModal } from './VideoPlayerModal';

interface AttachmentStripProps {
    /** Raw `photos` value from the API: JSON string, URL array, or attachment array. */
    photos: unknown;
    size?: number;
}

/**
 * Horizontal strip of the media a user attached to a request.
 *
 * Every screen that shows request media renders through this so the two stored
 * shapes (legacy URL strings, current `{url,type,note}` objects) are handled in
 * one place. Tapping a video tile opens it in VideoPlayerModal.
 */
export function AttachmentStrip({ photos, size = 110 }: AttachmentStripProps) {
    const [playing, setPlaying] = useState<string | null>(null);

    const attachments = parseAttachments(photos);
    if (attachments.length === 0) return null;

    return (
        <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {attachments.map((attachment, index) => {
                const src = attachment.url.startsWith('http')
                    ? attachment.url
                    : `${ConfigService.getApiBaseUrl()}${attachment.url}`;

                return (
                    <View key={`${attachment.url}-${index}`} style={{ width: size, marginRight: 10 }}>
                        <View style={{ width: size, height: size, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F3F4F6' }}>
                            {attachment.type === 'video' ? (
                                <TouchableOpacity
                                    onPress={() => setPlaying(src)}
                                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B1530' }}
                                >
                                    <Play size={24} color="#FFFFFF" />
                                </TouchableOpacity>
                            ) : (
                                <Image source={{ uri: src }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            )}
                        </View>
                        {attachment.note ? (
                            <Text className="text-gray-500 font-outfit-regular text-xs mt-1" numberOfLines={2}>
                                {attachment.note}
                            </Text>
                        ) : null}
                    </View>
                );
            })}
        </ScrollView>
        <VideoPlayerModal url={playing} onClose={() => setPlaying(null)} />
        </>
    );
}
