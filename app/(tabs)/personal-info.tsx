import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUser } from '@/context/UserContext';
import { US_STATES, normalizeStreet } from '@/lib/address';
import { mediaDAO } from '@/lib/dao/MediaDAO';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, CheckCircle2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function PersonalInfoScreen() {
    const router = useRouter();
    const { user, isLoading, updateUser } = useUser();
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showStateModal, setShowStateModal] = useState(false);
    const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [localProfileUri, setLocalProfileUri] = useState<string | null>(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    const scrollViewRef = useRef<ScrollView>(null);
    const streetContainerRef = useRef<View>(null);
    const apartmentContainerRef = useRef<View>(null);
    const cityContainerRef = useRef<View>(null);
    const zipContainerRef = useRef<View>(null);

    const scrollToField = (fieldRef: React.RefObject<View | null>) => {
        if (!fieldRef.current || !scrollViewRef.current) return;

        fieldRef.current.measureLayout(
            scrollViewRef.current as any,
            (_x, y) => scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true }),
            () => { }
        );
    };
    const [formData, setFormData] = useState({
        name: user?.name || '',
        surname: user?.surname || '',
        email: user?.email || '',
        phone: formatPhoneNumber(user?.phone || ''),
        dob: user?.dob || '',
        profileImage: user?.profileImage,
        address: {
            street: user?.addresses?.[0]?.street || '',
            apartment: user?.addresses?.[0]?.apartment || '',
            city: user?.addresses?.[0]?.city || '',
            state: user?.addresses?.[0]?.state || '',
            zip: user?.addresses?.[0]?.zip || ''
        }
    });

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name,
                surname: user.surname,
                email: user.email,
                phone: formatPhoneNumber(user.phone),
                dob: user.dob,
                profileImage: user.profileImage,
                address: {
                    street: user.addresses?.[0]?.street || '',
                    apartment: user.addresses?.[0]?.apartment || '',
                    city: user.addresses?.[0]?.city || '',
                    state: user.addresses?.[0]?.state || '',
                    zip: user.addresses?.[0]?.zip || ''
                }
            });
        }
    }, [user]);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (result.canceled) return;
        const localUri = result.assets[0].uri;
        setLocalProfileUri(localUri);
        setIsUploadingPhoto(true);
        try {
            const uploaded = await mediaDAO.uploadPhoto(localUri);
            setFormData((prev) => ({ ...prev, profileImage: uploaded.url }));
        } catch {
            Alert.alert('Upload Failed', 'Could not upload profile photo. Please try again.');
            setLocalProfileUri(null);
        } finally {
            setIsUploadingPhoto(false);
        }
    };

    const getPlainPhoneNumber = (text: string) => {
        if (!text) return '';
        const cleaned = text.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `+1${cleaned}`;
        }
        if (cleaned.length === 11 && cleaned.startsWith('1')) {
            return `+${cleaned}`;
        }
        return `+${cleaned}`;
    };

    const handleUpdate = async () => {
        const payloadToUpdate = {
            ...formData,
            phone: getPlainPhoneNumber(formData.phone)
        };
        await updateUser(payloadToUpdate);
        setShowSuccessModal(true);
    };

    const searchAddress = async (query: string) => {
        if (query.length < 3) {
            setSearchSuggestions([]);
            return;
        }

        setIsSearching(true);
        try {
            // Bias the search with ", FL" and increase limit to get more candidates for local filtering
            const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query + ", FL")}&limit=10&lang=en`);
            const data = await response.json();

            // Filter results to only include Florida
            const flResults = (data.features || []).filter((f: any) => {
                const state = f.properties?.state?.toLowerCase();
                return state === 'florida' || state === 'fl';
            });

            setSearchSuggestions(flResults.slice(0, 5)); // Show top 5 FL results
        } catch (error) {
            console.error('Search failed:', error);
        } finally {
            setIsSearching(false);
        }
    };


    const getFormattedAddress = (feature: any) => {
        const { properties } = feature;
        const houseNumber = properties.housenumber || '';
        const streetPart = properties.street || properties.name || '';
        const city = properties.city || '';
        const stateName = properties.state || '';
        const zip = properties.postcode || '';

        const normalizedStreet = normalizeStreet(streetPart);
        const street = `${houseNumber} ${normalizedStreet}`.trim();

        // Try shortened state
        const stateMapping = US_STATES.find(s =>
            s.name.toLowerCase() === stateName.toLowerCase() ||
            s.code.toLowerCase() === stateName.toLowerCase()
        );
        const stateCode = stateMapping?.code || stateName;

        return `${street}, ${city}, ${stateCode} ${zip}`.replace(/,\s*$/, '');
    };

    const handleSelectAddress = (feature: any) => {
        const { properties } = feature;
        const houseNumber = properties.housenumber || '';
        const streetPart = properties.street || properties.name || '';
        const city = properties.city || '';
        const stateName = properties.state || '';
        const zip = properties.postcode || '';

        const normalizedStreet = normalizeStreet(streetPart);

        // Try to map state name to 2-letter code
        const stateMapping = US_STATES.find(s =>
            s.name.toLowerCase() === stateName.toLowerCase() ||
            s.code.toLowerCase() === stateName.toLowerCase()
        );

        setFormData({
            ...formData,
            address: {
                street: `${houseNumber} ${normalizedStreet}`.trim(),
                apartment: formData.address.apartment,
                city: city,
                state: stateMapping?.code || formData.address.state,
                zip: zip.slice(0, 5)
            }
        });
        setSearchSuggestions([]);
    };

    function formatPhoneNumber(text: string) {
        if (!text) return '';
        const cleaned = text.replace(/\D/g, '');
        // If it starts with 1 (country code), remove it for local formatting
        const match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
        if (match) {
            return `(${match[2]}) ${match[3]}-${match[4]}`;
        }
        return text;
    }

    useEffect(() => {
        if (!isLoading && !user) {
            router.replace('/login' as any);
        }
    }, [isLoading, user]);

    if (isLoading || !user) {
        return (
            <View className="flex-1 bg-white justify-center items-center">
                <ActivityIndicator size="large" color="#0047AB" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <ScrollView
                ref={scrollViewRef}
                className="flex-1 px-6 pt-4"
                style={{ backgroundColor: '#F6F8FC' }}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {/* Section Badge */}
                <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                  <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                  <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                    YOUR ACCOUNT
                  </Text>
                </View>

                {/* Title */}
                <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">Personal information</Text>

                {/* Subtitle */}
                <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                  Keep your profile up to date to ensure the best service experience
                </Text>

                {/* Profile Image Section */}
                <View className="items-center mb-8">
                    <TouchableOpacity onPress={pickImage} disabled={isUploadingPhoto} className="relative">
                        <View className="w-24 h-24 bg-gray-100 rounded-full justify-center items-center border border-gray-200 overflow-hidden">
                            {localProfileUri ? (
                                <Image source={{ uri: localProfileUri }} className="w-full h-full" />
                            ) : formData.profileImage ? (
                                <Image source={{ uri: formData.profileImage }} className="w-full h-full" />
                            ) : (
                                <Camera size={32} color="#D1D5DB" />
                            )}
                            {isUploadingPhoto && (
                                <View className="absolute inset-0 bg-black/40 items-center justify-center">
                                    <ActivityIndicator color="#fff" />
                                </View>
                            )}
                        </View>
                        {!isUploadingPhoto && (
                            <View className="absolute bottom-0 right-0 bg-blue-100 p-1.5 rounded-full border border-white">
                                <Text className="text-xs">✏️</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    <Text className="text-gray-500 font-outfit-regular mt-2 text-xs">Tap to change photo</Text>
                </View>

                <View className="gap-4 mb-8">
                    <View>
                        <Text className="font-outfit-medium mb-2 text-gray-900">Name</Text>
                        <Input
                            value={formData.name}
                            editable={false}
                            containerClassName="bg-gray-100 border border-gray-300 rounded-2xl text-gray-500"
                        />
                    </View>

                    <View>
                        <Text className="font-outfit-medium mb-2 text-gray-900">Surname</Text>
                        <Input
                            value={formData.surname}
                            editable={false}
                            containerClassName="bg-gray-100 border border-gray-300 rounded-2xl text-gray-500"
                        />
                    </View>

                    <View>
                        <Text className="font-outfit-medium mb-2 text-gray-900">Email</Text>
                        <Input
                            value={formData.email}
                            onChangeText={(t) => setFormData({ ...formData, email: t })}
                            containerClassName="bg-white border border-gray-300 rounded-2xl"
                            keyboardType="email-address"
                        />
                    </View>

                    <View>
                        <Text className="font-outfit-medium mb-2 text-gray-900">Phone number</Text>
                        <Input
                            value={formData.phone}
                            editable={false}
                            containerClassName="bg-gray-100 border border-gray-300 rounded-2xl text-gray-500"
                        />
                    </View>

                    <View>
                        <Text className="font-outfit-medium mb-2 text-gray-900">Date of birth</Text>
                        <Input
                            value={formData.dob}
                            onChangeText={(t) => setFormData({ ...formData, dob: t })}
                            containerClassName="bg-gray-100 border border-gray-300 rounded-2xl text-gray-500"
                            keyboardType="number-pad"
                            editable={false}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    onPress={handleUpdate}
                    activeOpacity={0.8}
                    className="mb-10"
                >
                    <LinearGradient
                        colors={['#2B66F8', '#081E72']}
                        start={{ x: 0, y: 1 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                            borderRadius: 10,
                            paddingVertical: 16,
                            paddingHorizontal: 16,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Text className="text-white font-outfit-semibold text-lg text-center">Update Profile</Text>
                    </LinearGradient>
                </TouchableOpacity>

                {/* State Selection Modal */}
                <Modal
                    visible={showStateModal}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowStateModal(false)}
                >
                    <View className="flex-1 bg-black/50 justify-end">
                        <View className="bg-white rounded-t-3xl h-2/3">
                            <View className="p-6 border-b border-gray-100 flex-row justify-between items-center">
                                <Text className="text-xl font-outfit-bold text-blue-900">Select State</Text>
                                <TouchableOpacity onPress={() => setShowStateModal(false)}>
                                    <Text className="text-blue-600 font-outfit-bold">Done</Text>
                                </TouchableOpacity>
                            </View>
                            <FlatList
                                data={US_STATES}
                                keyExtractor={(item) => item.code}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        className={`px-6 py-4 border-b border-gray-50 flex-row justify-between items-center ${formData.address.state === item.code ? 'bg-blue-50' : ''}`}
                                        onPress={() => {
                                            setFormData({ ...formData, address: { ...formData.address, state: item.code } });
                                            setShowStateModal(false);
                                        }}
                                    >
                                        <Text className={`text-base font-outfit-medium ${formData.address.state === item.code ? 'text-blue-900' : 'text-gray-800'}`}>
                                            {item.name}
                                        </Text>
                                        <Text className="text-sm font-outfit-bold text-blue-600">{item.code}</Text>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </View>
                </Modal>

                <Modal
                    visible={showSuccessModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowSuccessModal(false)}
                >
                    <View className="flex-1 bg-black/50 justify-center items-center px-6">
                        <View className="bg-white w-full rounded-2xl p-8 items-center">
                            <View className="w-20 h-20 bg-blue-50 rounded-full items-center justify-center mb-6">
                                <CheckCircle2 size={48} color="#0047AB" />
                            </View>
                            <Text className="text-xl font-outfit-bold text-blue-900 mb-2 text-center">
                                Success!
                            </Text>
                            <Text className="text-gray-500 font-outfit-regular text-center mb-8">
                                Information was updated
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowSuccessModal(false)}
                                activeOpacity={0.8}
                                className="w-full"
                            >
                                <LinearGradient
                                    colors={['#2B66F8', '#081E72']}
                                    start={{ x: 0, y: 1 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{
                                        borderRadius: 10,
                                        paddingVertical: 16,
                                        paddingHorizontal: 16,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Text className="text-white font-outfit-bold text-center">Close</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
