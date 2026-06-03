import { useRouter } from 'expo-router';
import { Calendar, Clock, ShieldCheck, Video, ChevronRight, Zap } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function RequestAssistanceTypeScreen() {
    const router = useRouter();

    return (
        <View className="flex-1 bg-white">
            <ScrollView className="flex-1 px-6 pt-6">
                {/* Section Badge */}
                <View className="flex-row items-center gap-2 mb-4 bg-blue-50 px-3 py-1.5 rounded-full w-fit" style={{ backgroundColor: '#E9F1FF' }}>
                    <View className="w-2 h-2 bg-blue-600 rounded-full" />
                    <Text className="text-blue-600 font-outfit-bold text-xs tracking-widest">REQUEST A MECHANIC</Text>
                </View>

                {/* Title */}
                <Text className="text-gray-900 font-outfit-bold text-4xl mb-3">How can we help today?</Text>

                {/* Subtitle */}
                <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                    Pick the type of assistance — we&apos;ll route you to the right specialist.
                </Text>

                <View className="gap-4">
                    {/* Immediate Assistance - Featured Card */}
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/request-assistance/select-vehicle', params: { type: 'immediate' } })}
                        className="bg-blue-700 rounded-3xl p-6 flex-row items-center shadow-md"
                        activeOpacity={0.8}
                    >
                        {/* Icon */}
                        <View className="w-16 h-16 bg-blue-600/50 rounded-2xl justify-center items-center mr-4">
                            <Zap size={32} color="white" strokeWidth={2.5} />
                        </View>

                        {/* Content */}
                        <View className="flex-1">
                            <View className="flex-row items-center gap-2 mb-1">
                                {/* Badge */}
                                <View
                                    className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
                                    style={{
                                        backgroundColor: 'rgba(43, 102, 249, 0.2)',
                                        borderWidth: 1,
                                        borderColor: 'rgba(43, 102, 249, 0.4)'
                                    }}
                                >
                                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#2B66F9' }} />
                                    <Text className="font-outfit-bold text-[9px] tracking-widest" style={{ color: '#2B66F9' }}>RECOMMENDED · 24H PERIOD</Text>
                                </View>
                            </View>
                            <Text className="text-white font-outfit-bold text-xl">Immediate Assistance</Text>
                            <Text className="text-blue-100 font-outfit-regular text-sm mt-1">
                                A nearby mechanic dispatched right away.
                            </Text>
                        </View>

                        {/* Arrow Button */}
                        <View className="w-12 h-12 bg-white rounded-full justify-center items-center ml-3">
                            <ChevronRight size={24} color="#1D4ED8" strokeWidth={3} />
                        </View>
                    </TouchableOpacity>

                    {/* Scheduled Assistance */}
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/request-assistance/select-vehicle', params: { type: 'scheduled' } })}
                        className="bg-white border border-gray-200 rounded-2xl p-4 flex-row items-center shadow-sm"
                        activeOpacity={0.7}
                    >
                        <View className="w-14 h-14 rounded-2xl justify-center items-center mr-3" style={{ backgroundColor: '#E9F1FF' }}>
                            <Calendar size={28} color="#1E56E3" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-gray-900 font-outfit-bold text-lg">Scheduled Assistance</Text>
                            <Text className="text-gray-600 font-outfit-regular text-sm mt-0.5">
                                Pick a date and time that works for you.
                            </Text>
                            <View className="flex-row items-center gap-1.5 mt-2">
                                <Clock size={12} color="#6B7280" />
                                <Text className="text-blue-600 font-outfit-bold text-[11px] tracking-widest">7 DAYS PERIOD</Text>
                            </View>
                        </View>
                        <ChevronRight size={20} color="#6B7280" />
                    </TouchableOpacity>

                    {/* Video Call Assistance */}
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/request-assistance/select-vehicle', params: { type: 'videocall' } })}
                        className="bg-white border border-gray-200 rounded-2xl p-4 flex-row items-center shadow-sm"
                        activeOpacity={0.7}
                    >
                        <View className="w-14 h-14 rounded-2xl justify-center items-center mr-3" style={{ backgroundColor: '#E9F1FF' }}>
                            <Video size={28} color="#1E56E3" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-gray-900 font-outfit-bold text-lg">Video Call Assistance</Text>
                            <Text className="text-gray-600 font-outfit-regular text-sm mt-0.5">
                                Talk a mechanic through it from your phone.
                            </Text>
                            <View className="flex-row items-center gap-1.5 mt-2">
                                <Clock size={12} color="#6B7280" />
                                <Text className="text-blue-600 font-outfit-bold text-[11px] tracking-widest">DIY · ON DEMAND</Text>
                            </View>
                        </View>
                        <ChevronRight size={20} color="#6B7280" />
                    </TouchableOpacity>

                    {/* Accident */}
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/request-assistance/select-vehicle', params: { type: 'witness' } })}
                        className="bg-white border border-gray-200 rounded-2xl p-4 flex-row items-center shadow-sm"
                        activeOpacity={0.7}
                    >
                        <View className="w-14 h-14 rounded-2xl justify-center items-center mr-3" style={{ backgroundColor: '#E9F1FF' }}>
                            <ShieldCheck size={28} color="#1E56E3" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-gray-900 font-outfit-bold text-lg">Accident</Text>
                            <Text className="text-gray-600 font-outfit-regular text-sm mt-0.5">
                                Insurance support and on-scene response.
                            </Text>
                            <View className="flex-row items-center gap-1.5 mt-2">
                                <Clock size={12} color="#6B7280" />
                                <Text className="text-blue-600 font-outfit-bold text-[11px] tracking-widest">24H PERIOD</Text>
                            </View>
                        </View>
                        <ChevronRight size={20} color="#6B7280" />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}
