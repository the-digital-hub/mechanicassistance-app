import type { ReportBrand } from '@/lib/onsite/finalReport';

export async function assetData(module: number, mime: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Asset } = require('expo-asset') as typeof import('expo-asset');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { File } = require('expo-file-system') as typeof import('expo-file-system');
    const asset = Asset.fromModule(module);
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error('asset not available');
    return `data:${mime};base64,${await new File(asset.localUri).base64()}`;
}

/** The brand (ring and name in colour) and the app's font, as data: the PDF is drawn from the page alone. Without the logo it says the name in text; without the font, the system one. */
export async function reportBrand(): Promise<ReportBrand | null> {
    try {
        const [ring, word] = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            assetData(require('@/assets/images/brand_ring_color.png'), 'image/png'),
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            assetData(require('@/assets/images/brand_wordmark_color.png'), 'image/png'),
        ]);
        const fonts = await Promise.all([
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            assetData(require('@expo-google-fonts/outfit/400Regular/Outfit_400Regular.ttf'), 'font/ttf'),
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            assetData(require('@expo-google-fonts/outfit/600SemiBold/Outfit_600SemiBold.ttf'), 'font/ttf'),
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            assetData(require('@expo-google-fonts/outfit/700Bold/Outfit_700Bold.ttf'), 'font/ttf'),
        ]).then(([regular, semibold, bold]) => ({ regular, semibold, bold })).catch(() => null);
        return { ring, word, fonts };
    } catch {
        return null;
    }
}
