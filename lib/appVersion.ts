import Constants from 'expo-constants';

/**
 * The version of the binary that is installed: the App Store / TestFlight version and its build
 * number, read from the app itself, so each distribution shows its own. `expo-application` is a
 * native module, so a dev client built before it was added falls back to the config version.
 */
let Application: { nativeApplicationVersion: string | null; nativeBuildVersion: string | null } | null = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Application = require('expo-application');
} catch {
    Application = null;
}

export function installedVersionLabel(): string {
    let version: string | null = null;
    let build: string | null = null;
    try {
        version = Application?.nativeApplicationVersion ?? null;
        build = Application?.nativeBuildVersion ?? null;
    } catch {
        // Native module missing in this binary.
    }
    version = version ?? Constants.expoConfig?.version ?? '';
    return `v${version}${build ? ` (${build})` : ''}`;
}
