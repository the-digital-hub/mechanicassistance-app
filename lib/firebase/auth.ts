import { appleAuth } from '@invertase/react-native-apple-authentication';
import auth, {
    FirebaseAuthTypes,
    getIdToken as firebaseGetIdToken,
} from '@react-native-firebase/auth';
import {
    GoogleSignin,
    isSuccessResponse,
} from '@react-native-google-signin/google-signin';

// ─── Configuration ──────────────────────────────────────────────────────────────
// Web client ID from Firebase Console → Authentication → Sign-in method → Google
// This is the OAuth 2.0 "Web client (auto created by Google Service)" client ID.
// ⚠️ This is NOT the iOS CLIENT_ID from GoogleService-Info.plist.
// Find it in: Firebase Console → Authentication → Sign-in method → Google → Web SDK configuration → Web client ID
// Or in: Google Cloud Console → APIs & Credentials → OAuth 2.0 Client IDs → "Web client (auto created by Google Service)"
// Firebase project: grand-nimbus-498119-n7 (Mechanic Assistance App, org mechanicassistance.com).
const WEB_CLIENT_ID = '956195940119-e5fc6h6pe8t807bngmf4htv82tf9jct9.apps.googleusercontent.com';

GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });

// ─── Phone Auth (existing) ──────────────────────────────────────────────────────

// Module-level store for the pending confirmation result (shared between screens during setup flow)
let pendingConfirmation: FirebaseAuthTypes.ConfirmationResult | null = null;

/**
 * Sends an OTP SMS via Firebase Phone Auth.
 * @param phoneNumber  E.164 format, e.g. "+11234567890"
 */
export const sendOTP = async (phoneNumber: string): Promise<void> => {
    console.log('[FirebaseAuth] sendOTP called for:', phoneNumber);
    console.log('[FirebaseAuth] Current user before sendOTP:', auth().currentUser?.uid ?? 'none');

    // Sign out any existing Firebase session before starting phone auth
    // to avoid auth/internal-error when a previous user is still signed in
    if (auth().currentUser) {
        console.log('[FirebaseAuth] Signing out existing user before OTP...');
        await auth().signOut();
    }

    const startTime = Date.now();
    try {
        console.log('[FirebaseAuth] Calling signInWithPhoneNumber...');
        pendingConfirmation = await auth().signInWithPhoneNumber(phoneNumber);
        const elapsed = Date.now() - startTime;
        console.log(`[FirebaseAuth] signInWithPhoneNumber resolved in ${elapsed}ms`);
        console.log('[FirebaseAuth] verificationId:', (pendingConfirmation as any)?.verificationId ?? 'n/a');
    } catch (err: any) {
        const elapsed = Date.now() - startTime;
        console.error(`[FirebaseAuth] signInWithPhoneNumber FAILED after ${elapsed}ms:`, err?.code, err?.message);
        console.error(`[FirebaseAuth] Full error:`, JSON.stringify(err, null, 2));
        console.error(`[FirebaseAuth] nativeErrorMessage:`, err?.nativeErrorMessage);
        console.error(`[FirebaseAuth] userInfo:`, JSON.stringify(err?.userInfo, null, 2));
        throw err;
    }
};

/**
 * Verifies the OTP code entered by the user.
 * Works for both login and signup flows.
 */
export const verifyOTP = async (code: string): Promise<FirebaseAuthTypes.User> => {
    if (!pendingConfirmation) {
        throw new Error('No pending OTP. Please request a new code.');
    }
    const credential = await pendingConfirmation.confirm(code);
    if (!credential?.user) {
        throw new Error('OTP verification failed. Please try again.');
    }
    pendingConfirmation = null;
    return credential.user;
};

/** True if we have a pending OTP confirmation waiting to be verified. */
export const hasPendingOTP = (): boolean => pendingConfirmation !== null;

// ─── Google Sign-In ─────────────────────────────────────────────────────────────

