import { Input } from '@/components/ui/Input';
import { useRequestDraft } from '@/context/RequestDraftContext';
import { useUser } from '@/context/UserContext';
import { vehicleDAO } from '@/lib/dao/VehicleDAO';
import { Vehicle } from '@/lib/dao/interfaces';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Car, ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

/** Two sub-steps on one route: pick a vehicle, then fill in the details for that vehicle. */
type Step = 'select' | 'details';

/** Strips the grouping separators the placeholder suggests ("45,230") before parsing. */
const parseMileage = (raw: string): number | undefined => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits === '') return undefined;
    const value = Number(digits);
    return Number.isFinite(value) ? value : undefined;
};

export default function SelectVehicleScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { type } = params; // 'immediate', 'scheduled', 'videocall'
    const { user } = useUser();
    const { setVehicleDetails } = useRequestDraft();

    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [step, setStep] = useState<Step>('select');
    const [selected, setSelected] = useState<Vehicle | null>(null);
    const [mileage, setMileage] = useState('');
    const [isOwner, setIsOwner] = useState(true);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');

    useEffect(() => {
        if (user?.id) {
            loadVehicles();
        }
    }, [user?.id]);

    const loadVehicles = async () => {
        if (!user?.id) return;
        setIsLoading(true);
        try {
            const data = await vehicleDAO.getByUser(user.id);
            setVehicles(data);
        } catch (error) {
            console.error('Failed to load vehicles', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectVehicle = (vehicle: Vehicle) => {
        setSelected(vehicle);
        // Pre-fill with the last known reading so the driver only edits it when it changed.
        setMileage(vehicle.mileage != null ? String(vehicle.mileage) : '');
        setStep('details');
    };

    const handleBack = () => {
        if (step === 'details') {
            setStep('select');
            return;
        }
        router.back();
    };

    // When the account holder is the one in the vehicle their account details apply, so
    // the name/phone fields stay empty and must not gate the button.
    const canContinue = isOwner || (!!firstName.trim() && !!lastName.trim() && !!phone.trim());

    const handleContinue = () => {
        if (!selected || !canContinue) return;

        const parsedMileage = parseMileage(mileage);

        setVehicleDetails({
            mileage: parsedMileage,
            driverIsOwner: isOwner,
            driverFirstName: isOwner ? '' : firstName.trim(),
            driverLastName: isOwner ? '' : lastName.trim(),
            driverPhone: isOwner ? '' : phone.trim(),
        });

        // Keep the vehicle's last known reading current. Fire-and-forget: the request
        // itself carries the snapshot, so a failed PATCH must not block the flow.
        if (selected.id && parsedMileage !== undefined && parsedMileage !== selected.mileage) {
            vehicleDAO
                .update(selected.id, { mileage: parsedMileage })
                .catch(error => console.error('Failed to update vehicle mileage', error));
        }

        router.push({
            pathname: '/request-assistance/issue-selection',
            params: {
                type,
                vehicleId: selected.id,
                vehicleName: `${selected.make} ${selected.model}`,
            },
        });
    };

    const getTitle = () => {
        switch (type) {
            case 'immediate': return t('requestAssistance.header.immediate');
            case 'scheduled': return t('requestAssistance.header.scheduled');
            case 'videocall': return t('requestAssistance.header.videoCall');
            case 'witness': return t('requestAssistance.header.accident');
            default: return t('requestAssistance.header.default');
        }
    };

    const renderBadge = (label: string) => (
        <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
            <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">{label}</Text>
        </View>
    );

    const renderFieldLabel = (label: string) => (
        <Text className="text-gray-500 font-outfit-semibold text-xs tracking-widest mb-2">{label}</Text>
    );

    return (
        <View className="flex-1" style={{ backgroundColor: '#F4F6FC' }}>
            {/* Custom Header */}
            <View className="px-6 pt-20 pb-2 flex-row items-center justify-between" style={{ backgroundColor: '#F4F5FA', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 3, elevation: 3, borderBottomWidth: 0.5, borderBottomColor: '#D1D5DB' }}>
                <TouchableOpacity onPress={handleBack}>
                    <View className="w-10 h-10 rounded-full justify-center items-center" style={{ backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }}>
                        <ChevronLeft size={20} color="#0047AB" />
                    </View>
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Outfit_500Medium', fontSize: 18, color: '#1A1A1A', flex: 1, textAlign: 'center' }}>
                    {getTitle()}
                </Text>
                <View className="w-6" />
            </View>

            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView className="flex-1 px-6 pt-6" keyboardShouldPersistTaps="handled">
                    {step === 'select' ? (
                        <>
                            {renderBadge(t('requestAssistance.selectVehicle.badge'))}

                            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('requestAssistance.selectVehicle.title')}</Text>

                            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                                {t('requestAssistance.selectVehicle.subtitle')}
                            </Text>

                            {isLoading ? (
                                <ActivityIndicator size="large" color="#0047AB" className="mt-8" />
                            ) : vehicles.length === 0 ? (
                                <Text className="text-center text-gray-500 font-outfit-regular my-4">{t('requestAssistance.selectVehicle.noVehicles')}</Text>
                            ) : (
                                vehicles.map((vehicle) => {
                                    const isSelected = selected?.id === vehicle.id;
                                    return (
                                        <TouchableOpacity
                                            key={vehicle.id}
                                            onPress={() => handleSelectVehicle(vehicle)}
                                            activeOpacity={0.8}
                                            className="rounded-xl p-4 mb-4 flex-row items-center justify-between"
                                            style={{
                                                backgroundColor: isSelected ? '#F4F8FF' : '#FFFFFF',
                                                borderWidth: 1,
                                                borderColor: isSelected ? '#0047AB' : '#E5E7EB',
                                                shadowColor: '#000',
                                                shadowOffset: { width: 0, height: 4 },
                                                shadowOpacity: 0.12,
                                                shadowRadius: 8,
                                                elevation: 6,
                                            }}
                                        >
                                            <View className="flex-row items-center flex-1">
                                                <View className="w-10 h-10 bg-blue-50 rounded-full justify-center items-center mr-4">
                                                    <Car size={20} color="#0047AB" />
                                                </View>
                                                <View className="flex-1">
                                                    <Text className="font-outfit-bold text-[#0F172A] text-base uppercase">
                                                        {vehicle.make} {vehicle.model}
                                                    </Text>
                                                    <Text className="font-outfit-medium text-blue-500 text-xs tracking-widest uppercase">
                                                        {vehicle.plate || t('requestAssistance.selectVehicle.noPlate')}
                                                    </Text>
                                                </View>
                                            </View>
                                            <ChevronRight size={20} color="#0047AB" />
                                        </TouchableOpacity>
                                    );
                                })
                            )}

                            {/* Outside the loading branch: the user can add a vehicle before the list resolves. */}
                            {!isLoading && (
                                <TouchableOpacity
                                    onPress={() => router.push('/(tabs)/vehicles')}
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
                                            marginTop: 32,
                                            marginBottom: 32,
                                        }}
                                    >
                                        <Plus size={20} color="#FFFFFF" />
                                        <Text className="font-outfit-bold text-white ml-2">{t('requestAssistance.selectVehicle.addVehicle')}</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            )}
                        </>
                    ) : (
                        <>
                            {renderBadge(t('requestAssistance.vehicleDetails.badge'))}

                            <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('requestAssistance.vehicleDetails.title')}</Text>

                            <Text className="text-gray-500 font-outfit-regular text-base mb-8">
                                {t('requestAssistance.vehicleDetails.subtitle')}
                            </Text>

                            {/* Selected vehicle recap */}
                            <View
                                className="rounded-xl p-4 mb-6 flex-row items-center"
                                style={{
                                    backgroundColor: '#FFFFFF',
                                    borderWidth: 1,
                                    borderColor: '#E5E7EB',
                                    shadowColor: '#000',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.12,
                                    shadowRadius: 8,
                                    elevation: 6,
                                }}
                            >
                                <View className="w-10 h-10 bg-blue-50 rounded-full justify-center items-center mr-4">
                                    <Car size={20} color="#0047AB" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-gray-400 font-outfit-semibold text-xs tracking-widest mb-0.5">
                                        {t('requestAssistance.vehicleDetails.selectedVehicle')}
                                    </Text>
                                    <Text className="font-outfit-bold text-[#0F172A] text-base uppercase">
                                        {selected?.make} {selected?.model}
                                    </Text>
                                    <Text className="font-outfit-medium text-blue-500 text-xs tracking-widest uppercase">
                                        {selected?.plate || t('requestAssistance.selectVehicle.noPlate')}
                                    </Text>
                                </View>
                            </View>

                            {/* Mileage */}
                            <View className="mb-6">
                                {renderFieldLabel(t('requestAssistance.vehicleDetails.mileageLabel'))}
                                <Input
                                    containerClassName="border border-gray-200"
                                    keyboardType="number-pad"
                                    placeholder={t('requestAssistance.vehicleDetails.mileagePlaceholder')}
                                    value={mileage}
                                    onChangeText={setMileage}
                                />
                            </View>

                            {/* Who is in the vehicle */}
                            <View className="p-4 rounded-2xl mb-6" style={{ backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#E1EAFB' }}>
                                <Text className="font-outfit-semibold text-[#0F172A] text-sm mb-3">
                                    {t('requestAssistance.vehicleDetails.whoIsInVehicle')}
                                </Text>
                                <View className="flex-row gap-3">
                                    {[true, false].map((ownerOption) => {
                                        const isActive = isOwner === ownerOption;
                                        return (
                                            <TouchableOpacity
                                                key={String(ownerOption)}
                                                onPress={() => setIsOwner(ownerOption)}
                                                activeOpacity={0.8}
                                                className="flex-1 rounded-lg items-center justify-center"
                                                style={{
                                                    paddingVertical: 12,
                                                    backgroundColor: isActive ? '#0047AB' : '#FFFFFF',
                                                    borderWidth: 1,
                                                    borderColor: isActive ? '#0047AB' : '#E5E7EB',
                                                }}
                                            >
                                                <Text
                                                    className="font-outfit-bold text-xs"
                                                    style={{ color: isActive ? '#FFFFFF' : '#0F172A' }}
                                                >
                                                    {ownerOption
                                                        ? t('requestAssistance.vehicleDetails.iAm')
                                                        : t('requestAssistance.vehicleDetails.someoneElse')}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <Text className="text-gray-500 font-outfit-regular text-xs mt-3">
                                    {isOwner
                                        ? t('requestAssistance.vehicleDetails.hintOwner')
                                        : t('requestAssistance.vehicleDetails.hintOther')}
                                </Text>
                            </View>

                            {/* Driver contact — only when it is not the account holder */}
                            {!isOwner && (
                                <>
                                    <View className="flex-row gap-3 mb-6">
                                        <View className="flex-1">
                                            {renderFieldLabel(t('requestAssistance.vehicleDetails.firstName'))}
                                            <Input
                                                containerClassName="border border-gray-200"
                                                placeholder={t('requestAssistance.vehicleDetails.firstNamePlaceholder')}
                                                value={firstName}
                                                onChangeText={setFirstName}
                                            />
                                        </View>
                                        <View className="flex-1">
                                            {renderFieldLabel(t('requestAssistance.vehicleDetails.lastName'))}
                                            <Input
                                                containerClassName="border border-gray-200"
                                                placeholder={t('requestAssistance.vehicleDetails.lastNamePlaceholder')}
                                                value={lastName}
                                                onChangeText={setLastName}
                                            />
                                        </View>
                                    </View>

                                    <View className="mb-6">
                                        {renderFieldLabel(t('requestAssistance.vehicleDetails.phone'))}
                                        <Input
                                            containerClassName="border border-gray-200"
                                            keyboardType="phone-pad"
                                            placeholder={t('requestAssistance.vehicleDetails.phonePlaceholder')}
                                            value={phone}
                                            onChangeText={setPhone}
                                        />
                                    </View>
                                </>
                            )}

                            <View className="h-8" />
                        </>
                    )}
                </ScrollView>

                {/* Fixed footer, only on the details sub-step (matches the reference design) */}
                {step === 'details' && (
                    <View className="px-6 pt-4 pb-8" style={{ borderTopWidth: 0.5, borderTopColor: '#D1D5DB', backgroundColor: '#F4F6FC' }}>
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
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Text className="text-white font-outfit-bold text-center">
                                    {t('requestAssistance.continue')}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}
            </KeyboardAvoidingView>
        </View>
    );
}
