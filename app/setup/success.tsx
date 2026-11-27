import { useUser } from "@/context/UserContext";
import { ApiError } from "@/lib/api/types";
import { clearSession } from "@/lib/auth/session";
import { userDAO } from "@/lib/dao/UserDAO";
import { getAddRoleState } from "@/lib/setup-add-role";
import { clearSetupProgress, getSetupProgress } from "@/lib/storage";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";
import { SETUP_BG, SetupFooter } from "@/components/setup/SetupKit";
import { WelcomeSequence } from "@/components/setup/WelcomeSequence";
import { TYPE } from "@/lib/ui/type";

/** Where the caller has to go once the signup token is no longer usable. */
type ExpiredRecovery = "signIn" | "restart";

/**
 * True when the wizard's scoped token is gone — it aged out, or the request went
 * out under some other bearer. Matched on the backend code, never on the message.
 */
function isSignupTokenGone(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.statusCode !== 401) return false;

  const payload =
    error.apiError !== null && typeof error.apiError === "object"
      ? (error.apiError as Record<string, unknown>)
      : null;

  return (
    payload?.code === "SIGNUP_TOKEN_EXPIRED" ||
    payload?.code === "SIGNUP_TOKEN_INVALID"
  );
}

export default function SuccessScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { adoptSession, user } = useUser();
  // The role this account starts with decides which tips greet it.
  const role: "user" | "mechanic" = user?.role === "mechanic" ? "mechanic" : "user";
  const [isCreating, setIsCreating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState<ExpiredRecovery | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const hasRun = useRef(false);
  /** Set once POST /api/users succeeds, so recovery knows the account exists. */
  const accountCreated = useRef(false);
  /** The phone already had an account and this run adds a role to it. */
  const [isAddRole, setIsAddRole] = useState(false);
  const [fromProfile, setFromProfile] = useState(false);
  const [registeredOnly, setRegisteredOnly] = useState(false);

  useEffect(() => {
    // Prevent double execution in React strict mode
    if (hasRun.current) return;
    hasRun.current = true;

    const createAccountAndLogin = async () => {
      try {
        console.log("🔵 [success.tsx] Starting account creation...");

        const progress = await getSetupProgress();
        console.log("🔵 [success.tsx] Setup progress loaded:", progress);

        // Existing account: add the role to it instead of creating a user.
        // The wizard ran on that account's session, so there is no signup
        // token to trade; the role change returns the new session itself.
        const addRoleState = getAddRoleState(progress);
        if (addRoleState) {
          setIsAddRole(true);
          setFromProfile(!!addRoleState.fromProfile);
          const result = await userDAO.addOwnRole(progress);
          // Towing / locksmith are registered but stay inactive.
          setRegisteredOnly(!!addRoleState.targetRole);
          accountCreated.current = true;
          const account = await userDAO.getById(result.userId);
          if (account) {
            await adoptSession({
              ...account,
              role: result.primaryRole,
              roles: result.roles,
              permissions: result.permissions,
            });
            setIsLoggedIn(true);
          }
          await clearSetupProgress();
          setIsCreating(false);
          return;
        }

        console.log("🔵 [success.tsx] Registering user with DAO...");
        const registerResult = await userDAO.register(progress);
        console.log("🔵 [success.tsx] Registration successful:", registerResult);
        // From here on the account exists, so a later failure must not send the
        // caller back through a wizard that would collide with their own email.
        accountCreated.current = true;

        // The wizard ran on a signup-scoped token; trade it for a real session
        // now that the account exists. No Firebase token is involved any more.
        console.log("🔵 [success.tsx] Starting session from signup token...");
        const newUser = await userDAO.startSessionFromSignup();
        if (newUser) {
          await adoptSession(newUser);
          setIsLoggedIn(true);
        } else {
          console.warn("⚠️ [success.tsx] Session could not be started");
        }

        console.log("🔵 [success.tsx] Clearing setup progress...");
        await clearSetupProgress();
        setIsCreating(false);
        console.log("✅ [success.tsx] Account creation completed successfully");
      } catch (err: any) {
        console.error("❌ [success.tsx] Registration failed:", err);
        console.error("❌ [success.tsx] Error message:", err.message);
        console.error("❌ [success.tsx] Error stack:", err.stack);

        // The scoped token has a 30-minute life and the wizard can outlast it.
        // Backend codes: SIGNUP_TOKEN_EXPIRED (ran out) and
        // SIGNUP_TOKEN_INVALID (some other bearer). Both mean the same thing to
        // the caller — the phone has to be verified again — but where they land
        // depends on whether the account already exists.
        if (isSignupTokenGone(err)) {
          setExpired(accountCreated.current ? "signIn" : "restart");
        } else {
          // `ApiError.message` is built for the logs above: it carries the status
          // code and the serialized error payload. On screen that reads as a wall
          // of JSON, so show `apiMessage` — the sentence the backend wrote for a
          // human.
          const shown =
            err instanceof ApiError ? err.apiMessage : (err?.message as string);
          setError(shown || t("setup.success.createAccountFailed"));
        }

        setIsCreating(false);
      }
    };

    createAccountAndLogin();
  }, [adoptSession]);

  const handleGetStarted = () => {
    if (isLoggedIn) {
      // User is authenticated — the legal texts of the role come first (it goes on to the app by itself when none is pending)
      router.replace("/setup/legal" as never);
    } else {
      // Fallback: manual login
      router.replace("/login");
    }
  };

  if (isCreating) {
    return (
      <View className="flex-1 items-center justify-center p-6" style={{ backgroundColor: SETUP_BG }}>
        <ActivityIndicator size="large" color="#0047AB" />
        <Text className="font-outfit-semibold text-center mt-4" style={{ ...TYPE.body, color: '#1E56E3' }}>
          {t(isAddRole ? "setup.addRole.finishing" : "setup.success.finalizing")}
        </Text>
      </View>
    );
  }

  if (expired) {
    const goRecover = async () => {
      // Only clear the wizard's state when the account made it: otherwise the
      // caller restarts from a blank form and re-types everything.
      if (expired === "signIn") await clearSetupProgress();
      router.replace(expired === "signIn" ? "/login" : "/setup");
    };

    return (
      <View className="flex-1" style={{ backgroundColor: SETUP_BG }}>
        <View className="flex-1 items-center justify-center p-6">
          <Text className="font-outfit-bold text-center mb-3" style={{ fontSize: 26, lineHeight: 32, letterSpacing: -0.5, color: '#0B1530' }}>
            {t("setup.success.expiredTitle")}
          </Text>
          <Text className="font-outfit-regular text-center" style={{ ...TYPE.body, color: '#6B7490' }}>
            {t(
              expired === "signIn"
                ? "setup.success.expiredMessage"
                : "setup.success.expiredRestartMessage",
            )}
          </Text>
        </View>
        <SetupFooter
          label={t(expired === "signIn" ? "setup.success.signIn" : "setup.success.tryAgain")}
          onPress={goRecover}
        />
      </View>
    );
  }

  if (error) {
    const cancelAddRole = async () => {
      // Started from the profile: the session is the app's own, keep it.
      if (fromProfile) {
        await clearSetupProgress();
        router.replace("/(tabs)");
        return;
      }
      // Abandoning the add-role run: end the session the verify step
      // opened rather than leaving it stored but unused.
      await userDAO.logout();
      await clearSession();
      await clearSetupProgress();
      router.replace("/login");
    };

    return (
      <View className="flex-1" style={{ backgroundColor: SETUP_BG }}>
        <View className="flex-1 items-center justify-center p-6">
          <Text className="font-outfit-bold text-center mb-3" style={{ fontSize: 26, lineHeight: 32, letterSpacing: -0.5, color: '#DC2626' }}>
            {t("setup.success.errorTitle")}
          </Text>
          <Text className="font-outfit-regular text-center" style={{ ...TYPE.body, color: '#6B7490' }}>
            {error}
          </Text>
        </View>
        <SetupFooter
          label={t("setup.success.tryAgain")}
          onPress={() => router.replace("/setup")}
          secondaryLabel={isAddRole ? t("setup.addRole.cancel") : undefined}
          onSecondary={isAddRole ? cancelAddRole : undefined}
        />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: SETUP_BG }}>
      <WelcomeSequence
        role={role}
        subtitle={t(registeredOnly ? "setup.addRole.registeredOnly" : "setup.success.setupComplete")}
      />

      <SetupFooter label={t("setup.success.getStarted")} onPress={handleGetStarted} />
    </View>
  );
}
