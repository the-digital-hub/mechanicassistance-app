import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Dimensions,
    Image,
    ImageBackground,
    PanResponder,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import CircleSVG from "../assets/images/onboarding_circle.svg";

const { width, height } = Dimensions.get("window");

const Onboarding = () => {
  const [index, setIndex] = useState(0);
  const router = useRouter();
  const { t } = useTranslation();

  const texts = [
    t("onboarding.slide1"),
    t("onboarding.slide2"),
    t("onboarding.slide3"),
    t("onboarding.slide4"),
  ];

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 10,

      onPanResponderRelease: (_, gestureState) => {
        setIndex((prevIndex) => {
          if (gestureState.dx > 20 && prevIndex > 0) {
            return prevIndex - 1;
          } else if (gestureState.dx < -20 && prevIndex < texts.length - 1) {
            return prevIndex + 1;
          }
          return prevIndex;
        });
      },
    }),
  ).current;

  return (
    <ImageBackground
      source={require("@/assets/images/car_repair.jpg")}
      style={styles.background}
      imageStyle={styles.imageBackground}
      resizeMode="cover"
    >
      <LinearGradient
        colors={["rgba(20, 136, 204, 0.8)", "rgba(43, 50, 178, 0.8)"]}
        start={{ x: 0.01, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Image
          source={require("@/assets/images/mechanic_assistance_logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* Circle with Texts */}
        <View style={styles.circleContainer} {...panResponder.panHandlers}>
          {index === 0 ? (
            <Text style={styles.textHero}>{texts[index]}</Text>
          ) : (
            <View style={styles.circleWrapper}>
              <CircleSVG style={styles.circle} />
              <View style={styles.textContainer}>
                <Text style={styles.text}>{texts[index]}</Text>
              </View>
            </View>
          )}
        </View>
        {/* Dots */}
        <View style={styles.dotsContainer}>
          {texts.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setIndex(i)}>
              <View
                style={[
                  styles.dot,
                  index === i ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.getStartedButton}
          onPress={() => router.push("/setup")}
        >
          <Text style={styles.getStartedButtonText}>{t("onboarding.getStarted")}</Text>
        </TouchableOpacity>
      </LinearGradient>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: { flex: 1 },
  imageBackground: { width, height },
  gradient: { flex: 1, alignItems: "center", justifyContent: "space-evenly" },
  logo: { marginTop: height * 0.1, width: width * 0.75, height: height * 0.15 },

  circleContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: width,
    height: 350,
  },
  circleWrapper: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  circle: {
    width: 330,
    height: 330,
  },
  textContainer: {
    position: "absolute",
    width: width * 0.4,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 26,
    fontFamily: "Outfit_500Medium",
    textAlign: "center",
    color: "#8CF1E9",
    lineHeight: 32,
  },
  textHero: {
    fontSize: 32,
    fontWeight: "500",
    textAlign: "center",
    color: "#fff",
    width: "80%",
    fontFamily: "Outfit_500Medium",
    marginVertical: 80,
    lineHeight: 35,
  },

  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "white",
  },
  activeDot: { backgroundColor: "white" },
  inactiveDot: { backgroundColor: "transparent" },

  getStartedButton: {
    borderWidth: 2,
    borderColor: "#fff",
    borderRadius: 5,
    height: 50,
    width: width * 0.85,
    justifyContent: "center",
    alignItems: "center",
  },
  getStartedButtonText: {
    fontSize: 18,
    color: "#fff",
  },

  signupText: {
    color: "#fff",
    textAlign: "center",
  },
  signupLink: {
    textDecorationLine: "underline",
    color: "#56CCF2",
  },
});

export default Onboarding;
