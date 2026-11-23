import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';

import { SETUP_BG, SetupFooter, SetupHeading } from '@/components/setup/SetupKit';
import { TYPE } from '@/lib/ui/type';
import { DocumentUploadCard } from '@/components/ui/DocumentUploadCard';
import type { LegalDocument, LegalDocumentType } from '@/lib/dao/interfaces';
import { pickAndUploadLegalDocument } from '@/lib/legal-documents';
import { getSetupProgress, saveSetupProgress } from '@/lib/storage';

const DOCUMENT_TYPES: { type: LegalDocumentType; labelKey: string }[] = [
  { type: 'LIABILITY_INSURANCE', labelKey: 'setup.legalDocs.insurance' },
  { type: 'BUSINESS_LICENSE', labelKey: 'setup.legalDocs.businessLicense' },
];

/**
 * Last step of the mechanic wizard: liability insurance and business licence.
 *
 * Entirely optional — the CTA stays enabled with nothing uploaded, and the
 * notice below the cards says so. What is picked here is already in
 * media-service; the database rows are created by POST /api/users on the
 * success screen, because until then there is no account to attach them to.
 */
export default function LegalDocumentsScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [uploading, setUploading] = useState<LegalDocumentType | null>(null);
  const [errors, setErrors] = useState<
    Partial<Record<LegalDocumentType, string>>
  >({});

  // Rehydrate on mount, like every other step: the mechanic may have come back
  // from `success` or reopened the app mid-registration.
  useEffect(() => {
    (async () => {
      const progress = await getSetupProgress();
      const saved = progress?.legalDocuments;
      if (Array.isArray(saved)) setDocuments(saved);
    })();
  }, []);

  const documentFor = (type: LegalDocumentType) =>
    documents.find((doc) => doc.type === type) ?? null;

  const handlePick = async (type: LegalDocumentType) => {
    setErrors((prev) => ({ ...prev, [type]: undefined }));
    setUploading(type);

    try {
      const result = await pickAndUploadLegalDocument(type);

      if (result.status === 'error') {
        setErrors((prev) => ({
          ...prev,
          [type]: t(result.errorKey, result.errorParams),
        }));
        return;
      }

      if (result.status === 'ok') {
        // Replace whatever was there for this type — one document per type.
        setDocuments((prev) => [
          ...prev.filter((doc) => doc.type !== type),
          result.document,
        ]);
      }
    } finally {
      setUploading(null);
    }
  };

  const handleRemove = (type: LegalDocumentType) => {
    setErrors((prev) => ({ ...prev, [type]: undefined }));
    setDocuments((prev) => prev.filter((doc) => doc.type !== type));
  };

  const handleSubmit = async () => {
    // Saved even when empty, so `lastStep` advances and a resume does not drop
    // the mechanic back here after they deliberately skipped it.
    await saveSetupProgress('legalDocuments', documents);
    router.push('/setup/success');
  };

  return (
    <View className="flex-1" style={{ backgroundColor: SETUP_BG }}>
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 20, paddingTop: 18, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <SetupHeading screen="legal-documents" badge={t('setup.legalDocs.badge')} title={t('setup.legalDocs.title')} subtitle={t('setup.legalDocs.subtitle')} />

      {DOCUMENT_TYPES.map(({ type, labelKey }) => (
        <DocumentUploadCard
          key={type}
          label={t(labelKey)}
          document={documentFor(type)}
          uploading={uploading === type}
          error={errors[type] ?? null}
          // Only the insurance certificate is ever read, and only once the
          // account exists — what is picked here is still filed under nobody,
          // so the promise is in the future tense and there is nothing to show
          // yet. The licence gets no note because nothing reads it.
          note={
            type === 'LIABILITY_INSURANCE' && documentFor(type)
              ? t('setup.legalDocs.insuranceReadNotice')
              : null
          }
          onPick={() => handlePick(type)}
          onRemove={() => handleRemove(type)}
        />
      ))}

      {/* "You can do this later": the quiet alert used across the registration */}
      <View
        className="flex-row"
        style={{ gap: 10, paddingVertical: 12, paddingHorizontal: 14, marginTop: 4, borderRadius: 14, borderWidth: 1, borderColor: '#E1EAFB', backgroundColor: '#F4F8FF' }}
      >
        <ShieldCheck size={18} color="#1E56E3" style={{ marginTop: 2 }} />
        <Text className="font-outfit-regular flex-1" style={{ ...TYPE.helper, color: '#6B7490' }}>
          {t('setup.legalDocs.noticeBody', { cta: t('setup.legalDocs.submit') })}
        </Text>
      </View>

    </ScrollView>

    {/* Finish is never disabled by an empty list: the step is optional (only while a file is uploading). */}
    <SetupFooter
      label={t('setup.legalDocs.submit')}
      onPress={handleSubmit}
      disabled={uploading !== null}
    />
    </View>
  );
}
