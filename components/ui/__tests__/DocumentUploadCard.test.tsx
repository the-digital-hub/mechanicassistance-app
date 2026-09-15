import React from 'react';
import { render } from '@testing-library/react-native';

import { DocumentUploadCard } from '../DocumentUploadCard';
import type { LegalDocument } from '@/lib/dao/interfaces';

// The card only ever calls t() for its own fixed strings, so echoing the key
// back keeps these assertions about the note, which is passed in already
// translated.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const NOTE = 'We will read your policy when you finish signing up.';

const uploaded = {
  type: 'LIABILITY_INSURANCE',
  fileKey: 'document-1-2.pdf',
  originalName: 'certificate.pdf',
  fileUrl: 'https://example.test/uploads/document-1-2.pdf',
} as LegalDocument;

const baseProps = {
  label: 'Liability insurance',
  onPick: jest.fn(),
  onRemove: jest.fn(),
};

describe('DocumentUploadCard', () => {
  it('shows the note under a file that is on record', () => {
    const { getByText } = render(
      <DocumentUploadCard {...baseProps} document={uploaded} note={NOTE} />,
    );
    expect(getByText(NOTE)).toBeTruthy();
  });

  it('shows no note when the caller has nothing to say', () => {
    // The business licence goes down this path: nothing reads it, so promising
    // a reading there would be a lie.
    const { queryByText } = render(
      <DocumentUploadCard {...baseProps} document={uploaded} />,
    );
    expect(queryByText(NOTE)).toBeNull();
  });

  it('shows no note on an empty dropzone, even if one is passed', () => {
    // Nothing has been uploaded, so there is no file for the note to be about.
    const { queryByText } = render(
      <DocumentUploadCard {...baseProps} document={null} note={NOTE} />,
    );
    expect(queryByText(NOTE)).toBeNull();
  });

  it('keeps showing a decline reason alongside the note', () => {
    // The two are not alternatives: a file can carry both.
    const declined = { ...uploaded, declineReason: 'Expired policy' };
    const { getByText } = render(
      <DocumentUploadCard
        {...baseProps}
        document={declined as LegalDocument}
        note={NOTE}
      />,
    );
    expect(getByText(NOTE)).toBeTruthy();
    expect(getByText('Expired policy')).toBeTruthy();
  });
});
