import { useUser } from '@/context/UserContext';
import { ApiError } from '@/lib/api/types';
import { clearSession, getSessionUserId } from '@/lib/auth/session';
import type { AppRole } from '@/lib/dao/interfaces';
import { userDAO } from '@/lib/dao/UserDAO';
import { AddRoleState, getAddRoleState, holdsRole, prefillForAddRole } from '@/lib/setup-add-role';
import { clearSetupProgress, getSetupProgress, saveSetupProgress } from '@/lib/storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { alertOpenWork, blockedMessage, blockingJobOf } from '@/lib/roles/roleSwitchMessages';
import { Image, type ImageSourcePropType, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SETUP_BG, SETUP_GRADIENT, SetupFooter, SetupHeading } from '@/components/setup/SetupKit';
import { BUTTON_RADIUS } from '@/lib/ui/floatingFooter';
import { TYPE } from '@/lib/ui/type';
import { LinearGradient } from 'expo-linear-gradient';

interface RoleConfig {
    icon: string;
    stats: { value: string; label: string }[];
    gradientColors: [string, string];
    /** A photo of the role's world, barely showing behind the card. */
    photo: ImageSourcePropType;
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
        photo: require('@/assets/images/role_tech_bg.jpg'),
    },
    user: {
        icon: 'car',
        stats: [
            { value: '8 min', label: 'AVG RESPONSE' },
            { value: '24/7', label: 'COVERAGE' },
            { value: '2.5km', label: 'NEAREST HELP' },
        ],
        gradientColors: ['#1F86EE', '#07397A'],
        photo: require('@/assets/images/role_owner_bg.jpg'),
    },
};

