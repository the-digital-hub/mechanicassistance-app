import { Button } from '@/components/ui/Button';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function PrivacyScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleAccept = async () => {
        setLoading(true);
        // Supabase Update Placeholder
        // const { error } = await supabase.from('profiles').update({ privacy_accepted: true }).eq('id', user.id);

        // Simulate API call
        setTimeout(() => {
            setLoading(false);
            router.back();
        }, 1000);
    };

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
            <ScrollView className="flex-1 px-6 pt-6 mb-20">
                {/* Section Badge */}
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                  <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                  <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                    PRIVACY & SECURITY
                  </Text>
                </View>

                {/* Title */}
                <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">Privacy Policy</Text>

                {/* Subtitle */}
                <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                  Learn how we protect your data and privacy. Last updated: 14/08/2024
                </Text>

                <Text className="font-outfit-regular text-gray-600 leading-6 mb-6">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent pellentesque congue lorem, vel tincidunt tortor placerat a. Proin ac diam quam. Aenean in sagittis magna, ut feugiat diam. Fusce a scelerisque neque, sed accumsan metus.
                </Text>

                <Text className="font-outfit-bold text-gray-900 text-lg mb-2">Terms & conditions</Text>
                <Text className="font-outfit-regular text-gray-600 leading-6 mb-4">
                    Nunc auctor tortor in dolor luctus, quis euismod urna tincidunt. Aenean arcu metus, bibendum at rhoncus at, volutpat ut lacus. Morbi pellentesque malesuada eros semper ultrices. Vestibulum lobortis enim vel neque auctor, a ultrices ex placerat. Mauris ut lacinia justo, sed suscipit tortor. Nam egestas nulla posuere neque tincidunt porta.
                </Text>

                <View className="mb-4">
                    <Text className="font-outfit-regular text-gray-600 leading-6 mb-2">
                        1. Ut lacinia justo sit amet lorem sodales accumsan. Proin malesuada eleifend fermentum. Donec condimentum, nunc at rhoncus faucibus, ex nisi laoreet
                    </Text>
                    <Text className="font-outfit-regular text-gray-600 leading-6">
                        2. We may use your email address to send you occasional promotions and updates. You are able to opt out from receiving these emails at any time by adjusting your account settings.
                    </Text>
                </View>

                {/* Spacer for bottom button */}
                <View className="h-10" />
            </ScrollView>

            <View className="absolute bottom-0 w-full p-6 bg-white border-t border-gray-100">
                <TouchableOpacity
                    onPress={handleAccept}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    <LinearGradient
                        colors={['#2B66F8', '#081E72']}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            borderRadius: 10,
                            paddingVertical: 16,
                            paddingHorizontal: 16,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Text className="text-white font-outfit-bold text-center mr-2">Accept</Text>
                                <ChevronRight size={20} color="white" />
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
}
