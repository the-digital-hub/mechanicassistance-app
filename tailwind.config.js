/** @type {import('tailwindcss').Config} */
// The typeface is chosen in lib/ui/fonts.ts (Inter; EXPO_PUBLIC_APP_FONT=outfit brings Outfit back); the class names stay `font-outfit-*`.
const INTER = process.env.EXPO_PUBLIC_APP_FONT !== 'outfit';
const FAMILY = INTER
  ? ['Inter_400Regular', 'Inter_500Medium', 'Inter_600SemiBold', 'Inter_700Bold']
  : ['Outfit_400Regular', 'Outfit_500Medium', 'Outfit_600SemiBold', 'Outfit_700Bold'];

module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        'outfit-regular': [FAMILY[0]],
        'outfit-medium': [FAMILY[1]],
        'outfit-semibold': [FAMILY[2]],
        'outfit-bold': [FAMILY[3]],
      }
    },
  },
  plugins: [],
}
