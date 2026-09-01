import { Button } from "@/components/ui/Button";
import { getSetupProgress, saveSetupProgress } from "@/lib/storage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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

/** `day: null` targets the all-week pair; a day key targets that day's row. */
type TimePickerTarget = { day: string | null; field: TimePickerField };

type DayHours = { startTime: string; endTime: string };

// ── Helpers ────────────────────────────────────────────────────────────────
/**
 * Half-hour slots as "HH:mm", 24-hour.
 *
 * The screen used to hold 12-hour strings ("09:00 AM") and send them straight to
 * the API, which documented — and now enforces — 24-hour. Production ended up
 * with both formats in the same column. "HH:mm" is the canon on the wire; the
 * 12-hour form below is presentation only.
 */
const TIMES: string[] = (() => {
  const result: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of ["00", "30"]) {
      result.push(`${h.toString().padStart(2, "0")}:${m}`);
    }
  }
  return result;
})();

/** "13:30" → "01:30 PM". Display only — never persisted. */
function formatTime12h(hhmm: string): string {
  const [rawHour, minutes] = hhmm.split(":");
  const h = Number(rawHour);
  const period = h < 12 ? "AM" : "PM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour.toString().padStart(2, "0")}:${minutes} ${period}`;
}

/** Lexicographic order matches chronological order for zero-padded "HH:mm". */
function isValidRange({ startTime, endTime }: DayHours): boolean {
  return endTime > startTime;
}

