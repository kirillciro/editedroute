import "react-native-url-polyfill/auto";
import { Slot } from "expo-router";
import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
import { tokenCache } from "@clerk/clerk-expo/token-cache";
import { passkeys } from "@clerk/clerk-expo/passkeys";
import { ThemeProvider } from "../context/ThemeContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";

/**
 * Root layout component
 * Wraps the entire app with ClerkProvider for authentication
 * Supports Apple, Google, and Passkeys authentication
 */
export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Please add it to your .env file",
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider
        tokenCache={tokenCache}
        publishableKey={publishableKey}
        __experimental_passkeys={passkeys}
      >
        <ClerkLoaded>
          <ThemeProvider>
            <Slot />
          </ThemeProvider>
        </ClerkLoaded>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}
