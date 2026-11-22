import { Check, Search, SlidersHorizontal, Trash2, X } from 'lucide-react-native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { OwnerSheet, SheetOption } from '@/components/dashboard/OwnerHomeBlocks';
import { TYPE } from '@/lib/ui/type';

const C = { blue: '#1E56E3', soft: '#EAF1FF', text: '#0B1530', muted: '#6B7490', border: '#E4EAF5' };
const K = 'notifications';

/** The groups a notification belongs to, for the filter: what it is about, not its backend kind. */
export type NotificationGroup = 'requests' | 'video' | 'reviews' | 'payments' | 'other';
export const NOTIFICATION_GROUPS: NotificationGroup[] = ['requests', 'video', 'reviews', 'payments', 'other'];

export function groupOfKind(kind: string): NotificationGroup {
    if (kind.startsWith('video_call')) return 'video';
    if (kind === 'review_requested') return 'reviews';
    if (kind === 'payment') return 'payments';
    if (['new_request', 'mechanic_found', 'request_status', 'service_redirected', 'offer_accepted', 'request_canceled', 'obd_reminder'].includes(kind)) return 'requests';
    return 'other';
}

/** The search box and the filter button in one row, and the filters in force as chips that can be removed one by one. */
export function NotificationsToolbar({ query, onQuery, groups, onGroups }: {
    query: string;
    onQuery: (q: string) => void;
    groups: NotificationGroup[];
    onGroups: (g: NotificationGroup[]) => void;
}) {
    const { t } = useTranslation();
    const [sheet, setSheet] = React.useState(false);
    const count = groups.length;
    const toggle = (g: NotificationGroup) => onGroups(groups.includes(g) ? groups.filter((x) => x !== g) : [...groups, g]);

    return (
        <View style={{ gap: 10 }} testID="notifications-toolbar">
            <View className="flex-row items-center" style={{ gap: 10 }}>
                <View className="flex-1 flex-row items-center" style={{ height: 48, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, gap: 8 }}>
                    <Search size={18} color="#8C96AE" />
                    <TextInput
                        value={query}
                        onChangeText={onQuery}
                        placeholder={t(`${K}.searchPlaceholder`)}
                        placeholderTextColor="#8C96AE"
                        returnKeyType="search"
                        autoCorrect={false}
                        className="flex-1 font-outfit-regular"
                        style={{ ...TYPE.body, color: C.text, paddingVertical: 0 }}
                        testID="notifications-search"
                    />
                    {query ? (
                        <TouchableOpacity onPress={() => onQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={t(`${K}.clearSearch`)}>
                            <X size={16} color="#8C96AE" />
                        </TouchableOpacity>
                    ) : null}
                </View>
                <TouchableOpacity
                    onPress={() => setSheet(true)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={t(`${K}.filter`)}
                    className="items-center justify-center"
                    style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: count > 0 ? C.blue : C.soft }}
                    testID="notifications-filter-button"
                >
                    <SlidersHorizontal size={20} color={count > 0 ? '#FFFFFF' : C.blue} />
                    {count > 0 ? (
                        <View className="items-center justify-center" style={{ position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: '#E53E3E', borderWidth: 2, borderColor: '#F6F8FC' }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 12, lineHeight: 15, color: '#FFFFFF' }}>{count}</Text>
                        </View>
                    ) : null}
                </TouchableOpacity>
            </View>

            {count > 0 ? (
                <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
                    {groups.map((g) => (
                        <TouchableOpacity key={g} onPress={() => toggle(g)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${t(`${K}.groups.${g}`)}, ${t(`${K}.removeFilter`)}`} className="flex-row items-center" style={{ gap: 6, minHeight: 32, paddingLeft: 12, paddingRight: 8, borderRadius: 100, backgroundColor: C.soft }}>
                            <Text className="font-outfit-bold" style={{ fontSize: 14, color: C.blue }}>{t(`${K}.groups.${g}`)}</Text>
                            <X size={14} color={C.blue} />
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => onGroups([])} hitSlop={8} accessibilityRole="button">
                        <Text className="font-outfit-semibold" style={{ fontSize: 14, color: C.muted }}>{t(`${K}.clearFilters`)}</Text>
                    </TouchableOpacity>
                </View>
            ) : null}

            <OwnerSheet visible={sheet} title={t(`${K}.filter`)} onClose={() => setSheet(false)}>
              <View style={{ gap: 12 }}>
                <Text className="font-outfit-bold" style={{ ...TYPE.question, color: C.text }}>{t(`${K}.typeTitle`)}</Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {NOTIFICATION_GROUPS.map((g) => {
                        const on = groups.includes(g);
                        return (
                            <TouchableOpacity key={g} onPress={() => toggle(g)} activeOpacity={0.8} accessibilityRole="checkbox" accessibilityState={{ checked: on }} className="items-center justify-center" style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 100, backgroundColor: on ? C.blue : C.soft }} testID={`notifications-group-${g}`}>
                                <Text className="font-outfit-bold" style={{ fontSize: 14, color: on ? '#FFFFFF' : C.blue }}>{t(`${K}.groups.${g}`)}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <TouchableOpacity onPress={() => setSheet(false)} activeOpacity={0.85} accessibilityRole="button" className="items-center justify-center" style={{ minHeight: 56, borderRadius: 14, backgroundColor: C.blue, marginTop: 6 }}>
                    <Text className="font-outfit-bold" style={{ ...TYPE.button, color: '#FFFFFF' }}>{t(`${K}.done`)}</Text>
                </TouchableOpacity>
                {count > 0 ? (
                    <TouchableOpacity onPress={() => onGroups([])} activeOpacity={0.85} accessibilityRole="button" className="items-center justify-center" style={{ minHeight: 56, borderRadius: 14, backgroundColor: '#E6EAF2' }}>
                        <Text className="font-outfit-bold" style={{ ...TYPE.button, color: '#4A5470' }}>{t(`${K}.clearFilters`)}</Text>
                    </TouchableOpacity>
                ) : null}
              </View>
            </OwnerSheet>
        </View>
    );
}

/** What can be done to the whole inbox, in a sheet from below: one button instead of two bare icons. */
export function NotificationsActionsSheet({ visible, onClose, unread, total, onMarkAllRead, onDeleteAll }: {
    visible: boolean;
    onClose: () => void;
    unread: number;
    total: number;
    onMarkAllRead: () => void;
    onDeleteAll: () => void;
}) {
    const { t } = useTranslation();
    return (
        <OwnerSheet visible={visible} title={t(`${K}.actionsTitle`)} onClose={onClose}>
            <View style={{ gap: 10 }}>
            <SheetOption
                icon={Check}
                title={t(`${K}.markAllRead`)}
                subtitle={unread > 0 ? t(`${K}.markAllReadSub`, { count: unread }) : t(`${K}.nothingUnread`)}
                onPress={() => { if (unread > 0) onMarkAllRead(); onClose(); }}
            />
            <SheetOption
                icon={Trash2}
                title={t(`${K}.deleteAll`)}
                subtitle={t(`${K}.deleteAllSub`, { count: total })}
                onPress={() => { onClose(); if (total > 0) onDeleteAll(); }}
            />
            </View>
        </OwnerSheet>
    );
}
