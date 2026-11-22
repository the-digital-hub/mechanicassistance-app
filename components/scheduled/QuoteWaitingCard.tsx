import { Calendar, Car, DollarSign, MapPin } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { AttentionTimer } from '@/components/dashboard/AttentionExtras';
import type { AssistanceRequest } from '@/lib/dao/interfaces';
import { refLabel } from '@/lib/refCode';
import { parseRequestNotes } from '@/lib/scheduled/provider';
import { TYPE } from '@/lib/ui/type';
import { splitJobTitle } from '@/lib/ui/jobTitle';

const INK = { text: '#0B1530', muted: '#6B7490', faint: '#9CA3AF', blue: '#1E56E3', blueDark: '#0B2A8E', blueSoft: '#EAF1FF', line: '#EEF2FA' };

/** A thin separator with rounded ends, between the blocks of the card. */
function Divider() {
    return <View style={{ height: 2, borderRadius: 1, backgroundColor: INK.line }} />;
}

/** A line of the card: its icon in a small tile and the text next to it. */
function Row({ icon: Icon, children }: { icon: typeof Car; children: React.ReactNode }) {
    return (
        <View className="flex-row items-center" style={{ gap: 12 }}>
            <View className="items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: INK.blueSoft }}>
                <Icon size={16} color={INK.blue} />
            </View>
            <View className="flex-1" style={{ minWidth: 0 }}>{children}</View>
        </View>
    );
}

/**
 * A scheduled request this technician already quoted, in "Your quotes": what it is, the vehicle, when it is wanted and where, the amount
 * sent in its own block and how long the customer still has to decide. One button: it opens the sent quote, where it can also be edited.
 */
export function QuoteWaitingCard({ request, onOpen, onDecline }: { request: AssistanceRequest; onOpen: (id: string) => void; onDecline?: (id: string) => void }) {
    const { t } = useTranslation();
    const issue = splitJobTitle(request.title).main || request.title;
    const price = request.myQuote?.price ? `$${Number(request.myQuote.price).toFixed(2)}` : null;
    const when = parseRequestNotes(request.notes, request.date);
    const area = [request.zip, request.distance].filter(Boolean).join(' · ');
    return (
        <View
            className="bg-white"
            style={{ borderRadius: 20, padding: 16, gap: 14, borderWidth: 1, borderColor: INK.line, shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 }}
            testID={`quote-card-${request.id}`}
        >
            <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className="items-center justify-center" style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#EDE9FE' }}>
                    <Calendar size={22} color="#7C3AED" />
                </View>
                <View className="flex-1" style={{ minWidth: 0 }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 12, lineHeight: 16, letterSpacing: 0.8, color: INK.muted }}>{t('requestAssistance.header.scheduled').toUpperCase()}</Text>
                    <Text className="font-outfit-bold" style={{ fontSize: 17, lineHeight: 22, color: INK.text }} numberOfLines={2}>{issue}</Text>
                    {/* The time left is a status badge, right under what the request is (the pill brings its own clock and top margin). */}
                    {request.offersCloseAt ? (
                        <View style={{ marginTop: -4 }}>
                            <AttentionTimer spec={{ deadline: request.offersCloseAt, urgentUnderMinutes: 120, label: (time) => t('scheduledProvider.quoteCard.decides', { time }) }} />
                        </View>
                    ) : null}
                </View>
            </View>

            <Divider />

            <View style={{ gap: 12 }}>
                {request.car ? (
                    <Row icon={Car}>
                        <Text className="font-outfit-semibold" style={{ fontSize: 15, lineHeight: 21, color: INK.text }} numberOfLines={1}>{request.car}</Text>
                    </Row>
                ) : null}
                {request.car && (when.days || when.window) ? <Divider /> : null}
                {when.days || when.window ? (
                    <Row icon={Calendar}>
                        {when.days ? <Text className="font-outfit-semibold" style={{ fontSize: 15, lineHeight: 21, color: INK.text }}>{when.days}</Text> : null}
                        {when.window ? <Text className="font-outfit-regular" style={{ fontSize: 14, lineHeight: 20, color: INK.muted }}>{when.window}</Text> : null}
                    </Row>
                ) : null}
                {area && (request.car || when.days || when.window) ? <Divider /> : null}
                {area ? (
                    <Row icon={MapPin}>
                        <Text className="font-outfit-semibold" style={{ fontSize: 15, lineHeight: 21, color: INK.text }} numberOfLines={1}>{area}</Text>
                    </Row>
                ) : null}
                {/* The amount sent is one more line of the card, not a box inside it. */}
                {price && (request.car || when.days || when.window || area) ? <Divider /> : null}
                {price ? (
                    <Row icon={DollarSign}>
                        <Text className="font-outfit-semibold" style={{ fontSize: 13, lineHeight: 17, color: INK.muted }}>{t('scheduledProvider.quoteCard.sent')}</Text>
                        <Text className="font-outfit-bold" style={{ fontSize: 22, lineHeight: 28, letterSpacing: -0.4, color: INK.blueDark }}>{price}</Text>
                    </Row>
                ) : null}
            </View>

            <Divider />

            <TouchableOpacity
                onPress={() => onOpen(request.id)}
                activeOpacity={0.85}
                accessibilityRole="button"
                className="items-center justify-center"
                style={{ minHeight: 56, borderRadius: 14, backgroundColor: INK.blue }}
                testID={`quote-open-${request.id}`}
            >
                <Text className="font-outfit-bold text-white" style={TYPE.button}>{t('scheduledProvider.quoteCard.open')}</Text>
            </TouchableOpacity>

            {onDecline ? (
                <TouchableOpacity
                    onPress={() => onDecline(request.id)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    className="items-center justify-center"
                    style={{ minHeight: 56, borderRadius: 14, backgroundColor: '#E6EAF2' }}
                    testID={`quote-decline-${request.id}`}
                >
                    <Text className="font-outfit-bold" style={{ ...TYPE.button, color: '#4A5470' }}>{t('scheduledProvider.decline.cta')}</Text>
                </TouchableOpacity>
            ) : null}

            <Text className="font-outfit-regular text-center" style={{ fontSize: 12, lineHeight: 16, color: INK.faint }} selectable>{refLabel(request.refCode, request.id)}</Text>
        </View>
    );
}
