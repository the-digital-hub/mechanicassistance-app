import { Linking } from 'react-native';

/** Where reports of abusive messages, reviews or behaviour go. Same address the privacy policy gives for contact. */
export const SUPPORT_EMAIL = 'contact@mechanicassistance.com';

export const reportMailtoUrl = (subject: string, body: string): string =>
    `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

/**
 * Opens the mail app with a report already addressed to support. Resolves false when the phone has no mail app, so the caller can show
 * the address instead. (A report form with its own endpoint can replace this once the backend has one; callers do not change.)
 */
export async function openReport(subject: string, body: string): Promise<boolean> {
    try {
        await Linking.openURL(reportMailtoUrl(subject, body));
        return true;
    } catch {
        return false;
    }
}
