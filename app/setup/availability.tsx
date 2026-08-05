import { Button } from "@/components/ui/Button";
import { saveSetupProgress } from "@/lib/storage";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  FlatList,
  Modal,
  PanResponder,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import { MAP_PROVIDER } from "@/lib/maps/provider";

// ── Types ──────────────────────────────────────────────────────────────────
type TimePickerField = "from" | "to";

// ── Helpers ────────────────────────────────────────────────────────────────
const TIMES: string[] = (() => {
  const result: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const period = h < 12 ? "AM" : "PM";
      const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const min = m === 0 ? "00" : "30";
      result.push(`${hour.toString().padStart(2, "0")}:${min} ${period}`);
    }
  }
  return result;
})();

// ── Constants ──────────────────────────────────────────────────────────────
const DAYS: { label: string; key: string }[] = [
  { label: "M", key: "Monday" },
  { label: "T", key: "Tuesday" },
  { label: "W", key: "Wednesday" },
  { label: "T", key: "Thursday" },
  { label: "F", key: "Friday" },
  { label: "S", key: "Saturday" },
  { label: "S", key: "Sunday" },
];

const DEFAULT_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const RADIUS_MIN = 1;
const RADIUS_MAX = 50;
const BASE_LOCATION = {
  latitude: 33.4484,
  longitude: -112.074,
  address: "2418 Sunset Blvd · Phoenix, AZ",
};

