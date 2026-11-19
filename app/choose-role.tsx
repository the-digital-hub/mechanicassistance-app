import { RoleChoice } from "@/components/auth/RoleChoice";
import { GradientLayout } from "@/components/ui/GradientLayout";
import { useUser } from "@/context/UserContext";
import { ApiError } from "@/lib/api/types";
import { userDAO } from "@/lib/dao/UserDAO";
import type { AppRole } from "@/lib/dao/interfaces";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, View } from 'react-native';
import { appAlert } from '@/lib/ui/appAlert';
import { alertOpenWork, alertRoleSwitchBlocked } from '@/lib/roles/roleSwitchMessages';

/** Roles the app can actually run as. Towing / locksmith are registered but never activated. */
const ACTIVATABLE: AppRole[] = ["user", "mechanic"];

/**
 * Shown right after the credentials are accepted, only when the account holds
 * more than one role: pick where to go and enter that role directly. Same data
 * as the profile's "Switch role", without the switch UI. With a single role it
 * just forwards to the dashboard, so every sign-in path can land here.
 */
export default function ChooseRoleScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user, isLoading, switchRole, logout } = useUser();
  const [busy, setBusy] = useState<AppRole | null>(null);

  // The sign-in response does not always carry every role (the full profile is merged in
  // the background), so read them here before deciding whether there is anything to ask.
  const [loadedRoles, setLoadedRoles] = useState<string[] | null>(null);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    userDAO
      .getById(userId)
      .then((fresh) => alive && setLoadedRoles(fresh?.roles ?? []))
      .catch(() => alive && setLoadedRoles([]));
    return () => {
      alive = false;
    };
  }, [userId]);

  const held = useMemo(() => {
    const roles = new Set<string>([...(user?.roles ?? []), ...(loadedRoles ?? [])]);
    if (user) roles.add(user.role);
    return ACTIVATABLE.filter((r) => roles.has(r));
  }, [user, loadedRoles]);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    } else if (loadedRoles !== null && held.length < 2) {
      router.replace("/(tabs)/dashboard");
    }
  }, [isLoading, user, loadedRoles, held.length, router]);

  const enter = async (role: AppRole) => {
    if (busy || !user) return;
    setBusy(role);
    try {
      // Already the active role: nothing to switch, just go in.
      const openWork = role !== user.role ? await switchRole(role) : undefined;
      router.replace("/(tabs)/dashboard");
      alertOpenWork(openWork, t, i18n.language);
    } catch (err) {
      const status = err instanceof ApiError ? err.statusCode : null;
      const name = t(`profile.switchRole.roles.${role}.label`);
      if (status === 409) {
        alertRoleSwitchBlocked(err, t, router);
      } else if (status === 403) {
        appAlert(t("profile.switchRole.notHeldTitle"), t("profile.switchRole.notHeldMessage", { role: name }));
      } else {
        appAlert(t("profile.switchRole.failedTitle"), t("profile.switchRole.failedMessage"));
      }
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    try {
      await logout();
    } finally {
      router.replace("/onboarding");
    }
  };

  if (isLoading || !user || loadedRoles === null || held.length < 2) {
    return (
      <GradientLayout>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      </GradientLayout>
    );
  }

  return <RoleChoice roles={held} lastUsed={user.role} busy={busy} onPick={enter} onSignOut={signOut} />;
}
