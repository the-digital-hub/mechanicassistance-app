import { FileText, Upload } from 'lucide-react-native';
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
}: DocumentUploadCardProps) {
  const { t } = useTranslation();
  const status = document?.status ? STATUS_STYLES[document.status] : null;

  return (
    <View
      className="bg-white rounded-2xl p-4 mb-4 border"
      style={{ borderColor: '#E1EAFB' }}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center flex-1 mr-2">
          <FileText size={18} color="#0047AB" />
          <Text
            className="font-outfit-medium text-[#0F172A] text-base ml-2"
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
              className="font-outfit-bold text-[10px] tracking-widest"
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
            className="flex-row items-center rounded-xl px-3 py-3"
            style={{ backgroundColor: '#F4F8FF' }}
          >
            <FileText size={20} color="#0047AB" />
            <View className="flex-1 ml-3">
              <Text
                className="font-outfit-medium text-[#0F172A] text-sm"
                numberOfLines={1}
              >
                {document.originalName || document.fileKey}
              </Text>
              <Text className="font-outfit-regular text-gray-400 text-xs mt-0.5">
                {uploading
                  ? t('setup.legalDocs.uploading')
                  : t('setup.legalDocs.replace')}
              </Text>
            </View>
            {uploading && <ActivityIndicator size="small" color="#0047AB" />}
          </TouchableOpacity>

          {document.declineReason && (
            <Text className="font-outfit-regular text-red-500 text-xs mt-2">
              {document.declineReason}
            </Text>
          )}

          <TouchableOpacity
            onPress={onRemove}
            disabled={uploading}
            activeOpacity={0.8}
            className="mt-3"
          >
            <Text className="font-outfit-medium text-red-500 text-sm">
              {t('setup.legalDocs.remove')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          onPress={onPick}
          disabled={uploading}
          activeOpacity={0.8}
          className="border-2 border-dashed border-gray-200 rounded-xl p-8 items-center justify-center bg-gray-50/30"
        >
          {uploading ? (
            <>
              <ActivityIndicator color="#0047AB" />
              <Text className="text-gray-500 font-outfit-medium text-xs text-center mt-2">
                {t('setup.legalDocs.uploading')}
              </Text>
            </>
          ) : (
            <>
              <View className="w-12 h-12 bg-blue-100 rounded-full justify-center items-center mb-2">
                <Upload size={24} color="#0047AB" />
              </View>
              <Text className="text-gray-500 font-outfit-medium text-xs text-center">
                {t('setup.legalDocs.dropzone')}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {error && (
        <Text className="font-outfit-regular text-red-500 text-xs mt-2">
          {error}
        </Text>
      )}
    </View>
  );
}
