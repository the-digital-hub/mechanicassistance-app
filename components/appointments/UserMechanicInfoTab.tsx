import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface UserMechanicInfoTabProps {
    mechanic: any; // Using any to match UserData flexibility
}

export function UserMechanicInfoTab({ mechanic }: UserMechanicInfoTabProps) {
    const { t } = useTranslation();
    const [viewReviews, setViewReviews] = useState(false);

    if (!mechanic) {
        return (
            <View className="items-center justify-center p-8">
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text className="text-gray-400 mt-2">{t('appointments.userMechanicInfo.loading')}</Text>
            </View>
        );
    }

    if (viewReviews) {
        return (
            <View className="gap-4">
                <TouchableOpacity onPress={() => setViewReviews(false)} className="flex-row items-center mb-2">
                    <Ionicons name="chevron-back" size={20} color="#3B82F6" />
                    <Text className="text-blue-600 font-outfit-medium ml-1">{t('appointments.userMechanicInfo.backToProfile')}</Text>
                </TouchableOpacity>
                <Text className="font-outfit-bold text-gray-900 text-lg mb-2">{t('appointments.userMechanicInfo.reviewsHistory')}</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                    {[1, 2, 3].map(i => (
                        <View key={i} className="bg-white border border-gray-100 rounded-xl p-4 mb-3">
                            <View className="flex-row justify-between mb-2">
                                <View className="flex-row">
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <Ionicons key={s} name="star" size={12} color="#3B82F6" />
                                    ))}
                                </View>
                                <Text className="text-gray-400 text-[10px]">{t('appointments.userMechanicInfo.sampleReviewDate')}</Text>
                            </View>
                            <Text className="text-gray-600 text-sm font-outfit-regular">{t('appointments.userMechanicInfo.sampleReviewText')}</Text>
                        </View>
                    ))}
                </ScrollView>
            </View>
        );
    }

    return (
        <View className="gap-6">
            <View className="items-center mb-6">
                <Image
                    source={{ uri: mechanic.profileImage || 'https://i.pravatar.cc/150?u=mechanic' }}
                    className="w-24 h-24 rounded-full mb-3 bg-gray-200"
                />
                <Text className="font-outfit-bold text-blue-900 text-xl">{mechanic.name || t('appointments.userTracking.unknown')} {mechanic.surname?.[0] || ''}.</Text>
                <Text className="text-blue-500 text-xs font-outfit-medium uppercase tracking-wider mb-2">
                    {t('appointments.userMechanicInfo.identifyMe', { vehicle: mechanic.vehicleInfo || t('appointments.userMechanicInfo.defaultVehicle') })}
                </Text>

                <View className="flex-row items-center gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map(s => (
                        <Ionicons key={s} name="star" size={14} color="#3B82F6" />
                    ))}
                </View>

                <Text className="text-gray-400 text-sm mb-4">{t('appointments.userMechanicInfo.mechanicSince')}</Text>

                <View className="flex-row gap-4">
                    <View className="flex-row items-center border border-blue-200 rounded-lg px-3 py-1 bg-blue-50">
                        <Ionicons name="time-outline" size={14} color="#0047AB" />
                        <Text className="text-blue-900 text-[10px] ml-1 font-outfit-bold">{t('appointments.userMechanicInfo.yearsExperience', { years: mechanic.experience || '5' })}</Text>
                    </View>
                    <View className="flex-row items-center border border-blue-200 rounded-lg px-3 py-1 bg-blue-50">
                        <Ionicons name="calendar-outline" size={14} color="#0047AB" />
                        <Text className="text-blue-900 text-[10px] ml-1 font-outfit-bold">{t('appointments.userMechanicInfo.schedule')}</Text>
                    </View>
                </View>
            </View>

            <View className="gap-4">
                <Text className="font-outfit-bold text-gray-900 text-lg">{t('appointments.userMechanicInfo.aboutMe')}</Text>
                <Text className="text-gray-600 text-sm font-outfit-regular leading-5">
                    {mechanic.bio || t('appointments.userMechanicInfo.defaultBio')}
                </Text>

                <Text className="font-outfit-bold text-gray-900 text-lg mt-2">{t('appointments.userMechanicInfo.specializeIn')}</Text>
                <View className="flex-row flex-wrap gap-2">
                    {(mechanic.specializations || [t('appointments.userMechanicInfo.defaultSpec1'), t('appointments.userMechanicInfo.defaultSpec2'), t('appointments.userMechanicInfo.defaultSpec3')]).map((tag: string) => (
                        <View key={tag} className="bg-transparent px-3 py-1.5 rounded-lg border border-blue-400">
                            <Text className="text-blue-500 text-xs font-outfit-medium">{tag}</Text>
                        </View>
                    ))}
                </View>

                <Text className="font-outfit-bold text-gray-900 text-lg mt-2">{t('appointments.userMechanicInfo.aseCertified')}</Text>
                <View className="flex-row gap-2 mb-4">
                    <View className="bg-blue-500 w-8 h-8 rounded-full items-center justify-center">
                        <Text className="text-[10px] font-outfit-bold text-white">ASE</Text>
                    </View>
                    {['A2', 'A4', 'A5'].map(cert => (
                        <View key={cert} className="bg-white border border-blue-200 w-8 h-8 rounded-lg items-center justify-center">
                            <Text className="text-[10px] font-outfit-bold text-blue-500">{cert}</Text>
                        </View>
                    ))}
                </View>

                <TouchableOpacity onPress={() => setViewReviews(true)}>
                    <Text className="text-blue-900 font-outfit-bold text-sm">{t('appointments.userMechanicInfo.seeReviews')}</Text>
                </TouchableOpacity>

                {/* Big Action Buttons */}
                <View className="gap-3 mt-4">
                    <TouchableOpacity className="bg-blue-600 w-full py-3 rounded-lg flex-row items-center justify-center gap-2">
                        <Ionicons name="call" size={20} color="white" />
                        <Text className="text-white font-outfit-bold text-base">{t('appointments.userTracking.call')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity className="bg-blue-600 w-full py-3 rounded-lg flex-row items-center justify-center gap-2">
                        <Ionicons name="chatbubble-ellipses" size={20} color="white" />
                        <Text className="text-white font-outfit-bold text-base">{t('appointments.userTracking.message')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
