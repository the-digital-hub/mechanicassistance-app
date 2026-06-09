import { Button } from '@/components/ui/Button';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, UserX } from 'lucide-react-native';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

export default function DeleteAccountScreen() {
    const router = useRouter();
    const [showModal, setShowModal] = useState(false);

    const handleDelete = () => {
        // API Call to delete account
        console.log('Account deleted');
        setShowModal(false);
        router.replace('/login');
    };

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
            {/* Custom Header */}
            <View className="px-6 pt-20 pb-2 flex-row items-center justify-between" style={{ backgroundColor: '#F4F5FA', borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}>
                <TouchableOpacity onPress={() => router.back()}>
                    <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#FFFFFF' }}>
                        <ChevronLeft size={20} color="#0047AB" />
                    </View>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
                    Profile
                </Text>
                <View className="w-6" />
            </View>

        <ScrollView className="flex-1 px-6 pt-6">
            {/* Section Badge */}
            <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
              <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
              <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                ACCOUNT SETTINGS
              </Text>
            </View>

            {/* Title */}
            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">Delete Account</Text>

            {/* Subtitle */}
            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
              Permanently remove your account and all associated data
            </Text>

            <Text className="font-outfit-medium text-gray-900 text-lg mb-4">We're sorry to see you go.</Text>

            <Text className="font-outfit-regular text-gray-600 leading-6 mb-4">
                If you delete your account, all your data will be permanently removed.
            </Text>

            <Text className="font-outfit-regular text-gray-600 leading-6 mb-12">
                Are you sure you want to continue?
            </Text>

            <TouchableOpacity
                onPress={() => setShowModal(true)}
                activeOpacity={0.8}
                style={{ marginBottom: 40 }}
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
                    <Text className="text-white font-outfit-bold text-center mr-2">Delete Account</Text>
                    <ChevronRight size={20} color="white" />
                </LinearGradient>
            </TouchableOpacity>

            <ConfirmationModal
                visible={showModal}
                onClose={() => setShowModal(false)}
                onConfirm={handleDelete}
                title="Are you still sure you want to Delete your account?"
                message="" // Message inside title in design
                icon={UserX}
                iconColor="#00A8E8" // Cyan/Blue color from design
                confirmButtonColor="#0047AB"
                confirmText="Yes"
                cancelText="No"
            />
        </ScrollView>
        </View>
    );
}
