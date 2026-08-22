export type EnvType = 'prod' | 'dev';

export interface EnvEndpoints {
    apiBaseUrl: string;
    wsUrl: string;
}

export interface BootstrapConfig {
    allowEnvSwitch: boolean;
    defaultEnv: EnvType;
    envs: {
        prod: EnvEndpoints;
        dev: EnvEndpoints;
        [key: string]: EnvEndpoints;
    };
    /**
     * Lowest app version the backend still serves, e.g. "1.1.0".
     *
     * Null or absent means no gate, which is the current state: nothing has been
     * removed from the API yet, so every installed build still works. It exists
     * now so the gate itself ships *before* the release that needs it — a forced
     * upgrade is only possible if the build being upgraded already knows how to
     * be told.
     */
    minSupportedVersion?: string | null;
    /** Where to send someone the gate has blocked. */
    storeUrls?: {
        ios?: string;
        android?: string;
    };
}
