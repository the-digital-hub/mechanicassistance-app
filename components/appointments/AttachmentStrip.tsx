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
                // getApiBaseUrl() is not guaranteed free of a trailing slash (it can
                // come from the remote bootstrap config) — trim it, or a relative
                // attachment.url starting with '/' produces a double slash that
                // 404s. See docs/media-url-contract.md.
                const src = attachment.url.startsWith('http')
                    ? attachment.url
                    : `${ConfigService.getApiBaseUrl().replace(/\/+$/, '')}${attachment.url}`;

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
                            <Text className="text-gray-500 font-outfit-regular text-[13px] mt-1" numberOfLines={2}>
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

/** Where an attachment is read from: absolute, or relative to the API (see docs/media-url-contract.md). */
function attachmentSrc(url: string): string {
    return url.startsWith('http') ? url : `${ConfigService.getApiBaseUrl().replace(/\/+$/, '')}${url}`;
}

/**
 * The media a user attached, in a tidy white card: one under the other, large, each with its note when it has one. Tapping a video
 * opens it in the player.
 */
export function AttachmentCard({ photos, title }: { photos: unknown; title?: string }) {
    const [playing, setPlaying] = useState<string | null>(null);
    const attachments = parseAttachments(photos);
    if (attachments.length === 0) return null;

    return (
        <View
            testID="attachment-card"
            style={{ backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#EEF2FA', padding: 14, gap: 14, shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 }}
        >
            {title ? <Text className="font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: '#0B1530' }}>{title}</Text> : null}
            {attachments.map((attachment, index) => {
                const src = attachmentSrc(attachment.url);
                return (
                    <View key={`${attachment.url}-${index}`} style={{ gap: 8 }}>
                        <View style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 14, overflow: 'hidden', backgroundColor: '#F3F4F6' }}>
                            {attachment.type === 'video' ? (
                                <TouchableOpacity
                                    onPress={() => setPlaying(src)}
                                    activeOpacity={0.85}
                                    accessibilityRole="button"
                                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0B1530' }}
                                    testID="attachment-video"
                                >
                                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Play size={30} color="#FFFFFF" fill="#FFFFFF" />
                                    </View>
                                </TouchableOpacity>
                            ) : (
                                <Image source={{ uri: src }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            )}
                        </View>
                        {attachment.note ? (
                            <Text className="font-outfit-regular" style={{ fontSize: 15, lineHeight: 21, color: '#4B5563' }}>{attachment.note}</Text>
                        ) : null}
                    </View>
                );
            })}
            <VideoPlayerModal url={playing} onClose={() => setPlaying(null)} />
        </View>
    );
}
