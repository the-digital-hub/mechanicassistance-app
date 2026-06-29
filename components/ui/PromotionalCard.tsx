import { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';

interface PromotionalCardProps {
  badge: string;
  title: string;
  description: string;
  icon: LucideIcon;
  onPress: () => void;
}

export function PromotionalCard({ badge, title, description, icon: Icon, onPress }: PromotionalCardProps) {
  return (
    <LinearGradient
      colors={['#2B66F8', '#1E3A8A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 24,
        overflow: 'hidden',
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        className="flex-row items-center gap-4 p-6"
      >
        {/* Icon Container */}
        <View
          className="w-16 h-16 rounded-2xl items-center justify-center"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.3)',
          }}
        >
          <Icon size={32} color="white" />
        </View>

        {/* Content */}
        <View className="flex-1">
          <View
            className="flex-row items-center gap-2 mb-2 px-3 py-1.5 rounded-full self-start"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            <View className="w-1.5 h-1.5 rounded-full bg-white" />
            <Text className="text-white font-outfit-semibold text-xs tracking-widest">
              {badge}
            </Text>
          </View>
          <Text className="text-white font-outfit-bold text-lg mb-1">
            {title}
          </Text>
          <Text className="text-white/80 font-outfit-regular text-sm">
            {description}
          </Text>
        </View>

        {/* Arrow Button */}
        <View
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: 'white' }}
        >
          <ArrowRight size={18} color="#2B66F8" />
        </View>
      </TouchableOpacity>
    </LinearGradient>
  );
}
