import { cn } from "@/lib/utils";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
    FlatList,
    Modal,
    Text,
    TouchableOpacity,
    View,
    ViewToken,
} from "react-native";

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5; // must be odd
const PADDING_ITEMS = Math.floor(VISIBLE_ITEMS / 2); // 2 ghost items top/bottom

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS = Array.from({ length: 31 }, (_, i) =>
  String(i + 1).padStart(2, "0"),
);
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) =>
  String(CURRENT_YEAR - 18 - i),
); // max age: 118, min: 18

// ─── Types ────────────────────────────────────────────────────────────────────

interface DatePickerProps {
  value?: string; // "MM/DD/YYYY" or empty
  onChange: (formatted: string) => void;
  placeholder?: string;
  containerClassName?: string;
}

// ─── Column ──────────────────────────────────────────────────────────────────

function PickerColumn({
  items,
  selectedIndex,
  onSelect,
}: {
  items: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const listRef = useRef<FlatList>(null);
  const lastIndex = useRef(selectedIndex);

  // Padded data so first/last item can center
  const paddedItems = [
    ...Array(PADDING_ITEMS).fill(""),
    ...items,
    ...Array(PADDING_ITEMS).fill(""),
  ];

   
  useEffect(() => {
    listRef.current?.scrollToIndex({
      index: selectedIndex,
      animated: false,
      viewPosition: 0,
    });
  }, []); // intentionally run only on mount — re-scroll on selection would fight the user

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      // center item = index PADDING_ITEMS in the visible window
      const center = viewableItems[PADDING_ITEMS];
      if (!center) return;
      const realIndex = (center.index ?? 0) - PADDING_ITEMS;
      if (realIndex < 0 || realIndex >= items.length) return;
      if (realIndex !== lastIndex.current) {
        lastIndex.current = realIndex;
        Haptics.selectionAsync();
        onSelect(realIndex);
      }
    },
  );

  return (
    <View style={{ flex: 1, height: ITEM_HEIGHT * VISIBLE_ITEMS }}>
      <FlatList
        ref={listRef}
        data={paddedItems}
        keyExtractor={(_, i) => String(i)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        initialScrollIndex={selectedIndex}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        renderItem={({ item, index }) => {
          const realIndex = index - PADDING_ITEMS;
          const isSelected = realIndex === selectedIndex;
          return (
            <View
              style={{ height: ITEM_HEIGHT }}
              className="justify-center items-center"
            >
              <Text
                className={cn(
                  "font-outfit-medium text-base",
                  isSelected
                    ? "text-[#0047AB] font-outfit-bold"
                    : "text-slate-400",
                )}
              >
                {item}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

// ─── DatePicker ───────────────────────────────────────────────────────────────

export function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  containerClassName,
}: DatePickerProps) {
  const [visible, setVisible] = useState(false);

  // Parse initial value — "MM/DD/YYYY"
  const parseValue = () => {
    if (!value) return { month: 0, day: 0, year: 0 };
    const parts = value.replace(/\s/g, "").split("/");
    return {
      month: Math.max(0, Number(parts[0]) - 1),
      day: Math.max(0, Number(parts[1]) - 1),
      year: Math.max(0, YEARS.indexOf(parts[2])),
    };
  };

  const init = parseValue();
  const [selMonth, setSelMonth] = useState(init.month);
  const [selDay, setSelDay] = useState(init.day);
  const [selYear, setSelYear] = useState(init.year);

  const displayValue = value
    ? `${String(selMonth + 1).padStart(2, "0")} / ${DAYS[selDay]} / ${YEARS[selYear]}`
    : "";

  const handleDone = () => {
    const formatted = `${String(selMonth + 1).padStart(2, "0")}/${DAYS[selDay]}/${YEARS[selYear]}`;
    onChange(formatted);
    setVisible(false);
  };

  return (
    <>
      {/* Trigger field — matches Input style */}
      <TouchableOpacity
        onPress={() => setVisible(true)}
        className={cn(
          "flex-row items-center px-4 rounded-xl",
          containerClassName,
        )}
        style={{ height: 52 }}
        activeOpacity={0.7}
      >
        <Text
          className={cn(
            "flex-1 font-outfit-medium text-base",
            displayValue ? "text-[#0F172A]" : "text-[#9CA3AF]",
          )}
        >
          {displayValue || placeholder}
        </Text>
      </TouchableOpacity>

      {/* Picker Modal */}
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          className="flex-1 bg-black/30"
          activeOpacity={1}
          onPress={() => setVisible(false)}
        />

        <View className="bg-white rounded-t-3xl pb-8">
          {/* Header */}
          <View className="flex-row justify-between items-center px-6 pt-5 pb-3 border-b border-slate-100">
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Text className="text-slate-400 font-outfit-medium text-base">
                Cancel
              </Text>
            </TouchableOpacity>
            <Text className="font-outfit-bold text-[#0F172A] text-base">
              Date of Birth
            </Text>
            <TouchableOpacity onPress={handleDone}>
              <Text className="text-[#0047AB] font-outfit-bold text-base">
                Done
              </Text>
            </TouchableOpacity>
          </View>

          {/* Columns */}
          <View className="relative">
            {/* Selection highlight */}
            <View
              className="absolute left-4 right-4 bg-blue-50 rounded-xl pointer-events-none"
              style={{
                top: ITEM_HEIGHT * PADDING_ITEMS,
                height: ITEM_HEIGHT,
              }}
            />

            <View className="flex-row px-4 pt-2">
              <PickerColumn
                items={MONTHS}
                selectedIndex={selMonth}
                onSelect={setSelMonth}
              />
              <PickerColumn
                items={DAYS}
                selectedIndex={selDay}
                onSelect={setSelDay}
              />
              <PickerColumn
                items={YEARS}
                selectedIndex={selYear}
                onSelect={setSelYear}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