/**
 * Initiates the native Google Sign-In flow, then signs into Firebase with the
 * Google credential. Returns the Firebase user on success.
 *
 * Throws if the user cancels the Google prompt or if Firebase rejects the credential.
 */
export const signInWithGoogle = async (): Promise<FirebaseAuthTypes.User> => {
    // Ensure any previous Google session is cleared to force account picker
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true }).catch(() => {
        // Play Services check is Android-only — ignore failures on iOS
    });

    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
        throw new Error('Google Sign-In was cancelled or failed.');
    }

    const { idToken } = response.data;
    if (!idToken) {
        throw new Error('Google Sign-In did not return an ID token.');
    }

    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    const userCredential = await auth().signInWithCredential(googleCredential);

    if (!userCredential.user) {
        throw new Error('Firebase authentication with Google credential failed.');
    }

    console.log('[FirebaseAuth] Google sign-in successful, uid:', userCredential.user.uid);
    return userCredential.user;
};

// ─── Apple Sign-In ──────────────────────────────────────────────────────────────

/**
 * Initiates the native Apple Sign-In flow (iOS only), then signs into Firebase
 * with the Apple credential. Returns the Firebase user on success.
 *
 * Note: Apple only provides the user's name/email on the FIRST sign-in.
 * Subsequent sign-ins return only the identity token.
 */
export const signInWithApple = async (): Promise<FirebaseAuthTypes.User> => {
    const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
    });

    const { identityToken, nonce } = appleAuthRequestResponse;

    if (!identityToken) {
        throw new Error('Apple Sign-In did not return an identity token.');
    }

    const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce);
    const userCredential = await auth().signInWithCredential(appleCredential);

    if (!userCredential.user) {
        throw new Error('Firebase authentication with Apple credential failed.');
    }

    // Apple provides displayName only on first sign-in — update profile if available
    const fullName = appleAuthRequestResponse.fullName;
    if (fullName && (fullName.givenName || fullName.familyName) && !userCredential.user.displayName) {
        const displayName = [fullName.givenName, fullName.familyName].filter(Boolean).join(' ');
        await userCredential.user.updateProfile({ displayName });
    }

    console.log('[FirebaseAuth] Apple sign-in successful, uid:', userCredential.user.uid);
    return userCredential.user;
};

// ─── Email/Password Auth ────────────────────────────────────────────────────────

/**
 * Signs in an existing user with email and password via Firebase Auth.
 * Returns the Firebase user on success.
 */
export const signInWithEmail = async (email: string, password: string): Promise<FirebaseAuthTypes.User> => {
    const userCredential = await auth().signInWithEmailAndPassword(email, password);

    if (!userCredential.user) {
        throw new Error('Email sign-in failed.');
    }

    console.log('[FirebaseAuth] Email sign-in successful, uid:', userCredential.user.uid);
    return userCredential.user;
};

/**
 * Creates a new Firebase user with email and password.
 * Returns the Firebase user on success.
 */
export const registerWithEmail = async (email: string, password: string): Promise<FirebaseAuthTypes.User> => {
    const userCredential = await auth().createUserWithEmailAndPassword(email, password);

    if (!userCredential.user) {
        throw new Error('Email registration failed.');
    }

    console.log('[FirebaseAuth] Email registration successful, uid:', userCredential.user.uid);
    return userCredential.user;
};

// ─── Common utilities ───────────────────────────────────────────────────────────

/** Returns the Firebase ID token for the currently signed-in Firebase user. */
export const getIdToken = async (): Promise<string | null> => {
    const user = auth().currentUser;
    return user ? firebaseGetIdToken(user) : null;
};

/** Signs the user out of Firebase (called on app logout). */
export const firebaseSignOut = async (): Promise<void> => {
    // Sign out of Google if applicable (clears cached Google session)
    try {
        await GoogleSignin.signOut();
    } catch {
        // Ignore — user may not have signed in with Google
    }

    await auth().signOut();
};
