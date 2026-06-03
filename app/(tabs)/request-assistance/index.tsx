import { useRouter } from 'expo-router';
import { Calendar, Clock, ShieldCheck, Video, ChevronRight, Zap } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function RequestAssistanceTypeScreen() {
    const router = useRouter();

    return (
        <View className="flex-1 bg-white">
            <ScrollView className="flex-1 px-6 pt-6">
                {/* Section Badge */}
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">REQUEST A MECHANIC</Text>
                </View>

                {/* Title */}
                <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">How can we help today?</Text>

                {/* Subtitle */}
                <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                    Pick the type of assistance — we&apos;ll route you to the right specialist.
                </Text>

                <View className="gap-2">
                    {/* Immediate Assistance - Featured Card */}
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/request-assistance/select-vehicle', params: { type: 'immediate' } })}
                        className="rounded-2xl"
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['#2B66F8', '#081E72']}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                borderRadius: 16,
                                padding: 16,
                                flexDirection: 'row',
                                alignItems: 'center',
                            }}
                        >
                            {/* Icon */}
                            <View className="w-14 h-14 rounded-2xl justify-center items-center mr-3" style={{ backgroundColor: '#4D77EF', borderWidth: 1, borderColor: '#6789F1' }}>
                                <Zap size={28} color="white" strokeWidth={2.5} />
                            </View>

                            {/* Content */}
                            <View className="flex-1">
                                <View className="flex-row items-center gap-2 mb-1">
                                    {/* Badge */}
                                    <View
                                        className="flex-row items-center gap-1 rounded-full px-2.5 py-1"
                                        style={{
                                            backgroundColor: 'transparent',
                                            borderWidth: 1,
                                            borderColor: '#6789F1'
                                        }}
                                    >
                                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#49DE7F' }} />
                                        <Text className="font-outfit-bold text-[9px] tracking-widest" style={{ color: '#FFFFFF' }}>RECOMMENDED · 24H PERIOD</Text>
                                    </View>
                                </View>
                                <Text className="text-white font-outfit-bold text-xl">Immediate Assistance</Text>
                                <Text className="text-blue-100 font-outfit-regular text-base mt-1">
                                    A nearby mechanic dispatched right away.
                                </Text>
                            </View>

                            {/* Arrow Button */}
                            <View className="w-10 h-10 bg-white rounded-full justify-center items-center ml-3">
                                <ChevronRight size={20} color="#1D4ED8" strokeWidth={3} />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Scheduled Assistance */}
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/request-assistance/select-vehicle', params: { type: 'scheduled' } })}
                        className="bg-white rounded-2xl px-4 py-4 flex-row items-center" style={{ borderWidth: 1.5, borderColor: '#EEF2FA' }}
                        activeOpacity={0.7}
                    >
                        <View className="w-14 h-14 rounded-2xl justify-center items-center mr-1" style={{ backgroundColor: '#E9F1FF' }}>
                            <Calendar size={24} color="#1E56E3" />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-gray-900 font-outfit-bold text-lg">Scheduled Assistance</Text>
                            <Text className="text-gray-600 font-outfit-regular text-base mt-0.5">
                                Pick a date and time that works for you.
                            </Text>
                            <View className="flex-row items-center gap-1 mt-2 px-2.5 py-1 rounded-full w-fit" style={{ backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#DBE7FA', alignSelf: 'flex-start' }}>
                                <Clock size={10} color="#0047AB" />
                                <Text className="text-blue-600 font-outfit-bold text-[9px] tracking-widest">7 DAYS PERIOD</Text>
                            </View>
                        </View>
                        <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#F4F8FF' }}>
                            <ChevronRight size={20} color="#6B7280" />
                        </View>
                    </TouchableOpacity>

                    {/* Video Call Assistance */}
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/request-assistance/select-vehicle', params: { type: 'videocall' } })}
                        className="bg-white rounded-2xl p-4 flex-row items-center" style={{ borderWidth: 1.5, borderColor: '#EEF2FA' }}
                        activeOpacity={0.7}
                    >
                        <View className="w-14 h-14 rounded-2xl justify-center items-center mr-1" style={{ backgroundColor: '#E9F1FF' }}>
                            <Video size={28} color="#1E56E3" />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-gray-900 font-outfit-bold text-lg">Video Call Assistance</Text>
                            <Text className="text-gray-600 font-outfit-regular text-base mt-0.5">
                                Talk a mechanic through it from your phone.
                            </Text>
                            <View className="flex-row items-center gap-1 mt-2 px-2.5 py-1 rounded-full w-fit" style={{ backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#DBE7FA', alignSelf: 'flex-start' }}>
                                <Clock size={10} color="#0047AB" />
                                <Text className="text-blue-600 font-outfit-bold text-[9px] tracking-widest">DIY · ON DEMAND</Text>
                            </View>
                        </View>
                        <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#F4F8FF' }}>
                            <ChevronRight size={20} color="#6B7280" />
                        </View>
                    </TouchableOpacity>

                    {/* Accident */}
                    <TouchableOpacity
                        onPress={() => router.push({ pathname: '/request-assistance/select-vehicle', params: { type: 'witness' } })}
                        className="bg-white rounded-2xl px-4 py-4 flex-row items-center" style={{ borderWidth: 1.5, borderColor: '#EEF2FA' }}
                        activeOpacity={0.7}
                    >
                        <View className="w-14 h-14 rounded-2xl justify-center items-center mr-1" style={{ backgroundColor: '#E9F1FF' }}>
                            <ShieldCheck size={28} color="#1E56E3" />
                        </View>
                        <View className="flex-1 ml-2">
                            <Text className="text-gray-900 font-outfit-bold text-lg">Accident</Text>
                            <Text className="text-gray-600 font-outfit-regular text-base mt-0.5">
                                Insurance support and on-scene response.
                            </Text>
                            <View className="flex-row items-center gap-1 mt-2 px-2.5 py-1 rounded-full w-fit" style={{ backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#DBE7FA', alignSelf: 'flex-start' }}>
                                <Clock size={10} color="#0047AB" />
                                <Text className="text-blue-600 font-outfit-bold text-[9px] tracking-widest">24H PERIOD</Text>
                            </View>
                        </View>
                        <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#F4F8FF' }}>
                            <ChevronRight size={20} color="#6B7280" />
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}
