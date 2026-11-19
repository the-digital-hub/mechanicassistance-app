import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import { CertificationForm } from '../CertificationForm';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('lucide-react-native', () => ({ ChevronRight: 'ChevronRight', Check: 'Check', Plus: 'Plus', List: 'List' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
jest.mock('@/lib/api/apiClient', () => ({ apiClient: {} }));
jest.mock('@/lib/dao/MediaDAO', () => ({ mediaDAO: { uploadDocument: jest.fn() } }));
jest.mock('@/lib/dao/CertificationsDAO', () => ({
    ...jest.requireActual('@/lib/dao/CertificationsDAO'),
    certificationsDAO: { create: jest.fn(), update: jest.fn() },
}));
jest.mock('@/lib/vehicle', () => ({ fetchMakes: jest.fn().mockResolvedValue(['Audi', 'BMW']) }));
jest.mock('@/lib/legal-documents', () => ({ MAX_DOCUMENT_BYTES: 10 * 1024 * 1024 }));

describe('certification form', () => {
    it('asks who issued it and the type of certification for every kind', () => {
        const tree = render(<CertificationForm initial={null} onSaved={() => undefined} />);
        expect(tree.queryByTestId('cert-issuer')).not.toBeNull();
        expect(tree.queryByTestId('cert-name')).not.toBeNull();
        // The same two fields stay for every type; what changes is their label and the example badges.
        fireEvent.press(tree.getByTestId('cert-type-industry'));
        expect(tree.queryByTestId('cert-issuer')).not.toBeNull();
        expect(tree.queryByTestId('cert-name')).not.toBeNull();
    });

    it('picks the expiry from a month and year, and can clear it', () => {
        const tree = render(<CertificationForm initial={null} onSaved={() => undefined} />);
        expect(tree.queryByTestId('cert-expiry-picker')).toBeNull();
        fireEvent.press(tree.getByTestId('cert-expiry'));
        expect(tree.queryByTestId('cert-expiry-picker')).not.toBeNull();
        fireEvent.press(tree.getByTestId('cert-month-3'));
        expect(tree.queryByTestId('cert-expiry-picker')).toBeNull();
        expect(tree.queryByTestId('cert-expiry-clear')).not.toBeNull();
        fireEvent.press(tree.getByTestId('cert-expiry-clear'));
        expect(tree.queryByTestId('cert-expiry-clear')).toBeNull();
    });
});
