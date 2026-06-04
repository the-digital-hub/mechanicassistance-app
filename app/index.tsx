import { useUser } from '@/context/UserContext';
import { getSetupResumeRoute } from '@/lib/setup-resume';
import { getSetupProgress } from '@/lib/storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

/**
 * App entry point — determines where to redirect the user:
 *
 * 1. Logged in           → /(tabs)/dashboard (main app)
 * 2. Incomplete setup    → resume at the correct setup screen
 * 3. No session/progress → /onboarding
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
                        const route = getSetupResumeRoute(progress);
                        setResumeRoute(route);
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
    return <Redirect href="/setup" />;
}
