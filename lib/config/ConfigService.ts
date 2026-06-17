import AsyncStorage from '@react-native-async-storage/async-storage';
import { BootstrapConfig, EnvEndpoints, EnvType } from './types';

const BOOTSTRAP_URL = 'https://bootstrap.mechanicapp.com/config';

const KEYS = {
    SELECTED_ENV: '@mechanic:selectedEnv',
    REMOTE_CONFIG_CACHE: '@mechanic:remoteConfigCache',
    ENV_PIN_OK: '@mechanic:envPinOk',
};

// Default safe fallback if network and cache fail entirely
const DEFAULT_FALLBACK_CONFIG: BootstrapConfig = {
    allowEnvSwitch: true,
    defaultEnv: 'prod',
    envs: {
        prod: {
            apiBaseUrl: 'https://t9smggmz3a.us-east-1.awsapprunner.com/',
            // WebSocket now lives on the dedicated realtime-gateway (ALB), NOT App
            // Runner (which cannot serve WS). Replace with the ALB DNS after the
            // infra/realtime-gateway.yaml stack is deployed: wss://<AlbDnsName>
            wsUrl: 'wss://ws.mechanicassistance.com',
        },
        dev: {
            apiBaseUrl: 'http://localhost:3000',
            // Local realtime-gateway (npm run start:dev in realtime-gateway/, port 3010)
            wsUrl: 'ws://localhost:3010',
        },
    },
};

type ConfigListener = () => void;

class ConfigServiceClass {
    private config: BootstrapConfig = DEFAULT_FALLBACK_CONFIG;
    private currentEnv: EnvType = 'prod';
    private isInitialized = false;
    private initPromise: Promise<void> | null = null;
    private listeners: Set<ConfigListener> = new Set();

    // To limit PIN approval valid time
    private PIN_VALIDITY_MS = 24 * 60 * 60 * 1000; // 24 hours

    public async init(): Promise<void> {
        if (this.isInitialized) return Promise.resolve();
        if (this.initPromise) return this.initPromise;

        this.initPromise = this._init();
        return this.initPromise;
    }

    private async _init(): Promise<void> {
        try {
            await this.loadConfig();
            await this.loadSelectedEnv();
            this.isInitialized = true;
            this.notifyListeners();
        } catch (error) {
            console.error('[ConfigService] Failed to initialize', error);
        } finally {
            this.initPromise = null;
        }
    }

    private async loadConfig() {
        // 1. Try fetching from bootstrap
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const response = await fetch(BOOTSTRAP_URL, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data: BootstrapConfig = await response.json();
                this.config = data;
                // Cache it
                await AsyncStorage.setItem(KEYS.REMOTE_CONFIG_CACHE, JSON.stringify(data));
                console.log('[ConfigService] Loaded initial config from network');
                return;
            }
        } catch (e) {
            console.warn('[ConfigService] Could not fetch remote bootstrap config:', e);
        }

        // 2. Fallback to cache
        try {
            const cached = await AsyncStorage.getItem(KEYS.REMOTE_CONFIG_CACHE);
            if (cached) {
                this.config = JSON.parse(cached);
                console.log('[ConfigService] Loaded config from cache');
                return;
            }
        } catch (e) {
            console.warn('[ConfigService] Failed to read from cache:', e);
        }

        // 3. Fallback to default
        console.log('[ConfigService] Using default fallback config');
        this.config = DEFAULT_FALLBACK_CONFIG;
    }

    private async loadSelectedEnv() {
        try {
            const saved = await AsyncStorage.getItem(KEYS.SELECTED_ENV);
            if (saved && (saved === 'prod' || saved === 'dev')) {
                this.currentEnv = saved as EnvType;
            } else {
                this.currentEnv = this.config.defaultEnv;
            }
        } catch (e) {
            this.currentEnv = this.config.defaultEnv;
        }
    }

    public getEnv(): EnvType {
        return this.currentEnv;
    }

    public async setEnv(env: EnvType): Promise<void> {
        if (this.currentEnv === env) return;

        this.currentEnv = env;
        try {
            await AsyncStorage.setItem(KEYS.SELECTED_ENV, env);
            this.notifyListeners();
            console.log(`[ConfigService] Environment changed to ${env}`);
        } catch (e) {
            console.error('[ConfigService] Failed to save selected environment', e);
        }
    }

    public getAllowEnvSwitch(): boolean {
        return this.config.allowEnvSwitch;
    }

    public getEndpoints(): EnvEndpoints {
        return this.config.envs[this.currentEnv] || this.config.envs.prod;
    }

    public getApiBaseUrl(): string {
        return this.getEndpoints().apiBaseUrl;
    }

    public getWsUrl(): string {
        return this.getEndpoints().wsUrl;
    }

    // --- PIN Protection ---

    public async isPinOk(): Promise<boolean> {
        try {
            const val = await AsyncStorage.getItem(KEYS.ENV_PIN_OK);
            if (!val) return false;

            const timestamp = parseInt(val, 10);
            if (isNaN(timestamp)) return false;

            const now = Date.now();
            if (now - timestamp > this.PIN_VALIDITY_MS) {
                // Expired
                await AsyncStorage.removeItem(KEYS.ENV_PIN_OK);
                return false;
            }

            return true;
        } catch (e) {
            return false;
        }
    }

    public async setPinOk(): Promise<void> {
        try {
            await AsyncStorage.setItem(KEYS.ENV_PIN_OK, Date.now().toString());
        } catch (e) {
            console.error('[ConfigService] Failed to save PIN OK state');
        }
    }

    // --- Listeners ---

    public addListener = (listener: ConfigListener) => {
        this.listeners.add(listener);
    }

    public removeListener = (listener: ConfigListener) => {
        this.listeners.delete(listener);
    }

    private notifyListeners = () => {
        for (const listener of this.listeners) {
            try {
                listener();
            } catch (e) {
                console.error('[ConfigService] Error in listener', e);
            }
        }
    }
}

export const ConfigService = new ConfigServiceClass();
