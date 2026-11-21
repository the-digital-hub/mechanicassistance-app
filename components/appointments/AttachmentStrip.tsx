import { ConfigService } from '@/lib/config/ConfigService';
import { parseAttachments } from '@/lib/media/attachments';
import { Play } from 'lucide-react-native';
import React, { useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { ImageViewerModal } from './ImageViewerModal';
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
 * The media a user attached, in a tidy white card, as thumbnails (three to a row). Tapping a photo opens it full size (swipe for the
 * others, with its note); tapping a video plays it. A note shows under its thumbnail, short.
 */
export function AttachmentCard({ photos, title }: { photos: unknown; title?: string }) {
    const [playing, setPlaying] = useState<string | null>(null);
    const [viewing, setViewing] = useState<number | null>(null);
    const [gridWidth, setGridWidth] = useState(0);
    const attachments = parseAttachments(photos);
    if (attachments.length === 0) return null;

    const GAP = 10;
    const COLUMNS = 3;
    const size = gridWidth > 0 ? Math.floor((gridWidth - GAP * (COLUMNS - 1)) / COLUMNS) : 0;
    const items = attachments.map((a) => ({ ...a, src: attachmentSrc(a.url) }));
    // The photos only, in order, for the viewer; each thumbnail knows its place among them.
    const images = items.filter((a) => a.type !== 'video').map((a) => ({ uri: a.src, note: a.note }));
    let imageIndex = -1;

    return (
        <View
            testID="attachment-card"
            style={{ backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#EEF2FA', padding: 14, gap: 12, shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 }}
        >
            {title ? <Text className="font-outfit-bold" style={{ fontSize: 16, lineHeight: 22, color: '#0B1530' }}>{title}</Text> : null}
            <View onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
                {size > 0 ? items.map((attachment, index) => {
                    const isVideo = attachment.type === 'video';
                    const myImage = isVideo ? -1 : ++imageIndex;
                    return (
                        <View key={`${attachment.url}-${index}`} style={{ width: size }}>
                            <TouchableOpacity
                                onPress={() => (isVideo ? setPlaying(attachment.src) : setViewing(myImage))}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityLabel={isVideo ? 'Play video' : 'Open photo'}
                                testID={isVideo ? 'attachment-video' : 'attachment-photo'}
                                style={{ width: size, height: size, borderRadius: 12, overflow: 'hidden', backgroundColor: isVideo ? '#0B1530' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}
                            >
                                {isVideo ? (
                                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                                        <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
                                    </View>
                                ) : (
                                    <Image source={{ uri: attachment.src }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                )}
                            </TouchableOpacity>
                            {attachment.note ? (
                                <Text className="font-outfit-regular" numberOfLines={2} style={{ fontSize: 13, lineHeight: 17, color: '#6B7490', marginTop: 4 }}>{attachment.note}</Text>
                            ) : null}
                        </View>
                    );
                }) : null}
            </View>
            <ImageViewerModal images={images} startIndex={viewing} onClose={() => setViewing(null)} />
            <VideoPlayerModal url={playing} onClose={() => setPlaying(null)} />
        </View>
    );
}
