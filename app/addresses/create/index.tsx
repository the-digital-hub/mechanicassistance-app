import { Input } from '@/components/ui/Input';
import { useUser } from '@/context/UserContext';
import { useMechanicStatus } from '@/context/MechanicStatusContext';
import { US_STATES } from '@/lib/address';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Circle, Bell } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View, Modal, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function CreateAddressScreen() {
    const router = useRouter();
    const { user, updateUser } = useUser();
    const { mechanicStatus, setMechanicStatus } = useMechanicStatus();
    const [isLoading, setIsLoading] = useState(false);
    const [showStateModal, setShowStateModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);

    const isMechanic = user?.role?.toLowerCase().trim() === 'mechanic';

    const getStatusStyles = () => {
        switch (mechanicStatus) {
            case 'available':
                return { bgColor: '#ECFDF5', textColor: '#111827', dotColor: '#10B981' };
            case 'busy':
                return { bgColor: '#FEF3C7', textColor: '#111827', dotColor: '#F97316' };
            case 'offline':
                return { bgColor: '#F3F4F6', textColor: '#6B7280', dotColor: '#9CA3AF' };
            default:
                return { bgColor: '#ECFDF5', textColor: '#111827', dotColor: '#10B981' };
        }
    };

    const getStatusLabel = () => {
        if (mechanicStatus === 'available') return 'Available';
        if (mechanicStatus === 'busy') return 'Busy';
        return 'Offline';
    };

    const getStatusColor = (status: 'available' | 'busy' | 'offline') => {
        if (status === 'available') return '#10B981';
        if (status === 'busy') return '#F97316';
        return '#9CA3AF';
    };

    const statusOptions: Array<{ id: 'available' | 'busy' | 'offline', label: string, description: string }> = [
        {
            id: 'available',
            label: 'Available',
            description: 'Visible to owners and can receive new requests'
        },
        {
            id: 'busy',
            label: 'Busy',
            description: 'Visible but won\'t receive new requests'
        },
        {
            id: 'offline',
            label: 'Offline',
            description: 'Not visible to owners and won\'t receive requests'
        },
    ];

    const styles = getStatusStyles();

    const [formData, setFormData] = useState({
        street: '',
        apartment: '',
        city: '',
        state: 'FL',
        zip: ''
    });

    const handleCreate = async () => {
        if (!formData.street || !formData.city || !formData.zip) {
            alert('Please fill in all required fields');
            return;
        }

        setIsLoading(true);
        try {
            const updatedAddresses = user?.addresses ? [...user.addresses] : [];
            updatedAddresses.push({
                street: formData.street,
                apartment: formData.apartment,
                city: formData.city,
                state: formData.state,
                zip: formData.zip
            });

            await updateUser({ addresses: updatedAddresses });
            router.back();
        } catch {
            Alert.alert('Save Failed', 'Could not save the address. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
            {/* Custom Header */}
            <View className="px-6 pt-20 pb-2 flex-row items-center justify-between" style={{ backgroundColor: '#F4F5FA', borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}>
                {isMechanic ? (
                    <TouchableOpacity
                        onPress={() => setShowStatusModal(true)}
                        style={{ marginLeft: 0, backgroundColor: styles.bgColor, borderWidth: 1, borderColor: '#E5E7EB' }}
                        className="flex-row items-center gap-2 px-3 py-1.5 rounded-full"
                    >
                        <Circle size={8} color={styles.dotColor} fill={styles.dotColor} />
                        <Text style={{ color: styles.textColor }} className="font-outfit-semibold text-xs">
                            {getStatusLabel()}
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={() => router.back()}>
                        <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#FFFFFF' }}>
                            <ChevronLeft size={20} color="#0047AB" />
                        </View>
                    </TouchableOpacity>
                )}
                <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
                    Profile
                </Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/notifications')}>
                    <Bell size={24} color="#0047AB" />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 px-6 pt-6">
                {/* Section Badge */}
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                    <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                    <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                        NEW ADDRESS
                    </Text>
                </View>

                {/* Title */}
                <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">Add New Address</Text>

                {/* Subtitle */}
                <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                    Create a new address for your profile
                </Text>

                {/* Form Fields */}
                <View className="gap-4 mb-8">
                    <View>
                        <Text className="font-outfit-medium mb-2 text-gray-900">Street <Text className="text-red-500">*</Text></Text>
                        <Input
                            value={formData.street}
                            onChangeText={(t) => setFormData({ ...formData, street: t })}
                            containerClassName="bg-white border border-gray-300 rounded-2xl"
                            placeholder="Enter street address"
                        />
                    </View>

                    <View>
                        <Text className="font-outfit-medium mb-2 text-gray-900">Apartment / Suite</Text>
                        <Input
                            value={formData.apartment}
                            onChangeText={(t) => setFormData({ ...formData, apartment: t })}
                            containerClassName="bg-white border border-gray-300 rounded-2xl"
                            placeholder="Optional"
                        />
                    </View>

                    <View className="flex-row gap-4">
                        <View className="flex-1">
                            <Text className="font-outfit-medium mb-2 text-gray-900">City <Text className="text-red-500">*</Text></Text>
                            <Input
                                value={formData.city}
                                onChangeText={(t) => setFormData({ ...formData, city: t })}
                                containerClassName="bg-white border border-gray-300 rounded-2xl"
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="font-outfit-medium mb-2 text-gray-900">State</Text>
                            <TouchableOpacity
                                onPress={() => setShowStateModal(true)}
                                className="bg-white border border-gray-300 rounded-2xl h-[52px] justify-center px-4"
                            >
                                <Text className={`font-outfit-medium ${formData.state ? 'text-gray-900' : 'text-gray-400'}`}>
                                    {formData.state || 'FL'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View>
                        <Text className="font-outfit-medium mb-2 text-gray-900">Zip Code <Text className="text-red-500">*</Text></Text>
                        <Input
                            value={formData.zip}
                            onChangeText={(t) => {
                                const cleaned = t.replace(/\D/g, '').slice(0, 5);
                                setFormData({ ...formData, zip: cleaned });
                            }}
                            containerClassName="bg-white border border-gray-300 rounded-2xl"
                            keyboardType="number-pad"
                            maxLength={5}
                            placeholder="33139"
                        />
                    </View>
                </View>

                {/* Buttons Row */}
                <View className="flex-row gap-3 mb-10">
                    {/* Back Button */}
                    <TouchableOpacity
                        onPress={() => router.back()}
                        activeOpacity={0.8}
                        className="flex-1 py-4 rounded-lg border border-gray-300 items-center"
                    >
                        <Text className="text-gray-900 font-outfit-semibold text-base">Back</Text>
                    </TouchableOpacity>

                    {/* Create Button */}
                    <TouchableOpacity
                        onPress={handleCreate}
                        activeOpacity={0.8}
                        disabled={isLoading}
                        className="flex-1"
                    >
                        <LinearGradient
                            colors={['#2B66F8', '#081E72']}
                            start={{ x: 0, y: 1 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                borderRadius: 8,
                                paddingVertical: 16,
                                paddingHorizontal: 16,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text className="text-white font-outfit-semibold text-base text-center mr-2">Create</Text>
                                    <ChevronRight size={20} color="white" />
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* State Modal */}
            {showStateModal && (
                <View className="absolute inset-0 bg-black/40 justify-end">
                    <View className="bg-white rounded-t-3xl max-h-[60%]">
                        <View className="p-4 border-b border-gray-200 flex-row justify-between items-center">
                            <Text className="text-xl font-outfit-bold text-gray-900">Select State</Text>
                            <TouchableOpacity onPress={() => setShowStateModal(false)}>
                                <Text className="text-blue-600 font-outfit-bold">Done</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView className="flex-1">
                            {US_STATES.map((state) => (
                                <TouchableOpacity
                                    key={state.code}
                                    className="px-6 py-4 border-b border-gray-100 flex-row items-center justify-between"
                                    onPress={() => {
                                        setFormData({ ...formData, state: state.code });
                                        setShowStateModal(false);
                                    }}
                                >
                                    <Text className={`font-outfit-medium ${formData.state === state.code ? 'text-blue-600' : 'text-gray-900'}`}>
                                        {state.name}
                                    </Text>
                                    {formData.state === state.code && (
                                        <View className="w-5 h-5 rounded-full bg-blue-600" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            )}

            {/* Status Modal */}
            {isMechanic && (
                <Modal transparent visible={showStatusModal} animationType="fade">
                    <View className="flex-1 bg-black/50 justify-center items-center px-6">
                        <View className="bg-white w-full rounded-2xl p-6 items-center">
                            <Text className="text-lg font-outfit-bold text-gray-900 mb-6 text-center">
                                Change your status
                            </Text>

                            <View className="w-full gap-3">
                                {statusOptions.map((option) => (
                                    <TouchableOpacity
                                        key={option.id}
                                        onPress={() => {
                                            setMechanicStatus(option.id);
                                            setShowStatusModal(false);
                                        }}
                                        activeOpacity={0.8}
                                        className={`flex-row items-start gap-3 p-4 rounded-xl border ${
                                            mechanicStatus === option.id ? 'bg-blue-50 border-blue-200' : 'border-gray-200'
                                        }`}
                                    >
                                        <View className="mt-0.5">
                                            <Circle size={10} color={getStatusColor(option.id)} fill={getStatusColor(option.id)} />
                                        </View>
                                        <View className="flex-1">
                                            <Text className={`font-outfit-semibold text-base ${
                                                mechanicStatus === option.id ? 'text-blue-600' : 'text-gray-900'
                                            }`}>
                                                {option.label}
                                            </Text>
                                            <Text className="text-gray-600 font-outfit-regular text-xs mt-1">
                                                {option.description}
                                            </Text>
                                        </View>
                                        {mechanicStatus === option.id && (
                                            <View className="w-5 h-5 rounded-full bg-blue-600 mt-0.5" />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </View>
    );
}
