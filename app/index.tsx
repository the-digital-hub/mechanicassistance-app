import { useUser } from '@/context/UserContext';
import { getSignupToken, isExpired } from '@/lib/auth/session';
import { getSetupResumeRoute } from '@/lib/setup-resume';
import { getSetupProgress } from '@/lib/storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

/**
 * App entry point — determines where to redirect the user:
 *
 * 1. Logged in           → /(tabs)/dashboard (main app)
 * 2. Incomplete setup    → resume at the correct setup screen (or restart at the phone if the sign-up token is gone)
 * 3. No session/progress → /onboarding
 *
 * Identity verification deliberately does NOT gate entry: an unverified account
 * uses the app normally. It is optional for users, and a mechanic is only
 * stopped at the one gated action — offering on a request. See
 * app/verify-identity.tsx.
 */
export default function Index() {
    const { user, isLoading } = useUser();
    const [resumeRoute, setResumeRoute] = useState<string | null>(null);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        const checkSetupProgress = async () => {
            if (!user) {
                try {
                    const progress = await getSetupProgress();
                    if (progress?.lastStep) {
                        // The steps after the phone check talk to the server with the sign-up token, which lives 30 minutes and is wiped
                        // whenever a session is cleared. Resuming deep into the flow without a live one dead-ends on a 401 ("Verification
                        // could not start"), so with no usable token the registration restarts at the phone: what was already typed stays.
                        const token = await getSignupToken();
                        const alive = !!token && !isExpired(token);
                        setResumeRoute(alive ? getSetupResumeRoute(progress) : '/setup');
                    }
                } catch {
                    // If reading progress fails, proceed to onboarding
                }
            }
            setChecked(true);
        };

        if (!isLoading) {
            checkSetupProgress();
        }
    }, [isLoading, user]);

    if (isLoading || !checked) return null;

    if (user) return <Redirect href="/(tabs)/dashboard" />;

    if (resumeRoute) return <Redirect href={resumeRoute as any} />;
    return <Redirect href="/onboarding" />;
}
