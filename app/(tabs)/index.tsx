import { SwitchRoleSheet } from '@/components/profile/SwitchRoleSheet';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { AseStatusBadge } from '@/components/ui/AseStatusBadge';
import { VerificationBadge } from '@/components/ui/VerificationBadge';
import { useUser } from '@/context/UserContext';
import { useAppointments } from '@/context/AppointmentsContext';
import { useMechanicStatus } from '@/context/MechanicStatusContext';
import { Stars } from '@/components/offer/OfferSections';
import { ReviewsSheet } from '@/components/profile/ReviewsSheet';
import { useProfileReviews } from '@/hooks/useProfileReviews';
import { ApiError } from '@/lib/api/types';
import { appointmentDAO } from '@/lib/dao/AppointmentDAO';
import type { MechanicStats } from '@/lib/dao/interfaces';
import type { AddableRole, AppRole } from '@/lib/dao/interfaces';
import { addressDAO } from '@/lib/dao/AddressDAO';
import { mediaDAO } from '@/lib/dao/MediaDAO';
import { vehicleDAO } from '@/lib/dao/VehicleDAO';
import { setAppLanguage } from '@/lib/i18n';
import { startAddRoleFromProfile } from '@/lib/setup-add-role';
import { installedVersionLabel } from '@/lib/appVersion';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeftRight, Award, BadgeCheck, Briefcase, Camera, Car, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, Clock, CreditCard, FileText, Heart, HelpCircle, Lock, LogOut, MapPin, Settings, User, Wallet } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { appAlert } from '@/lib/ui/appAlert';
import { alertOpenWork, alertRoleSwitchBlocked } from '@/lib/roles/roleSwitchMessages';
import { MechanicStatusSheet } from '@/components/profile/MechanicStatusSheet';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, isLoading, updateUser, logout, switchRole } = useUser();
  const { mechanicStatus, setMechanicStatus, isUpdatingStatus } = useMechanicStatus();
  const { t, i18n } = useTranslation();

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  // Technician menu groups that are currently open (Account, Professional profile).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [localProfileUri, setLocalProfileUri] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showRoleSheet, setShowRoleSheet] = useState(false);
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The rating under the name; a failed load simply shows nothing.
  const isTechnician = user?.role === 'mechanic';
  const [ratingStats, setRatingStats] = useState<MechanicStats | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!isTechnician) return;
      appointmentDAO.getMyStats().then(setRatingStats).catch(() => undefined);
    }, [isTechnician]),
  );
  // How many addresses/vehicles the user has, so the menu speaks in singular when there is one.
  const [counts, setCounts] = useState<{ addresses: number | null; vehicles: number | null }>({ addresses: null, vehicles: null });
  const userId = user?.id;
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      addressDAO.getByUser(userId).then((l) => setCounts((c) => ({ ...c, addresses: l.length }))).catch(() => undefined);
      if (!isTechnician) vehicleDAO.getByUser(userId).then((l) => setCounts((c) => ({ ...c, vehicles: l.length }))).catch(() => undefined);
    }, [userId, isTechnician]),
  );
  // A vehicle owner has no stats endpoint: their rating is what technicians gave them
  // on each job (`clientRating`), averaged over the appointments already loaded.
  const { appointments } = useAppointments();
  const ownerRating = useMemo<MechanicStats | null>(() => {
    if (isTechnician) return null;
    const given = appointments
      .map((a) => Number(a.clientRating))
      .filter((r) => Number.isFinite(r) && r > 0);
    const avg = given.length ? Math.round((given.reduce((sum, r) => sum + r, 0) / given.length) * 10) / 10 : null;
    return { avgRating: avg, ratingCount: given.length, completedCount: 0 };
  }, [appointments, isTechnician]);
  const profileRating = isTechnician ? ratingStats : ownerRating;
  // Tapping the stars opens the ratings behind them, with dates and comments.
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const profileReviews = useProfileReviews(reviewsOpen);

  const currentRole: AppRole = user?.role === 'mechanic' ? 'mechanic' : 'user';
  const roleName = (role: AddableRole) => t(`profile.switchRole.roles.${role}.label`);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

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
      await updateUser({ profileImage: uploaded.url });
    } catch {
      appAlert(t('profile.modals.uploadFailedTitle'), t('profile.modals.uploadFailedMessage'));
      setLocalProfileUri(null);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/onboarding');
    }
  }, [isLoading, user, router]);

  const changeStatus = async (status: 'available' | 'busy' | 'offline') => {
    if (status === mechanicStatus || isUpdatingStatus) return;

    try {
      await setMechanicStatus(status);
    } catch {
      appAlert('Update Failed', 'Could not change your availability. Please try again.');
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setShowLogoutModal(false);
      setIsLoggingOut(false);
      router.replace('/onboarding');
    }
  };

  // A held role is switched to; one the account lacks opens its sign-up, on
  // this same session (lib/setup-add-role.ts).
  const handlePickRole = async (role: AddableRole, isHeld: boolean) => {
    if (isSwitchingRole || !user) return;
    setShowRoleSheet(false);
    setIsSwitchingRole(true);
    try {
      if (!isHeld) {
        router.push((await startAddRoleFromProfile(user, role)) as any);
        return;
      }
      const openWork = await switchRole(role as AppRole);
      setToast(t('profile.switchRole.toastSwitched', { role: roleName(role) }));
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 2400);
      router.replace('/(tabs)/dashboard');
      alertOpenWork(openWork, t, i18n.language);
    } catch (err) {
      const status = err instanceof ApiError ? err.statusCode : null;
      if (!isHeld) {
        appAlert(t('profile.switchRole.failedTitle'), t('profile.switchRole.startFailed'));
      } else if (status === 409) {
        alertRoleSwitchBlocked(err, t, router);
      } else if (status === 403) {
        appAlert(
          t('profile.switchRole.notHeldTitle'),
          t('profile.switchRole.notHeldMessage', { role: roleName(role) }),
        );
      } else {
        appAlert(t('profile.switchRole.failedTitle'), t('profile.switchRole.failedMessage'));
      }
    } finally {
      setIsSwitchingRole(false);
    }
  };

  const getStatusColor = (status: 'available' | 'busy' | 'offline') => {
    if (status === 'available') return '#10B981';
    if (status === 'busy') return '#F97316';
    return '#9CA3AF';
  };

  const statusOptions: Array<{ id: 'available' | 'busy' | 'offline', label: string, description: string }> = [
    {
      id: 'available',
      label: t('profile.availability.available'),
      description: t('profile.availability.availableDesc')
    },
    {
      id: 'busy',
      label: t('profile.availability.busy'),
      description: t('profile.availability.busyDesc')
    },
    {
      id: 'offline',
      label: t('profile.availability.offline'),
      description: t('profile.availability.offlineDesc')
    },
  ];

  return (
    <View className="flex-1 px-6 pt-4" style={{ backgroundColor: '#F6F8FC' }}>
      {isLoading || !user ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0047AB" />
        </View>
      ) : (
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Section Badge */}
        <View style={{ marginTop: 18 }}>
          <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
          <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
          <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
            {t('profile.badge')}
          </Text>
        </View>
        </View>

        {/* Title */}
        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">{t('profile.title')}</Text>

        {/* Subtitle */}
        <Text className="text-gray-500 font-outfit-regular text-base mb-8">
          {t('profile.subtitle')}
        </Text>

        {/* User Info Card */}
        <View className="bg-white rounded-3xl p-8 mb-8 items-center" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 10, elevation: 5 }}>
          {/* Language switch, same EN | ES pill as the welcome screen */}
          <View
            className="flex-row items-center"
            style={{ position: 'absolute', top: 14, right: 14, zIndex: 10, gap: 8, paddingHorizontal: 12, height: 30, borderRadius: 15, backgroundColor: '#EEF2FA' }}
          >
            {(['en', 'es'] as const).map((code, i) => {
              const on = (i18n.language?.startsWith('es') ? 'es' : 'en') === code;
              return (
                <React.Fragment key={code}>
                  {i > 0 ? <Text style={{ color: '#C3CADB', fontSize: 13 }}>|</Text> : null}
                  <TouchableOpacity
                    onPress={() => setAppLanguage(code)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                    testID={`profile-lang-${code}`}
                  >
                    <Text style={{ fontFamily: on ? 'Outfit_700Bold' : 'Outfit_500Medium', fontSize: 13, letterSpacing: 0.6, color: on ? '#1E56E3' : '#8C96AE' }}>{code.toUpperCase()}</Text>
                  </TouchableOpacity>
                </React.Fragment>
              );
            })}
          </View>

          {/* User Info Section */}
          <View className="relative">
            {/* Avatar Circle with Initials or Image */}
            <View className="w-28 h-28 rounded-full justify-center items-center overflow-hidden" style={{ backgroundColor: '#0047AB', shadowColor: '#0047AB', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 }}>
              {localProfileUri ? (
                <Image source={{ uri: localProfileUri }} className="w-full h-full" />
              ) : user.profileImage ? (
                <Image source={{ uri: user.profileImage }} className="w-full h-full" />
              ) : (
                <Text className="text-5xl font-outfit-bold text-white">
                  {user.name && user.surname ? (user.name[0] + user.surname[0]).toUpperCase() : 'U'}
                </Text>
              )}
              {isUploadingPhoto && (
                <View className="absolute inset-0 bg-black/40 items-center justify-center">
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
          </View>

          {/* Name */}
          <Text className="text-3xl font-outfit-medium mt-4 mb-1" style={{ color: '#0B1530' }}>
            {user.name} {user.surname}
          </Text>

          {/* Rating: the technician's own stats, or what technicians gave the owner */}
          {profileRating && (
            <TouchableOpacity
              onPress={() => setReviewsOpen(true)}
              disabled={!(profileRating.ratingCount > 0)}
              activeOpacity={0.7}
              accessibilityRole="button"
              testID="profile-rating"
              className="flex-row items-center justify-center mb-3" style={{ gap: 6 }}>
              {profileRating.avgRating != null && Number.isFinite(Number(profileRating.avgRating)) ? (
                <>
                  <Stars rating={Number(profileRating.avgRating)} size={16} />
                  <Text className="font-outfit-semibold text-sm" style={{ color: '#0B1530' }}>
                    {t('appointments.list.card.ratingValue', { rating: Number(profileRating.avgRating).toFixed(1), count: profileRating.ratingCount })}
                  </Text>
                </>
              ) : (
                <Text className="font-outfit-medium text-sm" style={{ color: '#6B7490' }}>{t('appointments.list.card.noRatings')}</Text>
              )}
              {profileRating.ratingCount > 0 ? <ChevronRight size={16} color="#6B7490" /> : null}
            </TouchableOpacity>
          )}

          {/* Role + identity verification badges */}
          {/* Wraps: a mechanic can show three pills at once (role, identity, ASE). */}
          <View className="flex-row flex-wrap items-center justify-center gap-2">
            <View className="px-4 py-2 rounded-full" style={{ backgroundColor: '#E9F1FF' }}>
              <Text className="text-blue-600 font-outfit-semibold text-sm capitalize">
                {user.role === 'mechanic' ? t('profile.roleMechanic') : t('profile.roleOwner')}
              </Text>
            </View>
            <VerificationBadge />
            <AseStatusBadge />
          </View>
        </View>

        {/* Status Block - Only for Mechanics */}
        {user?.role === 'mechanic' && (
          <View className="bg-white rounded-3xl p-6 mb-8" style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 4,
            elevation: 3,
          }}>
            {/* Header with Title */}
            <Text style={{ fontFamily: 'Outfit_600SemiBold', fontSize: 18, color: '#111827' }} className="mb-4">
              {t('profile.availability.heading')}
            </Text>

            {/* Status Options */}
            <View className="flex-row gap-2 mb-4">
              {statusOptions.map((option) => {
                const optionStyles = (() => {
                  switch (option.id) {
                    case 'available':
                      return { bgColor: '#ECFDF5', borderColor: '#D1FAE5', textColor: '#111827' };
                    case 'busy':
                      return { bgColor: '#FEF3C7', borderColor: '#FCD34D', textColor: '#111827' };
                    case 'offline':
                      return { bgColor: '#F3F4F6', borderColor: '#D1D5DB', textColor: '#6B7280' };
                    default:
                      return { bgColor: '#F3F4F6', borderColor: '#D1D5DB', textColor: '#6B7280' };
                  }
                })();

                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => changeStatus(option.id)}
                    disabled={isUpdatingStatus}
                    className="flex-1 py-3 px-4 rounded-2xl flex-row items-center justify-center gap-2"
                    style={{
                      backgroundColor: mechanicStatus === option.id ? optionStyles.bgColor : '#F9FAFB',
                      borderColor: mechanicStatus === option.id ? optionStyles.borderColor : '#E5E7EB',
                      borderWidth: 1,
                    }}
                  >
                    <Circle size={8} color={getStatusColor(option.id)} fill={getStatusColor(option.id)} />
                    <Text style={{ color: mechanicStatus === option.id ? optionStyles.textColor : '#9CA3AF', fontFamily: 'Outfit_600SemiBold', fontSize: 13 }}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Description */}
            <Text style={{ color: '#4B5563', fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 20 }}>
              {mechanicStatus === 'available'
                ? t('profile.availability.descAvailable')
                : mechanicStatus === 'busy'
                ? t('profile.availability.descBusy')
                : t('profile.availability.descOffline')}
            </Text>
          </View>
        )}

        {/* Menu Items Card */}
        {(() => {
          type MenuItem = {
            key: string;
            icon: typeof User;
            label: string;
            route?: string;
            value?: string;
            action?: () => void;
            busy?: boolean;
            color?: string;
            /** A group: tapping it opens/closes these, shown with the same row design. */
            children?: MenuItem[];
          };
          const switchRole: MenuItem = {
            key: 'switchRole',
            icon: ArrowLeftRight,
            label: t('profile.switchRole.menu'),
            value: roleName(currentRole),
            action: () => setShowRoleSheet(true),
            busy: isSwitchingRole,
          };
          const logout: MenuItem = { key: 'logout', icon: LogOut, label: t('profile.menu.logout'), action: () => setShowLogoutModal(true), color: '#EF4444' };
          const technicianMenu: MenuItem[] = [
            {
              key: 'account',
              icon: User,
              label: t('profile.groups.account'),
              children: [
                { key: 'personalInfo', icon: User, label: t('profile.menu.personalInfo'), route: '/personal-info' },
                { key: 'savedAddresses', icon: MapPin, label: t(counts.addresses === 1 ? 'profile.menu.savedAddressesOne' : 'profile.menu.savedAddresses'), route: '/(tabs)/addresses' },
                { key: 'privacy', icon: Lock, label: t('profile.menu.privacy'), route: '/privacy' },
              ],
            },
            {
              key: 'professional',
              icon: Briefcase,
              label: t('profile.groups.professional'),
              children: [
                { key: 'schedule', icon: Clock, label: t('profile.menu.schedule'), route: '/availability' },
                { key: 'ase', icon: Award, label: t('profile.menu.ase'), route: '/ase' },
                { key: 'otherCerts', icon: BadgeCheck, label: t('profile.menu.otherCertifications'), route: '/other-certifications' },
                { key: 'legal', icon: FileText, label: t('profile.menu.legalDocuments'), route: '/legal-documents' },
              ],
            },
            { key: 'wallet', icon: CreditCard, label: t('profile.menu.wallet'), route: '/payments' },
            { key: 'promotions', icon: Heart, label: t('profile.menu.promotions'), route: '/promotions' },
            { key: 'help', icon: HelpCircle, label: t('profile.menu.help'), route: '/help' },
            { key: 'settings', icon: Settings, label: t('profile.menu.settings'), route: '/settings' },
            switchRole,
            logout,
          ];
          // Same shape as the technician's: an Account group, then direct links.
          const ownerMenu: MenuItem[] = [
            {
              key: 'account',
              icon: User,
              label: t('profile.groups.account'),
              children: [
                { key: 'personalInfo', icon: User, label: t('profile.menu.personalInfo'), route: '/personal-info' },
                { key: 'addresses', icon: MapPin, label: t(counts.addresses === 1 ? 'profile.menu.addressesOne' : 'profile.menu.addresses'), route: '/(tabs)/addresses' },
                { key: 'vehicles', icon: Car, label: t(counts.vehicles === 1 ? 'profile.menu.vehiclesOne' : 'profile.menu.vehicles'), route: '/vehicles' },
                { key: 'privacy', icon: Lock, label: t('profile.menu.privacy'), route: '/privacy' },
              ],
            },
            { key: 'paymentCards', icon: Wallet, label: t('profile.menu.paymentCards'), route: '/payment-cards' },
            { key: 'help', icon: HelpCircle, label: t('profile.menu.help'), route: '/help' },
            { key: 'settings', icon: Settings, label: t('profile.menu.settings'), route: '/settings' },
            switchRole,
            logout,
          ];
          const isTechnicianMenu = user.role === 'mechanic';
          const menuItems = isTechnicianMenu ? technicianMenu : ownerMenu;

          const renderRow = (item: MenuItem, opts: { last: boolean; nested?: boolean }) => {
            const isGroup = !!item.children;
            const open = !!openGroups[item.key];
            return (
              <TouchableOpacity
                key={item.key}
                className="flex-row items-center px-6 py-4"
                style={{
                  borderBottomWidth: opts.last && !(isGroup && open) ? 0 : 1,
                  borderBottomColor: '#F3F4F6',
                  ...(opts.nested ? { backgroundColor: '#F9FAFB', paddingLeft: 40 } : null),
                }}
                onPress={isGroup
                  ? () => setOpenGroups((prev) => ({ ...prev, [item.key]: !prev[item.key] }))
                  : item.action ? item.action : () => {
                    if (item.route) router.push(item.route as any);
                  }}
                accessibilityState={isGroup ? { expanded: open } : undefined}
              >
                <View className={`w-12 h-12 rounded-full ${item.color ? 'bg-red-50' : 'bg-blue-50'} justify-center items-center mr-4`}>
                  <item.icon size={24} color={item.color || '#0047AB'} />
                </View>
                <Text className={`flex-1 font-outfit-semibold text-lg ${item.color ? 'text-red-500' : 'text-gray-900'}`}>
                  {item.label}
                </Text>
                {item.value ? (
                  <View className="px-2.5 py-1 rounded-full mr-2" style={{ backgroundColor: '#EAF1FF' }}>
                    <Text className="font-outfit-bold" style={{ fontSize: 13, color: '#1E56E3' }} numberOfLines={1}>{item.value}</Text>
                  </View>
                ) : null}
                {item.busy ? (
                  <ActivityIndicator color="#0047AB" />
                ) : isGroup ? (
                  // Groups point right (closed) and turn down while open; direct links show no arrow.
                  open ? <ChevronDown size={24} color="#0047AB" /> : <ChevronRight size={24} color="#0047AB" />
                ) : null}
              </TouchableOpacity>
            );
          };

          return (
        <View className="mb-6" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 10, elevation: 5 }}>
          <View className="bg-white rounded-3xl overflow-hidden">
            {menuItems.map((item, index) => {
              const last = index === menuItems.length - 1;
              if (!item.children) return renderRow(item, { last });
              const open = !!openGroups[item.key];
              return (
                <React.Fragment key={item.key}>
                  {renderRow(item, { last })}
                  {open && item.children.map((child, ci) =>
                    renderRow(child, { last: last && ci === item.children!.length - 1, nested: true }))}
                </React.Fragment>
              );
            })}
          </View>
        </View>
          );
        })()}

        {/* Installed version, small, at the very bottom */}
        <Text className="font-outfit-regular" style={{ fontSize: 12, color: '#B4BBC9', marginTop: -12, marginBottom: 12, textAlign: 'center', letterSpacing: 0.3 }} testID="profile-app-version">
          {installedVersionLabel()}
        </Text>

      <ReviewsSheet
        visible={reviewsOpen}
        onClose={() => setReviewsOpen(false)}
        isTechnician={isTechnician}
        // The server's own average and count once they are known; the profile's until then.
        average={profileReviews.average ?? (profileRating?.avgRating != null && Number.isFinite(Number(profileRating.avgRating)) ? Number(profileRating.avgRating) : null)}
        count={profileReviews.count ?? profileRating?.ratingCount ?? 0}
        items={profileReviews.items}
        loading={profileReviews.loading}
        failed={profileReviews.failed}
        failedStatus={profileReviews.failedStatus}
        hasMore={profileReviews.hasMore}
        onLoadMore={profileReviews.loadMore}
      />

      {/* Logout Confirmation Modal */}
      <ConfirmationModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        title={t('profile.modals.logoutTitle')}
        message=""
        icon={LogOut}
        iconColor="#00A8E8"
        confirmButtonColor="#0047AB"
        confirmText={t('profile.modals.yes')}
        cancelText={t('profile.modals.no')}
      />

      <SwitchRoleSheet
        visible={showRoleSheet}
        current={currentRole}
        held={user.roles ?? [currentRole]}
        onClose={() => setShowRoleSheet(false)}
        onPick={handlePickRole}
      />

      {/* Status sheet */}
      <MechanicStatusSheet
        visible={showStatusModal}
        title={t('profile.modals.changeStatus')}
        current={mechanicStatus === 'busy' || mechanicStatus === 'offline' ? mechanicStatus : 'available'}
        options={statusOptions}
        onPick={(id) => void changeStatus(id)}
        onClose={() => setShowStatusModal(false)}
      />
      </ScrollView>
      )}
      {toast && (
        <View
          className="absolute flex-row items-center px-3.5 py-3 rounded-2xl"
          style={{ left: 16, right: 16, bottom: 24, gap: 10, backgroundColor: '#0B1530', shadowColor: '#0B1530', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 }}
        >
          <View className="w-[22px] h-[22px] rounded-full items-center justify-center" style={{ backgroundColor: '#10B981' }}>
            <Check size={12} color="#fff" strokeWidth={3} />
          </View>
          <Text className="flex-1 font-outfit-semibold text-sm text-white">{toast}</Text>
        </View>
      )}
    </View>
  );
}
