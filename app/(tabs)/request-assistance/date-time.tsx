import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

/**
 * Date + time step of the request wizard. Only `scheduled` and `videocall`
 * requests reach this screen — `immediate` and `witness` are served right away
 * and carry no date. The chosen slot travels on as an ISO-8601 `date` param and
 * ends up in assistance_requests.date.
 *
 * Built from plain RN pieces on purpose: components/ui/DatePicker.tsx only covers
 * dates of birth (past years, no time), and a native picker would mean a new
 * native dependency plus a dev-client rebuild. Fixed slots also match scheduling
 * against mechanic availability better than a free-form time.
 */
const DAYS_AHEAD = 14;
const SLOT_START_HOUR = 8;
const SLOT_END_HOUR = 20;
const SLOT_STEP_MINUTES = 30;
/** Earliest a scheduled request can start, so mechanics have time to accept. */
const LEAD_TIME_MINUTES = 60;

const startOfDay = (d: Date) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy;
};

export default function DateTimeScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const params = useLocalSearchParams();

    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);

    const now = useMemo(() => new Date(), []);

    const days = useMemo(() => {
        const base = startOfDay(now);
        return Array.from({ length: DAYS_AHEAD }, (_, i) => {
            const d = new Date(base);
            d.setDate(base.getDate() + i);
            return d;
        });
    }, [now]);

    const selectedDay = days[selectedDayIndex];

    // Slots are minutes-from-midnight. On today, drop anything already past or
    // inside the lead time — you can't schedule for five minutes ago.
    const slots = useMemo(() => {
        const all: number[] = [];
        for (let h = SLOT_START_HOUR; h < SLOT_END_HOUR; h++) {
            for (let m = 0; m < 60; m += SLOT_STEP_MINUTES) all.push(h * 60 + m);
        }
        const isToday = startOfDay(now).getTime() === selectedDay.getTime();
        if (!isToday) return all;
        const earliest = now.getHours() * 60 + now.getMinutes() + LEAD_TIME_MINUTES;
        return all.filter((minutes) => minutes >= earliest);
    }, [now, selectedDay]);

    const formatDayLabel = (d: Date) =>
        d.toLocaleDateString(i18n.language, { weekday: 'short' });

    const formatSlotLabel = (minutes: number) => {
        const d = new Date(selectedDay);
        d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        return d.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
    };

    const handleSelectDay = (index: number) => {
        setSelectedDayIndex(index);
        // The picked time may not exist on the new day (lead time on today), so
        // force a fresh pick instead of silently keeping a stale one.
        setSelectedMinutes(null);
    };

    const handleContinue = () => {
        if (selectedMinutes == null) return;
        const chosen = new Date(selectedDay);
        chosen.setHours(Math.floor(selectedMinutes / 60), selectedMinutes % 60, 0, 0);

        router.push({
            pathname: '/request-assistance/confirmation',
            params: { ...params, date: chosen.toISOString() },
        });
    };

    const canContinue = selectedMinutes != null;

    return (
        <View className="flex-1" style={{ backgroundColor: '#F4F6FC' }}>
            <View
                className="px-6 pt-20 pb-2 flex-row items-center justify-between"
                style={{ backgroundColor: '#F4F5FA', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 3, borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}
            >
                <TouchableOpacity onPress={() => router.back()}>
                    <View
                        className="w-10 h-10 rounded-full justify-center items-center"
                        style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}
                    >
                        <ChevronLeft size={20} color="#0047AB" />
                    </View>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
                    {t('requestAssistance.dateTime.header')}
                </Text>
                <View className="w-6" />
            </View>

            <ScrollView className="flex-1 px-6 pt-6">
                <View
                    className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}
                >
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                        {t('requestAssistance.dateTime.badge')}
                    </Text>
                </View>

                <Text className="text-gray-900 font-outfit-medium text-3xl mb-2">
                    {t('requestAssistance.dateTime.title')}
                </Text>
                <Text className="text-gray-500 font-outfit-regular text-base mb-6">
                    {t('requestAssistance.dateTime.subtitle')}
                </Text>

                <Text className="text-gray-400 font-outfit-medium text-sm uppercase tracking-wide mb-2">
                    {t('requestAssistance.dateTime.dayLabel')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                    {days.map((day, index) => {
                        const isSelected = index === selectedDayIndex;
                        return (
                            <TouchableOpacity
                                key={day.toISOString()}
                                onPress={() => handleSelectDay(index)}
                                activeOpacity={0.8}
                                className="mr-2 items-center justify-center px-4 py-3"
                                style={{
                                    borderRadius: 10,
                                    minWidth: 64,
                                    backgroundColor: isSelected ? '#0047AB' : '#FFFFFF',
                                    borderWidth: 1,
                                    borderColor: isSelected ? '#0047AB' : '#E1EAFB',
                                }}
                            >
                                <Text
                                    className="font-outfit-medium text-xs uppercase tracking-wide"
                                    style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : '#9CA3AF' }}
                                >
                                    {formatDayLabel(day)}
                                </Text>
                                <Text
                                    className="font-outfit-semibold text-lg"
                                    style={{ color: isSelected ? '#FFFFFF' : '#1A1A1A' }}
                                >
                                    {day.getDate()}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <Text className="text-gray-400 font-outfit-medium text-sm uppercase tracking-wide mb-2">
                    {t('requestAssistance.dateTime.timeLabel')}
                </Text>
                {slots.length === 0 ? (
                    <View className="p-4 rounded-2xl mb-6" style={{ backgroundColor: '#F4F8FF' }}>
                        <Text className="text-gray-500 font-outfit-regular text-center">
                            {t('requestAssistance.dateTime.noSlots')}
                        </Text>
                    </View>
                ) : (
                    <View className="flex-row flex-wrap mb-6" style={{ gap: 8 }}>
                        {slots.map((minutes) => {
                            const isSelected = minutes === selectedMinutes;
                            return (
                                <TouchableOpacity
                                    key={minutes}
                                    onPress={() => setSelectedMinutes(minutes)}
                                    activeOpacity={0.8}
                                    className="px-4 py-3"
                                    style={{
                                        borderRadius: 10,
                                        backgroundColor: isSelected ? '#0047AB' : '#FFFFFF',
                                        borderWidth: 1,
                                        borderColor: isSelected ? '#0047AB' : '#E1EAFB',
                                    }}
                                >
                                    <Text
                                        className="font-outfit-medium text-[15px]"
                                        style={{ color: isSelected ? '#FFFFFF' : '#1A1A1A' }}
                                    >
                                        {formatSlotLabel(minutes)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                <TouchableOpacity
                    onPress={handleContinue}
                    disabled={!canContinue}
                    activeOpacity={0.8}
                    style={{ opacity: canContinue ? 1 : 0.6 }}
                >
                    <LinearGradient
                        colors={canContinue ? ['#2B66F8', '#081E72'] : ['#9CA3AF', '#6B7280']}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            borderRadius: 10,
                            paddingVertical: 16,
                            paddingHorizontal: 16,
                            marginBottom: 32,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Text className="text-white font-outfit-bold text-center">
                            {t('requestAssistance.dateTime.continue')}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
