import { mediaDAO } from "@/lib/dao/MediaDAO";
import { saveSetupProgress } from "@/lib/storage";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

// ─── Types ────────────────────────────────────────────────────────────────────

type Side = "front" | "back";

interface UploadedImage {
  localUri: string;
  remoteUrl: string;
  remoteKey: string;
}

// Canonical values sent to the backend — kept in English regardless of UI language.
const DOCUMENT_TYPES = [
  "Driving Licence",
  "Passport",
  "Residence Permit",
  "National ID",
];
const DOCUMENT_TYPE_KEYS = [
  "drivingLicence",
  "passport",
  "residencePermit",
  "nationalId",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function pickFromCamera(t: (key: string) => string): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      t("setup.identity.permissionRequiredTitle"),
      t("setup.identity.permissionRequiredMessage"),
    );
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    quality: 0.85,
    base64: false,
  });
  return result.canceled ? null : result.assets[0].uri;
}

async function pickFromGallery(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    quality: 0.85,
    base64: false,
  });
  return result.canceled ? null : result.assets[0].uri;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function IdentityScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [documentType, setDocumentType] = useState<string | null>(null);
  const [frontImage, setFrontImage] = useState<UploadedImage | null>(null);
  const [backImage, setBackImage] = useState<UploadedImage | null>(null);
  const [isUploading, setIsUploading] = useState<Side | null>(null);

  const documentTypeLabels = DOCUMENT_TYPE_KEYS.map((key) =>
    t(`setup.identity.docTypes.${key}`),
  );

  // ── Document type picker ────────────────────────────────────────────────────
  const handleDocTypePicker = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...documentTypeLabels, t("setup.identity.cancel")],
          cancelButtonIndex: documentTypeLabels.length,
          title: t("setup.identity.selectDocType"),
        },
        (index) => {
          if (index < DOCUMENT_TYPES.length)
            setDocumentType(DOCUMENT_TYPES[index]);
        },
      );
    } else {
      Alert.alert(
        t("setup.identity.selectDocType"),
        undefined,
        DOCUMENT_TYPES.map((type, i) => ({
          text: documentTypeLabels[i],
          onPress: () => setDocumentType(type),
        })).concat([{ text: t("setup.identity.cancel"), onPress: () => {} }]),
      );
    }
  };

  // ── Upload photo to media-service ──────────────────────────────────────────
  const uploadAndSetImage = async (localUri: string, side: Side) => {
    setIsUploading(side);
    try {
      const result = await mediaDAO.uploadPhoto(localUri);
      const uploaded: UploadedImage = {
        localUri,
        remoteUrl: result.url,
        remoteKey: result.key,
      };
      if (side === "front") {
        setFrontImage(uploaded);
      } else {
        setBackImage(uploaded);
      }
    } catch (error) {
      console.error(`Failed to upload ${side} image:`, error);
      Alert.alert(
        t("setup.identity.uploadFailedTitle"),
        t("setup.identity.uploadFailedMessage"),
      );
    } finally {
      setIsUploading(null);
    }
  };

  // ── Photo picker (camera / gallery) ────────────────────────────────────────
  const handlePickImage = (side: Side) => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t("setup.identity.takePhoto"), t("setup.identity.chooseFromGallery"), t("setup.identity.cancel")],
          cancelButtonIndex: 2,
        },
        async (index) => {
          let uri: string | null = null;
          if (index === 0) uri = await pickFromCamera(t);
          else if (index === 1) uri = await pickFromGallery();
          if (uri) await uploadAndSetImage(uri, side);
        },
      );
    } else {
      Alert.alert(t("setup.identity.addPhoto"), undefined, [
        {
          text: t("setup.identity.takePhoto"),
          onPress: async () => {
            const uri = await pickFromCamera(t);
            if (uri) await uploadAndSetImage(uri, side);
          },
        },
        {
          text: t("setup.identity.chooseFromGallery"),
          onPress: async () => {
            const uri = await pickFromGallery();
            if (uri) await uploadAndSetImage(uri, side);
          },
        },
        { text: t("setup.identity.cancel"), style: "cancel" },
      ]);
    }
  };

  // ── Continue ───────────────────────────────────────────────────────────────
  const handleContinue = async () => {
    if (!documentType) {
      Alert.alert(t("setup.identity.requiredTitle"), t("setup.identity.selectDocTypeRequired"));
      return;
    }
    if (!frontImage || !backImage) {
      Alert.alert(
        t("setup.identity.requiredTitle"),
        t("setup.identity.uploadBothSidesRequired"),
      );
      return;
    }
    await saveSetupProgress("identity", {
      documentType,
      frontImageUrl: frontImage.remoteUrl,
      backImageUrl: backImage.remoteUrl,
      frontImageKey: frontImage.remoteKey,
      backImageKey: backImage.remoteKey,
    });
    router.push("/setup/address");
  };

  // ── Photo Card ─────────────────────────────────────────────────────────────
  const PhotoCard = ({
    side,
    image,
    label,
    hint,
  }: {
    side: Side;
    image: UploadedImage | null;
    label: string;
    hint: string;
  }) => (
    <View className="mb-8">
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => handlePickImage(side)}
        disabled={isUploading === side}
        className="h-48 rounded-2xl overflow-hidden mb-2 border-2 border-dashed border-blue-200 bg-blue-50/40"
      >
        {isUploading === side ? (
          <View className="flex-1 justify-center items-center gap-3">
            <ActivityIndicator size="large" color="#0047AB" />
            <Text className="text-[#0047AB] font-outfit-medium text-sm">
              {t("setup.identity.uploading")}
            </Text>
          </View>
        ) : image ? (
          <>
            <Image
              source={{ uri: image.localUri }}
              className="w-full h-full"
              resizeMode="cover"
            />
            {/* Overlay edit badge */}
            <View className="absolute bottom-2 right-2 bg-white/90 rounded-full px-3 py-1 flex-row items-center gap-1 shadow-sm">
              <Ionicons name="pencil" size={12} color="#0047AB" />
              <Text className="text-[#0047AB] font-outfit-medium text-xs ml-1">
                {t("setup.identity.change")}
              </Text>
            </View>
          </>
        ) : (
          <View className="flex-1 justify-center items-center gap-3">
            <View className="w-16 h-16 bg-blue-100 rounded-full justify-center items-center">
              <Ionicons name="camera-outline" size={28} color="#0047AB" />
            </View>
            <Text className="text-[#0047AB] font-outfit-medium text-sm">
              {label}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Text className="text-[#0047AB] font-outfit-medium text-xs mb-3">
        {hint}
      </Text>

      <TouchableOpacity
        onPress={() => handlePickImage(side)}
        disabled={isUploading === side}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#00afcc', '#0088a3']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={{
            borderRadius: 10,
            paddingVertical: 16,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: isUploading === side ? 0.6 : 1,
          }}
        >
          <Ionicons name={image ? "refresh" : "camera"} size={16} color="white" />
          <Text className="text-white font-outfit-bold text-sm">
            {image ? t("setup.identity.retakePhoto") : t("setup.identity.takePhoto")}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={{ backgroundColor: '#F6F8FC' }}
      contentContainerStyle={{ padding: 24, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Section Badge */}
      <View className="flex-row items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full" style={{ backgroundColor: '#E9F1FF', alignSelf: 'flex-start' }}>
        <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0047AB' }} />
        <Text className="text-blue-600 font-outfit-semibold text-xs tracking-widest">
          {t("setup.identity.badge")}
        </Text>
      </View>

      {/* Title */}
      <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
        {t("setup.identity.title")}
      </Text>

      {/* Subtitle */}
      <Text className="text-gray-500 font-outfit-regular text-base mb-8">
        {t("setup.identity.subtitle")}
      </Text>

        <Text className="text-[#0F172A] font-outfit-regular text-sm mb-2">
          {t("setup.identity.acceptedDocsIntro")}
        </Text>
        <Text className="text-[#0F172A] font-outfit-regular text-sm mb-4">
          {t("setup.identity.acceptedDocsList")}
        </Text>
        <View className="pl-2 mb-2">
          <Text className="text-slate-500 font-outfit-regular text-xs mb-1">
            • {t("setup.identity.checkReadable")}
          </Text>
          <Text className="text-slate-500 font-outfit-regular text-xs mb-1">
            • {t("setup.identity.checkCorners")}
          </Text>
          <Text className="text-slate-500 font-outfit-regular text-xs mb-1">
            • {t("setup.identity.checkPhoto")}
          </Text>
          <Text className="text-slate-500 font-outfit-regular text-xs">
            • {t("setup.identity.checkMatch")}
          </Text>
        </View>

      {/* Document type selector */}
      <Text className="font-outfit-medium text-[#0F172A] mb-2">
        {t("setup.identity.identificationDocument")}
      </Text>
      <TouchableOpacity
        onPress={handleDocTypePicker}
        className="bg-white border border-gray-300 rounded-2xl flex-row items-center justify-between px-4 mb-8"
        style={{ height: 52 }}
        activeOpacity={0.7}
      >
        <Text
          className={`font-outfit-regular text-[17px] ${documentType ? "text-[#0F172A]" : "text-[#9CA3AF]"}`}
        >
          {documentType
            ? documentTypeLabels[DOCUMENT_TYPES.indexOf(documentType)]
            : t("setup.identity.selectDocTypePlaceholder")}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#0F172A" />
      </TouchableOpacity>

      {/* Photo cards */}
      <PhotoCard
        side="front"
        image={frontImage}
        label={t("setup.identity.tapAddFront")}
        hint={t("setup.identity.uploadFrontHint")}
      />
      <PhotoCard
        side="back"
        image={backImage}
        label={t("setup.identity.tapAddBack")}
        hint={t("setup.identity.uploadBackHint")}
      />

      <TouchableOpacity
        onPress={handleContinue}
        activeOpacity={0.8}
        disabled={!!isUploading}
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
            opacity: isUploading ? 0.6 : 1,
          }}
        >
          {isUploading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text className="text-white font-outfit-bold text-center mr-2">{t("setup.identity.continue")}</Text>
              <ChevronRight size={20} color="white" />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}
