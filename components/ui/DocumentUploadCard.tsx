import { FileText, Info, Trash2, Upload } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

import type { LegalDocument, LegalDocumentStatus } from '@/lib/dao/interfaces';

interface DocumentUploadCardProps {
  /** Card heading, e.g. t('setup.legalDocs.insurance') */
  label: string;
  /** The document already on file, if any */
  document?: LegalDocument | null;
  onPick: () => void;
  onRemove: () => void;
  uploading?: boolean;
  /** Per-card error, so one failed pick does not disturb the other card */
  error?: string | null;
  /**
   * A line about what happens to this file next, shown under it once there is
   * one. The caller decides whether there is anything to say — only the
   * insurance certificate is ever read, so the same note on the business
   * licence would promise something that never happens.
   */
  note?: string | null;
}

const STATUS_STYLES: Record<
  LegalDocumentStatus,
  { bg: string; color: string; key: string }
> = {
  pending: {
    bg: '#E9F1FF',
    color: '#0047AB',
    key: 'setup.legalDocs.statusPending',
  },
  approved: {
    bg: '#D1FAE5',
    color: '#047857',
    key: 'setup.legalDocs.statusApproved',
  },
  declined: {
    bg: '#FEE2E2',
    color: '#EF4444',
    key: 'setup.legalDocs.statusDeclined',
  },
};

/**
 * One legal document: an empty dropzone, or the file on record with its review
 * status and a way to replace or remove it.
 *
 * Shared by the signup step and the profile screen. `status` only ever arrives
 * from the profile screen — during signup nothing has been reviewed yet, so
 * showing "under review" there would be a lie.
 */
export function DocumentUploadCard({
  label,
  document,
  onPick,
  onRemove,
  uploading = false,
  error = null,
  note = null,
}: DocumentUploadCardProps) {
  const { t } = useTranslation();
  const status = document?.status ? STATUS_STYLES[document.status] : null;

  return (
    <View
      style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#EEF2FA', shadowColor: '#0E2F8A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 }}
    >
      <View className="flex-row items-center justify-between mb-3">
        {/* The title alone: no icon in front of it, like the other card titles of the app */}
        <View className="flex-row items-center flex-1 mr-2">
          <Text
            className="font-outfit-bold text-[#0B1530]" style={{ fontSize: 17, lineHeight: 23 }}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>

        {status && (
          <View
            className="px-2 py-0.5 rounded-md"
            style={{ backgroundColor: status.bg }}
          >
            <Text
              className="font-outfit-bold text-[12px] tracking-widest"
              style={{ color: status.color }}
            >
              {t(status.key).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {document ? (
        <View>
          <TouchableOpacity
            onPress={onPick}
            disabled={uploading}
            activeOpacity={0.8}
            className="flex-row items-center px-3 py-3"
            style={{ backgroundColor: '#F4F8FF', borderRadius: 14 }}
          >
            <FileText size={20} color="#0047AB" />
            <View className="flex-1 ml-3">
              <Text
                className="font-outfit-bold text-[#0B1530]" style={{ fontSize: 16, lineHeight: 22 }}
                numberOfLines={1}
              >
                {document.originalName || document.fileKey}
              </Text>
              <Text className="font-outfit-regular mt-0.5" style={{ fontSize: 14, lineHeight: 19, color: '#6B7490' }}>
                {uploading
                  ? t('setup.legalDocs.uploading')
                  : t('setup.legalDocs.replace')}
              </Text>
            </View>
            {uploading && <ActivityIndicator size="small" color="#0047AB" />}
          </TouchableOpacity>

          {note && (
            <View className="flex-row items-start mt-2">
              <Info size={13} color="#0047AB" style={{ marginTop: 1 }} />
              <Text className="font-outfit-regular text-[#0047AB] text-[13px] ml-1.5 flex-1">
                {note}
              </Text>
            </View>
          )}

          {document.declineReason && (
            <Text className="font-outfit-regular text-red-500 text-[13px] mt-2">
              {document.declineReason}
            </Text>
          )}

          <TouchableOpacity
            onPress={onRemove}
            disabled={uploading}
            activeOpacity={0.8}
            accessibilityRole="button"
            className="mt-3 flex-row items-center self-start"
            style={{ gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#FEE2E2' }}
          >
            <Trash2 size={14} color="#DC2626" />
            <Text className="font-outfit-bold" style={{ fontSize: 14, color: '#DC2626' }}>
              {t('setup.legalDocs.remove')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        // No dashed grey box: the hint and a real button, as in the rest of the app's upload slots.
        <View style={{ gap: 14 }}>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <View
              className="items-center justify-center"
              style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#EAF1FF' }}
            >
              <Upload size={22} color="#1E56E3" />
            </View>
            <Text
              className="flex-1 font-outfit-regular"
              style={{ fontSize: 14, lineHeight: 20, color: '#6B7490' }}
            >
              {t('setup.legalDocs.dropzone')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onPick}
            disabled={uploading}
            activeOpacity={0.85}
            accessibilityRole="button"
            className="flex-row items-center justify-center"
            style={{ gap: 8, minHeight: 56, borderRadius: 14, backgroundColor: '#1E56E3', opacity: uploading ? 0.7 : 1 }}
            testID="legal-doc-upload"
          >
            {uploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Upload size={20} color="#FFFFFF" />
            )}
            <Text className="font-outfit-bold" style={{ fontSize: 16, color: '#FFFFFF' }}>
              {uploading ? t('setup.legalDocs.uploading') : t('setup.legalDocs.uploadButton')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {error && (
        <Text className="font-outfit-regular text-red-500 text-[13px] mt-2">
          {error}
        </Text>
      )}
    </View>
  );
}