export default function RoleSelectionScreen() {
    const router = useRouter();
    const { t, i18n } = useTranslation();
    const { adoptSession } = useUser();
    const [selectedRole, setSelectedRole] = useState<'mechanic' | 'user'>('mechanic');
    const config = roleConfigs[selectedRole];
    // Set when the verified phone already had an account (see lib/setup-add-role.ts).
    const [addRole, setAddRole] = useState<AddRoleState | null>(null);
    const [isBusy, setIsBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // The two role cards sit side by side in a paged strip: swiping moves between them and the toggle above follows (and the other way round).
    const { width } = useWindowDimensions();
    const strip = useRef<ScrollView>(null);
    const goTo = (role: 'mechanic' | 'user', animated = true) => {
        setSelectedRole(role);
        strip.current?.scrollTo({ x: role === 'mechanic' ? 0 : width, animated });
    };
    // A role preselected after loading the account (add-role) puts the strip on its card.
    useEffect(() => {
        strip.current?.scrollTo({ x: selectedRole === 'mechanic' ? 0 : width, animated: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [addRole]);
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
                const switched =
                    role !== state.primaryRole ? await userDAO.switchActiveRole(role) : undefined;
                const userId = state.userId ?? (await getSessionUserId());
                const account = userId ? await userDAO.getById(userId) : null;
                if (!account) throw new Error('Account profile could not be loaded');
                await clearSetupProgress();
                await adoptSession({ ...account, role });
                router.replace('/(tabs)/dashboard');
                alertOpenWork(switched?.openWork, t, i18n.language);
                return false;
            }
            await prefillForAddRole(role);
            return true;
        } catch (err) {
            if (err instanceof ApiError && err.statusCode === 409) {
                setError(
                    blockingJobOf(err)
                        ? blockedMessage(err, t)
                        : t('setup.addRole.activeJobs', { role: roleLabel(state.primaryRole) }),
                );
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
        router.replace('/onboarding');
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

    const label = addRole
        ? t(alreadyHeld ? 'setup.addRole.signInAs' : 'setup.addRole.addRoleAs', { role: roleLabel(selectedRole) })
        : roleText.buttonText;

    return (
        <View className="flex-1" style={{ backgroundColor: SETUP_BG }}>
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingTop: 18, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
                <SetupHeading screen="role" badge={t('setup.roleSelection.badge')} title={t('setup.roleSelection.choosePath')} subtitle={t('setup.roleSelection.subtitle')}>
                    {/* Existing account notice */}
                    {addRole && (
                        <View style={{ marginTop: 18, padding: 16, borderRadius: 16, backgroundColor: '#F4F8FF', borderWidth: 1, borderColor: '#E1EAFB' }}>
                            <Text className="font-outfit-semibold" style={{ ...TYPE.eyebrow, color: '#1E56E3', marginBottom: 4 }}>{t('setup.addRole.badge').toUpperCase()}</Text>
                            <Text className="font-outfit-bold" style={{ ...TYPE.cardTitle, color: '#0B1530', marginBottom: 4 }}>{t('setup.addRole.title')}</Text>
                            <Text className="font-outfit-regular" style={{ ...TYPE.helper, color: '#6B7490' }}>
                                {t('setup.addRole.message', {
                                    roles: addRole.roles.filter((r) => r === 'user' || r === 'mechanic').map(roleLabel).join(', '),
                                })}
                            </Text>
                        </View>
                    )}
                </SetupHeading>

                {/* Role toggle: a soft slate track and the chosen role on the blue gradient, same radius as every button. */}
                <View className="flex-row" style={{ gap: 6, padding: 6, borderRadius: 18, backgroundColor: '#E6EAF2' }}>
                    {(['mechanic', 'user'] as const).map((role) => {
                        const on = selectedRole === role;
                        return (
                            <TouchableOpacity key={role} onPress={() => goTo(role)} activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ selected: on }} className="flex-1" testID={`role-${role}`}>
                                <LinearGradient
                                    colors={on ? [...SETUP_GRADIENT] : ['transparent', 'transparent']}
                                    start={{ x: 0, y: 1 }}
                                    end={{ x: 1, y: 0 }}
                                    style={{ minHeight: 48, borderRadius: BUTTON_RADIUS, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}
                                >
                                    {/* One line on every screen: on a small one the text shrinks a little instead of wrapping ("Vehicle Owner" split in two). */}
                                    <Text className="font-outfit-bold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ ...TYPE.body, color: on ? '#FFFFFF' : '#4A5470' }}>
                                        {t(role === 'mechanic' ? 'setup.roleSelection.technician' : 'setup.roleSelection.vehicleOwner')}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* What each role is: two tall cards in a paged strip (swipe between them), each in its own shade of blue so they read as different. */}
                <ScrollView
                    ref={strip}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    decelerationRate="fast"
                    onMomentumScrollEnd={(e) => setSelectedRole(e.nativeEvent.contentOffset.x > width / 2 ? 'user' : 'mechanic')}
                    style={{ marginHorizontal: -20, marginTop: 18 }}
                    testID="role-strip"
                >
                    {(['mechanic', 'user'] as const).map((role) => {
                        const text = {
                            title: t(`setup.roleSelection.${role}.title`),
                            description: t(`setup.roleSelection.${role}.description`),
                            highlights: t(`setup.roleSelection.${role}.highlights`, { returnObjects: true }) as string[],
                        };
                        return (
                            <View key={role} style={{ width, paddingHorizontal: 20 }}>
                                <View style={{ borderRadius: 22, overflow: 'hidden', minHeight: 440 }}>
                                    {/* The role's colour, a photo of its world barely showing through, and a deeper tint at the bottom where the words are. */}
                                    <LinearGradient colors={roleConfigs[role].gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                                    <Image source={roleConfigs[role].photo} resizeMode="cover" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%', opacity: 0.2 }} />
                                    <LinearGradient colors={['rgba(8,30,114,0)', roleConfigs[role].gradientColors[1]]} start={{ x: 0, y: 0.2 }} end={{ x: 0, y: 1 }} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
                                    <View style={{ flex: 1, padding: 24, minHeight: 440, justifyContent: 'space-between' }}>
                                        <View>
                                            {addRole && holdsRole(addRole, role) && (
                                                <View className="self-start" style={{ marginBottom: 14, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' }}>
                                                    <Text className="text-white font-outfit-bold" style={TYPE.eyebrow}>{t('setup.addRole.alreadyYours').toUpperCase()}</Text>
                                                </View>
                                            )}
                                            <View className="items-center justify-center" style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)' }}>
                                                <Ionicons name={roleConfigs[role].icon as ComponentProps<typeof Ionicons>['name']} size={36} color="white" />
                                            </View>
                                        </View>
                                        <View>
                                            <Text className="text-white font-outfit-bold" style={{ fontSize: 28, lineHeight: 34, letterSpacing: -0.6, marginBottom: 12 }}>{text.title}</Text>
                                            <Text className="font-outfit-regular" style={{ ...TYPE.body, color: 'rgba(255,255,255,0.88)', marginBottom: 20 }}>{text.description}</Text>
                                            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                                                {text.highlights.map((highlight, idx) => (
                                                    <View key={idx} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' }}>
                                                        <Text className="text-white font-outfit-semibold" style={TYPE.caption}>{highlight}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </ScrollView>

                {error ? <Text className="font-outfit-medium text-center" style={{ ...TYPE.helper, color: '#DC2626', marginTop: 16 }}>{error}</Text> : null}
            </ScrollView>

            <SetupFooter
                label={label}
                onPress={handleContinue}
                loading={isBusy}
                secondaryLabel={addRole ? t('setup.addRole.cancel') : undefined}
                onSecondary={addRole ? handleCancelAddRole : undefined}
                secondaryDisabled={isBusy}
                testID="role-continue"
            />
        </View>
    );
}
