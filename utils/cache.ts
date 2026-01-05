import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { TokenCache } from "@clerk/clerk-expo";

/**
 * Token cache implementation using Expo SecureStore
 * Provides secure storage for Clerk authentication tokens
 */
const createTokenCache = (): TokenCache => {
  return {
    getToken: async (key: string) => {
      try {
        const item = await SecureStore.getItemAsync(key);
        if (item) {
          console.log(`${key} was used 🔐 \n`);
        } else {
          console.log("No values stored under key");
        }
        return item;
      } catch (error) {
        console.error("Error getting token from SecureStore:", error);
        await SecureStore.deleteItemAsync(key);
        return null;
      }
    },
    saveToken: async (key: string, token: string) => {
      try {
        return await SecureStore.setItemAsync(key, token);
      } catch (error) {
        console.error("Error saving token to SecureStore:", error);
      }
    },
  };
};

// Use SecureStore for native platforms, undefined for web
export const tokenCache =
  Platform.OS !== "web" ? createTokenCache() : undefined;
