import { Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { DocumentUploadCard } from '@/components/ui/DocumentUploadCard';
import type { LegalDocument, LegalDocumentType } from '@/lib/dao/interfaces';
import { mechanicDocumentsDAO } from '@/lib/dao/MechanicDocumentsDAO';
import { pickAndUploadLegalDocument } from '@/lib/legal-documents';

const DOCUMENT_TYPES: { type: LegalDocumentType; labelKey: string }[] = [
  { type: 'LIABILITY_INSURANCE', labelKey: 'setup.legalDocs.insurance' },
  { type: 'BUSINESS_LICENSE', labelKey: 'setup.legalDocs.businessLicense' },
];

/**
 * Legal documents from the profile: what is on file, and how to replace or
 * remove it.
 *
 * This is the "you can do it later" half of the promise the signup step makes.
 * Unlike that step, uploads here persist immediately — there is no "finish"
 * button to defer them to.
 */
export default function LegalDocumentsScreen() {
  const { t } = useTranslation();

  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<LegalDocumentType | null>(null);
  const [errors, setErrors] = useState<
    Partial<Record<LegalDocumentType, string>>
  >({});
  const [pendingRemoval, setPendingRemoval] = useState<LegalDocument | null>(
    null,
  );

  useEffect(() => {
    (async () => {
      try {
        setDocuments(await mechanicDocumentsDAO.list());
      } catch {
        // A failed read leaves the cards empty rather than blocking the screen:
        // uploading again is harmless, since the server upserts by type.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const documentFor = (type: LegalDocumentType) =>
    documents.find((doc) => doc.type === type) ?? null;

  const handlePick = async (type: LegalDocumentType) => {
    setErrors((prev) => ({ ...prev, [type]: undefined }));
    setBusy(type);

    try {
      const result = await pickAndUploadLegalDocument(type);

      if (result.status === 'error') {
        setErrors((prev) => ({
          ...prev,
          [type]: t(result.errorKey, result.errorParams),
        }));
        return;
      }
      if (result.status === 'cancelled') return;

      const stored = await mechanicDocumentsDAO.upsert(result.document);
      setDocuments((prev) => [
        ...prev.filter((doc) => doc.type !== type),
        stored,
      ]);
    } catch {
      setErrors((prev) => ({
        ...prev,
        [type]: t('setup.legalDocs.errorUpload'),
      }));
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async () => {
    const target = pendingRemoval;
    setPendingRemoval(null);
    if (!target?.id) return;

    setBusy(target.type);
    try {
      await mechanicDocumentsDAO.remove(target.id);
      setDocuments((prev) => prev.filter((doc) => doc.id !== target.id));
    } catch {
      setErrors((prev) => ({
        ...prev,
        [target.type]: t('setup.legalDocs.errorUpload'),
      }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <ConfirmationModal
        visible={pendingRemoval !== null}
        title={t('setup.legalDocs.removeConfirmTitle')}
        message={t('setup.legalDocs.removeConfirmBody')}
        icon={Trash2}
        confirmText={t('setup.legalDocs.remove')}
        cancelText={t('setup.legalDocs.cancel')}
        confirmButtonColor="#EF4444"
        onConfirm={handleRemove}
        onClose={() => setPendingRemoval(null)}
      />

      <ScrollView
        style={{ backgroundColor: '#F6F8FC' }}
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
      >
        {/* Section Badge */}
        <View
          className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full"
          style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}
        >
          <View
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: '#0047AB' }}
          />
          <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
            {t('setup.legalDocs.badge')}
          </Text>
        </View>

        <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
          {t('setup.legalDocs.profileTitle')}
        </Text>

        <Text className="text-gray-500 font-outfit-regular text-base mb-8">
          {t('setup.legalDocs.profileSubtitle')}
        </Text>

        {loading ? (
          <ActivityIndicator color="#0047AB" />
        ) : (
          <>
            {DOCUMENT_TYPES.map(({ type, labelKey }) => (
              <DocumentUploadCard
                key={type}
                label={t(labelKey)}
                document={documentFor(type)}
                uploading={busy === type}
                error={errors[type] ?? null}
                onPick={() => handlePick(type)}
                onRemove={() => setPendingRemoval(documentFor(type))}
              />
            ))}

            {documents.length === 0 && (
              <Text className="text-gray-400 font-outfit-regular text-xs text-center mt-2">
                {t('setup.legalDocs.profileEmpty')}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}
