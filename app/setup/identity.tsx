import { mediaDAO } from "@/lib/dao/MediaDAO";
import { saveSetupProgress } from "@/lib/storage";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
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

const DOCUMENT_TYPES = [
  "Driving Licence",
  "Passport",
  "Residence Permit",
  "National ID",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function pickFromCamera(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Permission Required",
      "Please allow camera access in your device settings to take a photo.",
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
  const [documentType, setDocumentType] = useState<string | null>(null);
  const [frontImage, setFrontImage] = useState<UploadedImage | null>(null);
  const [backImage, setBackImage] = useState<UploadedImage | null>(null);
  const [isUploading, setIsUploading] = useState<Side | null>(null);

  // ── Document type picker ────────────────────────────────────────────────────
  const handleDocTypePicker = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...DOCUMENT_TYPES, "Cancel"],
          cancelButtonIndex: DOCUMENT_TYPES.length,
          title: "Select Document Type",
        },
        (index) => {
          if (index < DOCUMENT_TYPES.length)
            setDocumentType(DOCUMENT_TYPES[index]);
        },
      );
    } else {
      Alert.alert(
        "Select Document Type",
        undefined,
        DOCUMENT_TYPES.map((type) => ({
          text: type,
          onPress: () => setDocumentType(type),
        })).concat([{ text: "Cancel", onPress: () => {} }]),
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
        "Upload Failed",
        "Could not upload the photo. Please try again.",
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
          options: ["Take Photo", "Choose from Gallery", "Cancel"],
          cancelButtonIndex: 2,
        },
        async (index) => {
          let uri: string | null = null;
          if (index === 0) uri = await pickFromCamera();
          else if (index === 1) uri = await pickFromGallery();
          if (uri) await uploadAndSetImage(uri, side);
        },
      );
    } else {
      Alert.alert("Add Photo", undefined, [
        {
          text: "Take Photo",
          onPress: async () => {
            const uri = await pickFromCamera();
            if (uri) await uploadAndSetImage(uri, side);
          },
        },
        {
          text: "Choose from Gallery",
          onPress: async () => {
            const uri = await pickFromGallery();
            if (uri) await uploadAndSetImage(uri, side);
          },
        },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  // ── Continue ───────────────────────────────────────────────────────────────
  const handleContinue = async () => {
    if (!documentType) {
      Alert.alert("Required", "Please select a document type.");
      return;
    }
    if (!frontImage || !backImage) {
      Alert.alert(
        "Required",
        "Please upload both the front and back of your document.",
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
              Uploading...
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
                Change
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
            {image ? "Retake photo" : "Take photo"}
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
          IDENTITY VERIFICATION
        </Text>
      </View>

      {/* Title */}
      <Text className="text-gray-900 font-outfit-medium text-3xl mb-3">
        Identity Document
      </Text>

      {/* Subtitle */}
      <Text className="text-gray-500 font-outfit-regular text-base mb-8">
        Upload clear photos of both sides of your identity document
      </Text>

        <Text className="text-[#0F172A] font-outfit-regular text-sm mb-2">
          The following documents are accepted:
        </Text>
        <Text className="text-[#0F172A] font-outfit-regular text-sm mb-4">
          (1) Driving Licence{"\n"}
          (2) Passport{"\n"}
          (3) Residence Permit{"\n"}
          (4) National ID. Also, please ensure:
        </Text>
        <View className="pl-2 mb-2">
          <Text className="text-slate-500 font-outfit-regular text-xs mb-1">
            • All information is readable and image is not blurry.
          </Text>
          <Text className="text-slate-500 font-outfit-regular text-xs mb-1">
            • All corners of the document are visible.
          </Text>
          <Text className="text-slate-500 font-outfit-regular text-xs mb-1">
            • We can see a picture of you.
          </Text>
          <Text className="text-slate-500 font-outfit-regular text-xs">
            • Information must match the back of the document.
          </Text>
        </View>

      {/* Document type selector */}
      <Text className="font-outfit-medium text-[#0F172A] mb-2">
        Identification document
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
          {documentType ?? "Select document type"}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#0F172A" />
      </TouchableOpacity>

      {/* Photo cards */}
      <PhotoCard
        side="front"
        image={frontImage}
        label="Tap to add front side"
        hint="Upload photo of the FRONT of your Identity Document."
      />
      <PhotoCard
        side="back"
        image={backImage}
        label="Tap to add back side"
        hint="Upload photo of the BACK of your Identity Document."
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
              <Text className="text-white font-outfit-bold text-center mr-2">Continue</Text>
              <ChevronRight size={20} color="white" />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}
