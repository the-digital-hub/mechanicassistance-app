import { appleAuth } from '@invertase/react-native-apple-authentication';
import {
    AppleAuthProvider,
    GoogleAuthProvider,
    deleteUser,
    getAuth,
    reauthenticateWithCredential,
    revokeToken,
} from '@react-native-firebase/auth';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';

/**
 * Deleting an account that signed in with Apple or Google (backend 26-nov, `plataforma/borrado-de-cuenta.md` §5). The server cannot revoke
 * Apple's token (it never keeps the authorization code) nor delete the Firebase user, so the phone does it, in this order:
 *   1. before calling the server: sign in again (Firebase asks for a recent sign-in; Apple gives a fresh authorization code);
 *   2. the server deletes the account (any error stops everything here: nothing was deleted, the person keeps the account);
 *   3. only after it worked: revoke the Apple token and delete the Firebase user.
 * An account that came in by phone or email has no Firebase user and skips all of this.
 */

export type DeletionProvider = 'apple.com' | 'google.com';

/** The social provider of the Firebase user still signed in on this phone, if any. */
export function deletionProvider(): DeletionProvider | null {
    const providers = getAuth().currentUser?.providerData.map((p) => p.providerId) ?? [];
    if (providers.includes('apple.com')) return 'apple.com';
    if (providers.includes('google.com')) return 'google.com';
    return null;
}

/** What step 1 gives step 3: Apple's fresh authorization code (Google needs none). */
export interface FreshSignIn {
    appleAuthorizationCode?: string;
}

/** Asks the person to sign in again with the provider they used. Throws if they cancel or it fails. */
export async function reauthenticate(provider: DeletionProvider): Promise<FreshSignIn> {
    const user = getAuth().currentUser;
    if (!user) throw new Error('No Firebase user to sign in again.');

    if (provider === 'apple.com') {
        const response = await appleAuth.performRequest({
            requestedOperation: appleAuth.Operation.LOGIN,
            requestedScopes: [],
        });
        const { identityToken, nonce, authorizationCode } = response;
        if (!identityToken || !authorizationCode) throw new Error('Apple did not return a code to confirm it is you.');
        await reauthenticateWithCredential(user, AppleAuthProvider.credential(identityToken, nonce));
        return { appleAuthorizationCode: authorizationCode };
    }

    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response) || !response.data.idToken) throw new Error('Google did not confirm it is you.');
    await reauthenticateWithCredential(user, GoogleAuthProvider.credential(response.data.idToken));
    return {};
}

/**
 * Step 3, once the server deleted the account: revoke the Apple token and delete the Firebase user. Each one is tried on its own and a
 * failure is only logged: the account is already gone for the person, and a left-over Firebase user is cleaned by Auth's retry task.
 */
export async function finishFirebaseDeletion(fresh: FreshSignIn): Promise<void> {
    const auth = getAuth();
    if (fresh.appleAuthorizationCode) {
        try {
            await revokeToken(auth, fresh.appleAuthorizationCode);
        } catch (error) {
            console.warn('[accountDeletion] Apple token was not revoked:', (error as Error).message);
        }
    }
    const user = auth.currentUser;
    if (user) {
        try {
            await deleteUser(user);
        } catch (error) {
            console.warn('[accountDeletion] Firebase user was not deleted:', (error as Error).message);
        }
    }
}
