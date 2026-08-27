import * as DocumentPicker from 'expo-document-picker';

import type { LegalDocument, LegalDocumentType } from './dao/interfaces';
import { mediaDAO } from './dao/MediaDAO';

/** Mirrors MAX_UPLOAD_BYTES.document in media-service, which answers 413 above it. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** Mirrors isAcceptedDocument() in media-service, which answers 415 for anything else. */
const ACCEPTED_MIME =
  /^(application\/pdf|image\/(jpe?g|png|gif|heic|heif|webp))$/;

const PICKER_TYPES = ['application/pdf', 'image/*'];

export type PickLegalDocumentResult =
  | { status: 'cancelled' }
  | { status: 'ok'; document: LegalDocument }
  /** `errorKey` is an i18n key; `errorParams` its interpolation values. */
  | {
      status: 'error';
      errorKey: string;
      errorParams?: Record<string, string | number>;
    };

/**
 * Lets the mechanic pick a PDF or an image and uploads it to media-service.
 *
 * Size and type are checked here as well as server-side: a 10 MB upload that
 * gets rejected on arrival wastes the mechanic's data, and on a phone that is
 * their own data.
 *
 * Returns the uploaded document — not yet recorded anywhere. The caller decides
 * whether that means "stash it in setup progress" (signup) or "POST it"
 * (profile), which is the only difference between the two screens.
 */
export async function pickAndUploadLegalDocument(
  type: LegalDocumentType,
): Promise<PickLegalDocumentResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: PICKER_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (picked.canceled) return { status: 'cancelled' };

  const asset = picked.assets?.[0];
  if (!asset?.uri) {
    return { status: 'error', errorKey: 'setup.legalDocs.errorUpload' };
  }

  // Android's picker can report an octet-stream for a perfectly good PDF, so an
  // unknown MIME is deferred to the extension rather than rejected outright.
  const mimeType = asset.mimeType;
  if (mimeType && !ACCEPTED_MIME.test(mimeType)) {
    return { status: 'error', errorKey: 'setup.legalDocs.errorType' };
  }

  if (asset.size && asset.size > MAX_DOCUMENT_BYTES) {
    return {
      status: 'error',
      errorKey: 'setup.legalDocs.errorTooLarge',
      errorParams: {
        size: (asset.size / (1024 * 1024)).toFixed(1),
        max: MAX_DOCUMENT_BYTES / (1024 * 1024),
      },
    };
  }

  try {
    const uploaded = await mediaDAO.uploadDocument(asset.uri, {
      name: asset.name,
      mimeType,
    });

    return {
      status: 'ok',
      document: {
        type,
        fileKey: uploaded.key,
        fileUrl: uploaded.url,
        ...(asset.name && { originalName: asset.name }),
        ...(mimeType && { mimeType }),
        ...(asset.size !== undefined && { sizeBytes: asset.size }),
      },
    };
  } catch {
    return { status: 'error', errorKey: 'setup.legalDocs.errorUpload' };
  }
}
