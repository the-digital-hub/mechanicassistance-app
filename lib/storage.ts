import AsyncStorage from '@react-native-async-storage/async-storage';

export const STORAGE_KEYS = {
    SETUP_PROGRESS: 'mechanic_setup_progress',
    USER_DATA: 'mechanic_user_data',
    LAST_PHONE: 'mechanic_last_phone',
};

export const saveSetupProgress = async (step: string, data: any) => {
    try {
        const existing = await getSetupProgress();
        const updated = { ...existing, [step]: data, lastStep: step };
        await AsyncStorage.setItem(STORAGE_KEYS.SETUP_PROGRESS, JSON.stringify(updated));
    } catch (e) {
        console.error('Failed to save setup progress', e);
    }
};

/**
 * Merges keys into the setup progress without moving `lastStep`.
 *
 * `saveSetupProgress` records a completed step, which is what the resume logic
 * keys on. Seeding data for steps not yet visited (the add-role pre-fill) must
 * not look like progress, or a restart would skip those steps.
 * A key set to undefined is dropped.
 */
export const mergeSetupProgress = async (data: Record<string, unknown>) => {
    try {
        const existing = await getSetupProgress();
        await AsyncStorage.setItem(STORAGE_KEYS.SETUP_PROGRESS, JSON.stringify({ ...existing, ...data }));
    } catch (e) {
        console.error('Failed to merge setup progress', e);
    }
};

export const getSetupProgress = async () => {
    try {
        const json = await AsyncStorage.getItem(STORAGE_KEYS.SETUP_PROGRESS);
        return json ? JSON.parse(json) : {};
    } catch (e) {
        console.error('Failed to get setup progress', e);
        return {};
    }
};

export const clearSetupProgress = async () => {
    try {
        await AsyncStorage.removeItem(STORAGE_KEYS.SETUP_PROGRESS);
    } catch (e) {
        console.error('Failed to clear setup progress', e);
    }
};

export const saveLastPhone = async (phone: string) => {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.LAST_PHONE, phone);
    } catch (e) {
        console.error('Failed to save last phone', e);
    }
};

export const getLastPhone = async () => {
    try {
        return await AsyncStorage.getItem(STORAGE_KEYS.LAST_PHONE);
    } catch (e) {
        console.error('Failed to get last phone', e);
        return null;
    }
};
