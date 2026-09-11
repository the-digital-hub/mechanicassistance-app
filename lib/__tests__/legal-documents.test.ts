import { uploadTypeFor } from '@/lib/legal-documents';

// `uploadTypeFor` is pure, but it lives beside the upload it serves — and that
// module reaches the API client and, through it, AsyncStorage. The library ships
// this mock for exactly that: a unit test that never touches storage should not
// have to boot the native module to run. Written below the import because Jest
// hoists `jest.mock` above it anyway, and `require` is the only thing allowed
// inside the factory, which cannot close over anything.
jest.mock('@react-native-async-storage/async-storage', () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

/**
 * This mapping is the whole reason a certificate gets read at all: without the
 * type, media-service stores the file under a flat key, no S3 event fires, and
 * the document service never sees it. The failure mode is silence — the upload
 * succeeds and nothing happens — which is exactly why it is worth a test.
 */
describe('uploadTypeFor', () => {
    it('asks for an insurance certificate to be read', () => {
        expect(uploadTypeFor('LIABILITY_INSURANCE')).toBe('insurance');
    });

    // Not an oversight. Nothing reads a business licence today, and
    // media-service answers 400 for a type it does not recognise rather than
    // filing it plain — so the right value here is no value.
    it('sends no type for a business licence, which nothing reads', () => {
        expect(uploadTypeFor('BUSINESS_LICENSE')).toBeUndefined();
    });

    // The value has to match DOCUMENT_TYPES in media-service verbatim. It is
    // deliberately not the app's own `LIABILITY_INSURANCE`, and a mismatch is a
    // 400 on upload.
    it('uses the value media-service accepts, not the app-side name', () => {
        expect(uploadTypeFor('LIABILITY_INSURANCE')).not.toBe(
            'LIABILITY_INSURANCE',
        );
    });
});
