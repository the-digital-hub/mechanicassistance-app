import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

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

      {/* Title */}
      <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
        {t('setup.legalDocs.title')}
      </Text>

      {/* Subtitle */}
      <Text className="text-gray-500 font-outfit-regular text-base mb-8">
        {t('setup.legalDocs.subtitle')}
      </Text>

      {DOCUMENT_TYPES.map(({ type, labelKey }) => (
        <DocumentUploadCard
          key={type}
          label={t(labelKey)}
          document={documentFor(type)}
          uploading={uploading === type}
          error={errors[type] ?? null}
          onPick={() => handlePick(type)}
          onRemove={() => handleRemove(type)}
        />
      ))}

      {/* "You can do this later" notice */}
      <View
        className="flex-row rounded-2xl p-4 mt-2 mb-8 border"
        style={{ backgroundColor: '#F4F8FF', borderColor: '#E1EAFB' }}
      >
        <ShieldCheck size={20} color="#0047AB" />
        <View className="flex-1 ml-3">
          <Text className="font-outfit-medium text-[#0F172A] text-sm mb-1">
            {t('setup.legalDocs.noticeTitle')}
          </Text>
          <Text className="font-outfit-regular text-gray-500 text-xs leading-5">
            {t('setup.legalDocs.noticeBody', {
              cta: t('setup.legalDocs.submit'),
            })}
          </Text>
        </View>
      </View>

      {/* Back / Finish. Finish is never disabled: the step is optional. */}
      <View className="flex-row items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.8}
          disabled={uploading !== null}
          style={{ flex: 0.3 }}
        >
          <Text className="text-gray-500 font-outfit-medium text-center">
            {t('setup.legalDocs.back')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSubmit}
          activeOpacity={0.8}
          disabled={uploading !== null}
          style={{ flex: 0.7 }}
        >
          <LinearGradient
            colors={['#2B66F8', '#081E72']}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 10,
              paddingVertical: 16,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: uploading !== null ? 0.6 : 1,
            }}
          >
            <Text className="text-white font-outfit-bold text-center">
              {t('setup.legalDocs.submit')}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