// ── Constants ──────────────────────────────────────────────────────────────
const DAYS: string[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DEFAULT_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const RADIUS_MIN = 1;
const RADIUS_MAX = 50;
/**
 * Shown until the address saved in `/setup/address` is read back, and as the
 * fallback when the wizard skipped that step (or the street was typed by hand,
 * which drops the coordinates).
 */
const BASE_LOCATION = {
  latitude: 33.4484,
  longitude: -112.074,
  address: "2418 Sunset Blvd · Phoenix, AZ",
};

type StoredAddressEntry = {
  street?: string;
  city?: string;
  state?: string;
  locationLat?: number;
  locationLng?: number;
};

/** Turns the address step's entry into the map centre + the one-line label. */
function baseLocationFromAddress(address: {
  type?: string;
  home?: StoredAddressEntry;
  work?: StoredAddressEntry;
}) {
  const entry = address.type === "work" ? address.work : address.home;
  if (!entry?.street) return null;

  const cityState = [entry.city, entry.state].filter(Boolean).join(", ");
  return {
    latitude: entry.locationLat ?? BASE_LOCATION.latitude,
    longitude: entry.locationLng ?? BASE_LOCATION.longitude,
    address: [entry.street, cityState].filter(Boolean).join(" · "),
  };
}

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
  const { t } = useTranslation();
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
            {t('setup.availability.selectTime')}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-[#0047AB] font-outfit-bold text-sm">
              {t('setup.availability.done')}
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
                    {formatTime12h(item)}
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
  const navigation = useNavigation();
  const { t } = useTranslation();

  const [selectedDays, setSelectedDays] = useState<string[]>(DEFAULT_DAYS);
  const [applySameTime, setApplySameTime] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  // Only holds the days the mechanic actually edited; the rest fall back to the
  // all-week pair, so unticking the checkbox does not blank the whole week.
  const [perDay, setPerDay] = useState<Record<string, DayHours>>({});
  const [pickerTarget, setPickerTarget] = useState<TimePickerTarget | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const [serviceRadius, setServiceRadius] = useState(15);
  const [baseLocation, setBaseLocation] = useState(BASE_LOCATION);
  const trackRef = useRef<View>(null);
  const trackWidth = useRef(0);
  const trackPageX = useRef(0);

  // The mechanic's own address is the centre of the service area — the constant
  // is only a placeholder for a wizard that skipped the address step.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const progress = await getSetupProgress();
      const address = progress.address;
      if (!address) return;

      const resolved = baseLocationFromAddress(address);
      if (resolved && !cancelled) setBaseLocation(resolved);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleDay = (key: string) => {
    setError(null);
    setSelectedDays((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key],
    );
  };

  /** A day the mechanic never touched inherits the all-week pair. */
  const hoursFor = (day: string): DayHours =>
    perDay[day] ?? { startTime, endTime };

  const openPicker = (target: TimePickerTarget) => setPickerTarget(target);
  const closePicker = () => setPickerTarget(null);

  const handleSelectTime = (time: string) => {
    if (!pickerTarget) return;
    setError(null);

    const { day, field } = pickerTarget;

    if (day === null) {
      if (field === "from") setStartTime(time);
      else setEndTime(time);
      return;
    }

    setPerDay((prev) => {
      const current = prev[day] ?? { startTime, endTime };
      return {
        ...prev,
        [day]: {
          ...current,
          ...(field === "from" ? { startTime: time } : { endTime: time }),
        },
      };
    });
  };

  const selectedTime = pickerTarget
    ? pickerTarget.day === null
      ? pickerTarget.field === "from"
        ? startTime
        : endTime
      : pickerTarget.field === "from"
        ? hoursFor(pickerTarget.day).startTime
        : hoursFor(pickerTarget.day).endTime
    : startTime;

  const updateRadius = (pageX: number) => {
    if (trackWidth.current <= 0) return;
    const x = pageX - trackPageX.current;
    const clamped = Math.max(0, Math.min(x, trackWidth.current));
    const value = Math.round(
      RADIUS_MIN + (clamped / trackWidth.current) * (RADIUS_MAX - RADIUS_MIN),
    );
    setServiceRadius(value);
  };

  /**
   * The native stack's swipe-back gesture used to win over this slider: dragging
   * the thumb near the minimum (the track starts at the screen's 20pt padding,
   * inside iOS's edge-gesture zone) slid the whole screen to the right. The
   * capture handlers plus `onPanResponderTerminationRequest: false` keep the
   * gesture away from the parent ScrollView, and `gestureEnabled` is turned off
   * for as long as the drag lasts to keep the native recognizer out of it.
   */
  const sliderPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (e) => {
        navigation.setOptions({ gestureEnabled: false });
        const { pageX } = e.nativeEvent;
        // Measured here, not once on mount: the ref callback could run before
        // the final layout and leave the offset at 0, skewing every value.
        trackRef.current?.measure((_fx, _fy, width, _h, px) => {
          trackPageX.current = px;
          trackWidth.current = width;
          updateRadius(pageX);
        });
      },
      onPanResponderMove: (e) => updateRadius(e.nativeEvent.pageX),
      onPanResponderRelease: () => {
        navigation.setOptions({ gestureEnabled: true });
      },
      onPanResponderTerminate: () => {
        navigation.setOptions({ gestureEnabled: true });
      },
    }),
  ).current;

  const thumbPercent =
    ((serviceRadius - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN)) * 100;

  const mapDelta = Math.max(0.04, (serviceRadius / RADIUS_MAX) * 0.6);

  const handleSave = async () => {
    // Nothing validated this before: an empty week or an end time earlier than
    // the start went straight to the API and was stored as-is.
    if (selectedDays.length === 0) {
      setError(t("setup.availability.errorNoDays"));
      return;
    }

    const ranges = applySameTime
      ? [{ startTime, endTime }]
      : selectedDays.map(hoursFor);

    if (!ranges.every(isValidRange)) {
      setError(t("setup.availability.errorEndBeforeStart"));
      return;
    }

    setError(null);

    await saveSetupProgress("availability", {
      selectedDays,
      startTime,
      endTime,
      applySameTime,
      serviceRadius,
      // Only sent when the hours actually differ per day; the backend prefers
      // `schedule` over `selectedDays` whenever it is present.
      ...(applySameTime
        ? {}
        : {
            schedule: selectedDays.map((day) => ({
              day,
              ...hoursFor(day),
            })),
          }),
    });
    router.push("/setup/legal-documents");
  };

  return (
    <>
      <TimePickerModal
        visible={pickerTarget !== null}
        selected={selectedTime}
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
              {t('setup.availability.weeklySchedule')}
            </Text>
          </View>
          <Text className="text-[#64748B] font-outfit-regular text-sm mb-3">
            {t('setup.availability.weeklyScheduleHint')}
          </Text>

          <View className="bg-white rounded-2xl p-4">
            {/* Day pills */}
            <View className="flex-row justify-between mb-5">
              {DAYS.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    onPress={() => toggleDay(day)}
                    className={`w-10 h-10 rounded-full items-center justify-center ${
                      isSelected ? "bg-[#0047AB]" : "bg-[#F1F5F9]"
                    }`}
                  >
                    <Text
                      className={`font-outfit-bold text-sm ${
                        isSelected ? "text-white" : "text-[#94A3B8]"
                      }`}
                    >
                      {t(`setup.availability.dayInitials.${day}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* FROM / TO — the week-wide pair, shown while the hours match */}
            {applySameTime && (
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-[#64748B] font-outfit-medium text-xs mb-1 tracking-widest uppercase">
                    {t('setup.availability.from')}
                  </Text>
                  <TouchableOpacity
                    className="bg-[#F8FAFF] flex-row items-center justify-between px-3 h-11 rounded-xl border border-[#E2E8F0]"
                    onPress={() => openPicker({ day: null, field: "from" })}
                  >
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="time-outline" size={16} color="#0047AB" />
                      <Text className="text-[#0F172A] font-outfit-regular text-sm">
                        {formatTime12h(startTime)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={16} color="#0047AB" />
                  </TouchableOpacity>
                </View>

                <View className="flex-1">
                  <Text className="text-[#64748B] font-outfit-medium text-xs mb-1 tracking-widest uppercase">
                    {t('setup.availability.to')}
                  </Text>
                  <TouchableOpacity
                    className="bg-[#F8FAFF] flex-row items-center justify-between px-3 h-11 rounded-xl border border-[#E2E8F0]"
                    onPress={() => openPicker({ day: null, field: "to" })}
                  >
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="time-outline" size={16} color="#0047AB" />
                      <Text className="text-[#0F172A] font-outfit-regular text-sm">
                        {formatTime12h(endTime)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-down" size={16} color="#0047AB" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Per-day hours — one row per selected day, in week order */}
            {!applySameTime && (
              <View className="mb-4">
                <Text className="text-[#64748B] font-outfit-regular text-sm mb-3">
                  {t('setup.availability.perDayHint')}
                </Text>

                {DAYS.filter((day) => selectedDays.includes(day)).map((day) => {
                  const hours = hoursFor(day);
                  return (
                    <View key={day} className="mb-3">
                      <Text className="text-[#0F172A] font-outfit-medium text-sm mb-1">
                        {t(`setup.availability.dayNames.${day}`)}
                      </Text>
                      <View className="flex-row gap-3">
                        <TouchableOpacity
                          className="flex-1 bg-[#F8FAFF] flex-row items-center justify-between px-3 h-11 rounded-xl border border-[#E2E8F0]"
                          onPress={() => openPicker({ day, field: "from" })}
                        >
                          <View className="flex-row items-center gap-2">
                            <Ionicons
                              name="time-outline"
                              size={16}
                              color="#0047AB"
                            />
                            <Text className="text-[#0F172A] font-outfit-regular text-sm">
                              {formatTime12h(hours.startTime)}
                            </Text>
                          </View>
                          <Ionicons
                            name="chevron-down"
                            size={16}
                            color="#0047AB"
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          className="flex-1 bg-[#F8FAFF] flex-row items-center justify-between px-3 h-11 rounded-xl border border-[#E2E8F0]"
                          onPress={() => openPicker({ day, field: "to" })}
                        >
                          <View className="flex-row items-center gap-2">
                            <Ionicons
                              name="time-outline"
                              size={16}
                              color="#0047AB"
                            />
                            <Text className="text-[#0F172A] font-outfit-regular text-sm">
                              {formatTime12h(hours.endTime)}
                            </Text>
                          </View>
                          <Ionicons
                            name="chevron-down"
                            size={16}
                            color="#0047AB"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Apply same hours */}
            <TouchableOpacity
              className="flex-row items-center gap-2"
              onPress={() => {
                setError(null);
                setApplySameTime(!applySameTime);
              }}
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
                {t('setup.availability.applySameHours')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Service area ── */}
        <View className="mb-6">
          <View className="flex-row items-center mb-1">
            <Ionicons name="location-outline" size={18} color="#0047AB" />
            <Text className="text-[#0F172A] font-outfit-bold text-base ml-2">
              {t('setup.availability.serviceArea')}
            </Text>
          </View>
          <Text className="text-[#64748B] font-outfit-regular text-sm mb-3">
            {t('setup.availability.serviceAreaHint')}
          </Text>

          <View className="bg-white rounded-2xl">
            {/* Map with padding so it doesn't touch the edges */}
            <View className="p-3 pb-0">
              <View className="rounded-xl overflow-hidden">
                <MapView
                  provider={MAP_PROVIDER}
                  style={{ height: 180 }}
                  region={{
                    latitude: baseLocation.latitude,
                    longitude: baseLocation.longitude,
                    latitudeDelta: mapDelta,
                    longitudeDelta: mapDelta,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}
                >
                  <Marker coordinate={baseLocation} pinColor="#0047AB" />
                  <Circle
                    center={baseLocation}
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
                  {t('setup.availability.serviceRadius')}
                </Text>
                <Text className="text-[#0F172A] font-outfit-bold text-base">
                  {t('setup.availability.miles', { count: serviceRadius })}
                </Text>
              </View>

              {/* Slider */}
              <View
                className="h-10 justify-center"
                ref={trackRef}
                onLayout={(e) => {
                  trackWidth.current = e.nativeEvent.layout.width;
                  trackRef.current?.measureInWindow((px) => {
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
                  {t('setup.availability.milesAbbr', { count: 1 })}
                </Text>
                <Text className="text-[#94A3B8] font-outfit-regular text-xs">
                  {t('setup.availability.milesAbbr', { count: 25 })}
                </Text>
                <Text className="text-[#94A3B8] font-outfit-regular text-xs">
                  {t('setup.availability.milesAbbr', { count: 50 })}
                </Text>
              </View>

              {/* Base location */}
              <View className="bg-[#F8FAFF] rounded-xl px-3 py-3 flex-row items-center justify-between border border-[#E2E8F0]">
                <View className="flex-row items-center gap-3 flex-1 mr-3">
                  <Ionicons name="globe-outline" size={18} color="#0047AB" />
                  <View className="flex-1">
                    <Text className="text-[#94A3B8] font-outfit-medium text-[10px] uppercase tracking-widest mb-0.5">
                      {t('setup.availability.baseLocation')}
                    </Text>
                    <Text
                      className="text-[#0F172A] font-outfit-medium text-sm"
                      numberOfLines={1}
                    >
                      {baseLocation.address}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => router.push("/setup/address")}>
                  <Text className="text-[#0047AB] font-outfit-bold text-sm">
                    {t('setup.availability.edit')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Save */}
        {error && (
          <View className="flex-row items-center gap-2 mb-3">
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text className="text-[#EF4444] font-outfit-medium text-sm flex-1">
              {error}
            </Text>
          </View>
        )}

        <Button
          onPress={handleSave}
          size="lg"
          className="bg-[#0047AB] rounded-xl"
        >
          {t('setup.availability.saveChanges')}
        </Button>
      </ScrollView>
    </>
  );
}
