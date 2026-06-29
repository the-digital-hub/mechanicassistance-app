import { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';

interface KPICardProps {
  icon: LucideIcon;
  iconColor: string;
  value: string;
  label: string;
  bgColor: string;
}

export function KPICard({ icon: Icon, iconColor, value, label, bgColor }: KPICardProps) {
  return (
    <View
      className="flex-1 rounded-3xl p-5 items-center justify-center bg-white"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <View
        className="w-12 h-12 rounded-full items-center justify-center mb-3"
        style={{ backgroundColor: bgColor }}
      >
        <Icon size={24} color={iconColor} />
      </View>
      <Text className="text-gray-900 font-outfit-bold text-2xl mb-1">
        {value}
      </Text>
      <Text className="text-gray-600 font-outfit-regular text-xs text-center">
        {label}
      </Text>
    </View>
  );
}
