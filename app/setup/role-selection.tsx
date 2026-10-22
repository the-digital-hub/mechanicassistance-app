import { useUser } from '@/context/UserContext';
import { ApiError } from '@/lib/api/types';
import { clearSession, getSessionUserId } from '@/lib/auth/session';
import type { AppRole } from '@/lib/dao/interfaces';
import { userDAO } from '@/lib/dao/UserDAO';
import { AddRoleState, getAddRoleState, holdsRole, prefillForAddRole } from '@/lib/setup-add-role';
import { clearSetupProgress, getSetupProgress, saveSetupProgress } from '@/lib/storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface RoleConfig {
    icon: string;
    stats: { value: string; label: string }[];
    gradientColors: [string, string];
}

const roleConfigs: Record<'mechanic' | 'user', RoleConfig> = {
    mechanic: {
        icon: 'settings',
        stats: [
            { value: '$840', label: 'AVG WEEKLY' },
            { value: '4.9★', label: 'PRO RATING' },
            { value: '12 mi', label: 'RADIUS' },
        ],
        gradientColors: ['#2B66F8', '#081E72'],
    },
    user: {
        icon: 'car',
        stats: [
            { value: '8 min', label: 'AVG RESPONSE' },
            { value: '24/7', label: 'COVERAGE' },
            { value: '2.5km', label: 'NEAREST HELP' },
        ],
        gradientColors: ['#4B7BA7', '#2D4F6F'],
    },
};