// ── Time picker modal ──────────────────────────────────────────────────────
function TimePickerModal({
  visible,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: string;
  onSelect: (t: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableOpacity
        className="flex-1 bg-black/40"
        activeOpacity={1}
        onPress={onClose}
      />
      <View className="bg-white rounded-t-3xl pb-8">
        {/* Handle */}
        <View className="items-center pt-3 pb-2">
          <View className="w-10 h-1 rounded-full bg-[#E2E8F0]" />
        </View>

        <View className="flex-row justify-between items-center px-5 pb-3">
          <Text className="text-[#0F172A] font-outfit-bold text-base">
            Select time
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-[#0047AB] font-outfit-bold text-sm">
              Done
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={TIMES}
          keyExtractor={(item) => item}
          style={{ maxHeight: 280 }}
          showsVerticalScrollIndicator={false}
          initialScrollIndex={Math.max(0, TIMES.indexOf(selected))}
          getItemLayout={(_, index) => ({
            length: 52,
            offset: 52 * index,
            index,
          })}
          renderItem={({ item }) => {
            const isSelected = item === selected;
            return (
              <TouchableOpacity
                className={`flex-row items-center justify-between px-5 h-[52px] ${
                  isSelected ? "bg-[#EEF2FF]" : ""
                }`}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              >
                <View className="flex-row items-center gap-3">
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={isSelected ? "#0047AB" : "#94A3B8"}
                  />
                  <Text
                    className={`font-outfit-medium text-base ${
                      isSelected ? "text-[#0047AB]" : "text-[#0F172A]"
                    }`}
                  >
                    {item}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark" size={18} color="#0047AB" />
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────
export default function AvailabilityScreen() {
  const router = useRouter();

  const [selectedDays, setSelectedDays] = useState<string[]>(DEFAULT_DAYS);
  const [applySameTime, setApplySameTime] = useState(true);
  const [startTime, setStartTime] = useState("09:00 AM");
  const [endTime, setEndTime] = useState("05:00 PM");
  const [pickerField, setPickerField] = useState<TimePickerField | null>(null);

  const [serviceRadius, setServiceRadius] = useState(15);
  const trackWidth = useRef(0);
  const trackPageX = useRef(0);

  const toggleDay = (key: string) => {
    setSelectedDays((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key],
    );
  };

  const openPicker = (field: TimePickerField) => setPickerField(field);
  const closePicker = () => setPickerField(null);
  const handleSelectTime = (time: string) => {
    if (pickerField === "from") setStartTime(time);
    else setEndTime(time);
  };

  const updateRadius = (pageX: number) => {
    const x = pageX - trackPageX.current;
    const clamped = Math.max(0, Math.min(x, trackWidth.current));
    const value = Math.round(
      RADIUS_MIN + (clamped / trackWidth.current) * (RADIUS_MAX - RADIUS_MIN),
    );
    setServiceRadius(value);
  };

  const sliderPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => updateRadius(e.nativeEvent.pageX),
      onPanResponderMove: (e) => updateRadius(e.nativeEvent.pageX),
    }),
  ).current;

  const thumbPercent =
    ((serviceRadius - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN)) * 100;

  const mapDelta = Math.max(0.04, (serviceRadius / RADIUS_MAX) * 0.6);

  const handleSave = async () => {
    await saveSetupProgress("availability", {
      selectedDays,
      startTime,
      endTime,
      applySameTime,
      serviceRadius,
    });
    router.push("/setup/success");
  };

  return (
    <>
      <TimePickerModal
        visible={pickerField !== null}
        selected={pickerField === "from" ? startTime : endTime}
        onSelect={handleSelectTime}
        onClose={closePicker}
      />

      <ScrollView
        className="flex-1 bg-[#EEF2FF]"
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      >
        {/* ── Weekly schedule ── */}
        <View className="mb-4">
          <View className="flex-row items-center mb-1">
            <Ionicons name="calendar-outline" size={18} color="#0047AB" />
            <Text className="text-[#0F172A] font-outfit-bold text-base ml-2">
              Weekly schedule
            </Text>
          </View>
          <Text className="text-[#64748B] font-outfit-regular text-sm mb-3">
            Pick the days you want to take requests
          </Text>

          <View className="bg-white rounded-2xl p-4">
            {/* Day pills */}
            <View className="flex-row justify-between mb-5">
              {DAYS.map((day, index) => {
                const isSelected = selectedDays.includes(day.key);
                return (
                  <TouchableOpacity
                    key={`${day.key}-${index}`}
                    onPress={() => toggleDay(day.key)}
                    className={`w-10 h-10 rounded-full items-center justify-center ${
                      isSelected ? "bg-[#0047AB]" : "bg-[#F1F5F9]"
                    }`}
                  >
                    <Text
                      className={`font-outfit-bold text-sm ${
                        isSelected ? "text-white" : "text-[#94A3B8]"
                      }`}
                    >
                      {day.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* FROM / TO */}
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-[#64748B] font-outfit-medium text-xs mb-1 tracking-widest uppercase">
                  From
                </Text>
                <TouchableOpacity
                  className="bg-[#F8FAFF] flex-row items-center justify-between px-3 h-11 rounded-xl border border-[#E2E8F0]"
                  onPress={() => openPicker("from")}
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="time-outline" size={16} color="#0047AB" />
                    <Text className="text-[#0F172A] font-outfit-regular text-sm">
                      {startTime}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color="#0047AB" />
                </TouchableOpacity>
              </View>

              <View className="flex-1">
                <Text className="text-[#64748B] font-outfit-medium text-xs mb-1 tracking-widest uppercase">
                  To
                </Text>
                <TouchableOpacity
                  className="bg-[#F8FAFF] flex-row items-center justify-between px-3 h-11 rounded-xl border border-[#E2E8F0]"
                  onPress={() => openPicker("to")}
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="time-outline" size={16} color="#0047AB" />
                    <Text className="text-[#0F172A] font-outfit-regular text-sm">
                      {endTime}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={16} color="#0047AB" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Apply same hours */}
            <TouchableOpacity
              className="flex-row items-center gap-2"
              onPress={() => setApplySameTime(!applySameTime)}
            >
              <View
                className={`w-5 h-5 rounded-md items-center justify-center ${
                  applySameTime
                    ? "bg-[#0047AB]"
                    : "bg-white border border-[#CBD5E1]"
                }`}
              >
                {applySameTime && (
                  <Ionicons name="checkmark" size={13} color="white" />
                )}
              </View>
              <Text className="text-[#0F172A] font-outfit-regular text-sm flex-1">
                Apply same hours to all selected days
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Service area ── */}
        <View className="mb-6">
          <View className="flex-row items-center mb-1">
            <Ionicons name="location-outline" size={18} color="#0047AB" />
            <Text className="text-[#0F172A] font-outfit-bold text-base ml-2">
              Service area
            </Text>
          </View>
          <Text className="text-[#64748B] font-outfit-regular text-sm mb-3">
            How far you're willing to drive for a job
          </Text>

          <View className="bg-white rounded-2xl">
            {/* Map with padding so it doesn't touch the edges */}
            <View className="p-3 pb-0">
              <View className="rounded-xl overflow-hidden">
                <MapView
                  provider={MAP_PROVIDER}
                  style={{ height: 180 }}
                  region={{
                    latitude: BASE_LOCATION.latitude,
                    longitude: BASE_LOCATION.longitude,
                    latitudeDelta: mapDelta,
                    longitudeDelta: mapDelta,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Marker coordinate={BASE_LOCATION} pinColor="#0047AB" />
                  <Circle
                    center={BASE_LOCATION}
                    radius={serviceRadius * 1609.34}
                    strokeColor="rgba(0, 71, 171, 0.35)"
                    fillColor="rgba(0, 71, 171, 0.12)"
                    strokeWidth={1.5}
                  />
                </MapView>
              </View>
            </View>

            <View className="px-4 pt-4 pb-4">
              {/* Radius label */}
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-[#64748B] font-outfit-regular text-sm">
                  Service radius
                </Text>
                <Text className="text-[#0F172A] font-outfit-bold text-base">
                  {serviceRadius} miles
                </Text>
              </View>

              {/* Slider */}
              <View
                className="h-10 justify-center"
                onLayout={(e) => {
                  trackWidth.current = e.nativeEvent.layout.width;
                }}
                ref={(ref) => {
                  ref?.measure((_fx, _fy, _w, _h, px) => {
                    trackPageX.current = px;
                  });
                }}
                {...sliderPan.panHandlers}
              >
                <View className="h-1.5 bg-[#DDE3F0] rounded-full w-full">
                  <View
                    className="h-1.5 bg-[#0047AB] rounded-full"
                    style={{ width: `${thumbPercent}%` }}
                  />
                </View>
                <View
                  className="absolute w-5 h-5 rounded-full bg-white border-2 border-[#0047AB]"
                  style={{ left: `${thumbPercent}%`, marginLeft: -10, top: 10 }}
                />
              </View>

              {/* Tick labels */}
              <View className="flex-row justify-between mt-1 mb-4">
                <Text className="text-[#94A3B8] font-outfit-regular text-xs">
                  1 mi
                </Text>
                <Text className="text-[#94A3B8] font-outfit-regular text-xs">
                  25 mi
                </Text>
                <Text className="text-[#94A3B8] font-outfit-regular text-xs">
                  50 mi
                </Text>
              </View>

              {/* Base location */}
              <View className="bg-[#F8FAFF] rounded-xl px-3 py-3 flex-row items-center justify-between border border-[#E2E8F0]">
                <View className="flex-row items-center gap-3 flex-1 mr-3">
                  <Ionicons name="globe-outline" size={18} color="#0047AB" />
                  <View className="flex-1">
                    <Text className="text-[#94A3B8] font-outfit-medium text-[10px] uppercase tracking-widest mb-0.5">
                      Base location
                    </Text>
                    <Text
                      className="text-[#0F172A] font-outfit-medium text-sm"
                      numberOfLines={1}
                    >
                      {BASE_LOCATION.address}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity>
                  <Text className="text-[#0047AB] font-outfit-bold text-sm">
                    Edit
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Save */}
        <Button
          onPress={handleSave}
          size="lg"
          className="bg-[#0047AB] rounded-xl"
        >
          Save changes
        </Button>
      </ScrollView>
    </>
  );
}
