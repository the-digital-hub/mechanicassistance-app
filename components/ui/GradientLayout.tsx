import { MeshBackground } from "@/components/brand/MeshBackground";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, View, ViewProps } from "react-native";

/**
 * Brand backdrop for the signed-out screens (login): the blue mesh with soft
 * drifting lights. The content rises in, so arriving from the welcome card
 * (which grows to fill the screen) reads as one continuous movement.
 */
export function GradientLayout({ children, style, ...props }: ViewProps & { resizeMode?: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 520, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v]);

  return (
    <View style={[{ flex: 1, width: "100%", height: "100%", overflow: "hidden", backgroundColor: "#061A66" }, style]} {...props}>
      <StatusBar style="light" />
      <MeshBackground />
      <Animated.View
        style={{
          flex: 1,
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}