export default function RoleSelectionScreen() {
    const router = useRouter();
    const { t } = useTranslation();
    const { adoptSession } = useUser();
    const [selectedRole, setSelectedRole] = useState<'mechanic' | 'user'>('mechanic');
    const config = roleConfigs[selectedRole];
    // Set when the verified phone already had an account (see lib/setup-add-role.ts).
    const [addRole, setAddRole] = useState<AddRoleState | null>(null);
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const alreadyHeld = !!addRole && holdsRole(addRole, selectedRole);

    useEffect(() => {
        getSetupProgress().then((progress) => {
            const state = getAddRoleState(progress);
            setAddRole(state);
            // Preselect the role the account does not have yet: adding it is
            // the likelier reason to be signing up again.
            const missing = state && (['mechanic', 'user'] as const).find((role) => !holdsRole(state, role));
            if (missing) setSelectedRole(missing);
        });
    }, []);

    const roleLabel = (role: string) =>
        t(role === 'mechanic' ? 'setup.addRole.roleMechanic' : 'setup.addRole.roleUser');
    const roleText = {
        title: t(`setup.roleSelection.${selectedRole}.title`),
        description: t(`setup.roleSelection.${selectedRole}.description`),
        highlights: t(`setup.roleSelection.${selectedRole}.highlights`, { returnObjects: true }) as string[],
        buttonText: t(`setup.roleSelection.${selectedRole}.buttonText`),
    };

    /**
     * Add-role variant. A role the account already holds signs straight in
     * with it active; a new one pre-fills the wizard from the account and
     * carries on. Returns false when the wizard should not continue.
     */
    const continueAddRole = async (state: AddRoleState, role: AppRole): Promise<boolean> => {
        setIsBusy(true);
        setError(null);
        try {
            if (holdsRole(state, role)) {
                if (role !== state.primaryRole) await userDAO.switchActiveRole(role);
                const userId = state.userId ?? (await getSessionUserId());
                const account = userId ? await userDAO.getById(userId) : null;
                if (!account) throw new Error('Account profile could not be loaded');
                await clearSetupProgress();
                await adoptSession({ ...account, role });
                router.replace('/(tabs)/dashboard');
                return false;
            }
            await prefillForAddRole(role);
            return true;
        } catch (err) {
            if (err instanceof ApiError && err.statusCode === 409) {
                setError(t('setup.addRole.activeJobs', { role: roleLabel(state.primaryRole) }));
            } else {
                setError(t(holdsRole(state, role) ? 'setup.addRole.signInFailed' : 'setup.addRole.loadFailed'));
            }
            return false;
        } finally {
            setIsBusy(false);
        }
    };

    /** Abandons the add-role run: the verify step's session is ended, not adopted. */
    const handleCancelAddRole = async () => {
        await userDAO.logout();
        await clearSession();
        await clearSetupProgress();
        router.replace('/login');
    };

    const handleContinue = async () => {
        if (isBusy) return;
        try {
            if (addRole && !(await continueAddRole(addRole, selectedRole))) return;
            await saveSetupProgress('role', { role: selectedRole });
            router.push('/setup/basic-info');
        } catch (error) {
            console.error('RoleSelection: Error in handleContinue:', error);
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: '#F6F8FC' }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Header Section */}
                <View className="px-6 pt-6 pb-8">
                    {/* Section Badge */}
                    <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
                        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
                        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
                            {t('setup.roleSelection.badge')}
                        </Text>
                    </View>

                    {/* Title */}
                    <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
                        {t('setup.roleSelection.choosePath')}
                    </Text>

                    {/* Subtitle */}
                    <Text className="text-gray-500 font-outfit-regular text-base mb-0">
                        {t('setup.roleSelection.subtitle')}
                    </Text>

                    {/* Existing account notice */}
                    {addRole && (
                        <View className="mt-6 p-4 rounded-2xl" style={{ backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#E1EAFB' }}>
                            <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest mb-1">
                                {t('setup.addRole.badge')}
                            </Text>
                            <Text className="text-gray-900 font-outfit-semibold text-base mb-1">
                                {t('setup.addRole.title')}
                            </Text>
                            <Text className="text-gray-600 font-outfit-regular text-sm">
                                {t('setup.addRole.message', {
                                    roles: addRole.roles.filter((r) => r === 'user' || r === 'mechanic').map(roleLabel).join(', '),
                                })}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Role Toggle */}
                <View className="px-6 pb-6">
                    <View className="flex-row gap-3 p-1.5 rounded-2xl" style={{ backgroundColor: '#E5E7EB' }}>
                        <TouchableOpacity
                            onPress={() => setSelectedRole('mechanic')}
                            activeOpacity={0.8}
                            className="flex-1"
                        >
                            <LinearGradient
                                colors={selectedRole === 'mechanic' ? ['#2B66F8', '#081E72'] : ['transparent', 'transparent']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{
                                    paddingVertical: 12,
                                    paddingHorizontal: 16,
                                    borderRadius: 10,
                                }}
                            >
                                <Text className={`text-center font-outfit-semibold ${selectedRole === 'mechanic' ? 'text-white' : 'text-slate-600'}`}>
                                    {t('setup.roleSelection.technician')}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setSelectedRole('user')}
                            activeOpacity={0.8}
                            className="flex-1"
                        >
                            <LinearGradient
                                colors={selectedRole === 'user' ? ['#4B7BA7', '#2D4F6F'] : ['transparent', 'transparent']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{
                                    paddingVertical: 12,
                                    paddingHorizontal: 16,
                                    borderRadius: 10,
                                }}
                            >
                                <Text className={`text-center font-outfit-semibold ${selectedRole === 'user' ? 'text-white' : 'text-slate-600'}`}>
                                    {t('setup.roleSelection.vehicleOwner')}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Main Card */}
                <View className="px-6">
                    <LinearGradient
                        colors={config.gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                            borderRadius: 16,
                            padding: 24,
                            marginBottom: 24,
                        }}
                    >
                        {alreadyHeld && (
                            <View className="px-2.5 py-1 rounded-md mb-4" style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' }}>
                                <Text className="text-white font-outfit-bold text-[10px] tracking-widest">
                                    {t('setup.addRole.alreadyYours')}
                                </Text>
                            </View>
                        )}

                        {/* Icon */}
                        <View className="w-20 h-20 rounded-2xl items-center justify-center mb-6" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' }}>
                            <Ionicons name={config.icon} size={40} color="white" />
                        </View>

                        {/* Title */}
                        <Text className="text-white font-outfit-bold text-3xl mb-4 leading-tight">
                            {roleText.title}
                        </Text>

                        {/* Description */}
                        <Text className="text-white font-outfit-regular text-base mb-8 leading-relaxed opacity-90">
                            {roleText.description}
                        </Text>

                        {/* Highlights */}
                        <View className="flex-row flex-wrap gap-2 mb-8">
                            {roleText.highlights.map((highlight, idx) => (
                                <View key={idx} className="px-3 py-2 rounded-full" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)' }}>
                                    <Text className="text-white font-outfit-medium text-xs">
                                        {highlight}
                                    </Text>
                                </View>
                            ))}
                        </View>

                    </LinearGradient>
                </View>

                {error && (
                    <Text className="px-6 mb-4 text-red-500 font-outfit-medium text-sm text-center">
                        {error}
                    </Text>
                )}

                {/* Continue Button */}
                <TouchableOpacity
                    onPress={handleContinue}
                    disabled={isBusy}
                    activeOpacity={0.8}
                    className="px-6"
                    style={{ opacity: isBusy ? 0.6 : 1 }}
                >
                    <LinearGradient
                        colors={config.gradientColors}
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
                        {isBusy ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Text className="text-white font-outfit-bold text-center mr-2">
                                    {addRole
                                        ? t(alreadyHeld ? 'setup.addRole.signInAs' : 'setup.addRole.addRoleAs', { role: roleLabel(selectedRole) })
                                        : roleText.buttonText}
                                </Text>
                                <ChevronRight size={20} color="white" />
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                {addRole && (
                    <TouchableOpacity onPress={handleCancelAddRole} disabled={isBusy} className="mt-5 items-center">
                        <Text className="text-gray-500 font-outfit-medium text-sm">
                            {t('setup.addRole.cancel')}
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}
