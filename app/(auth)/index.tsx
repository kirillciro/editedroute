import { isClerkAPIResponseError, useSSO, useSignIn } from "@clerk/clerk-expo";
import { ClerkAPIError } from "@clerk/types";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { White, Black, AppleBlue, Warning } from "@/utils/colors";

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { colors } = useTheme();
  const { startSSOFlow } = useSSO();
  const { setActive, signIn } = useSignIn();
  const [errors, setErrors] = useState<ClerkAPIError[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignInWithGoogle = async () => {
    setIsLoading(true);
    setErrors([]);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });

      if (createdSessionId) {
        setActive!({ session: createdSessionId });
      } else {
        // No session created, user needs to complete sign-up
        console.log("No session created - user may need to complete sign-up");
      }
    } catch (error) {
      if (isClerkAPIResponseError(error)) {
        setErrors(error.errors);
      } else {
        console.error("Unexpected error during Google sign-in:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignInWithApple = async () => {
    setIsLoading(true);
    setErrors([]);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_apple",
        redirectUrl: AuthSession.makeRedirectUri(),
      });

      if (createdSessionId) {
        setActive!({ session: createdSessionId });
      }
    } catch (error) {
      if (isClerkAPIResponseError(error)) {
        setErrors(error.errors);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignInWithPasskeys = async () => {
    setIsLoading(true);
    setErrors([]);
    try {
      const signInAttempt = await signIn?.authenticateWithPasskey({
        flow: "discoverable",
      });

      if (signInAttempt?.status === "complete") {
        await setActive!({ session: signInAttempt.createdSessionId });
      }
    } catch (error) {
      if (isClerkAPIResponseError(error)) {
        setErrors(error.errors);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={["top", "bottom"]}
    >
      <View style={styles.content}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image
            source={require("../../assets/images/app-icon.png")}
            style={styles.appIcon}
          />
          <Text style={[styles.appName, { color: colors.text }]}>
            EditedRoute
          </Text>

          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Navigation built for professionals
          </Text>

          {/* Error Messages */}
          {errors.length > 0 && (
            <View style={styles.errorContainer}>
              {errors.map((error) => (
                <Text key={error.code} style={styles.errorText}>
                  {error.message}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Auth Buttons */}
        <View style={styles.buttonsContainer}>
          {/* Passkeys Button */}
          <TouchableOpacity
            onPress={handleSignInWithPasskeys}
            disabled={isLoading}
            style={[
              styles.button,
              styles.passkeyButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <MaterialCommunityIcons
              name="fingerprint"
              size={22}
              color={colors.text}
            />
            <Text style={[styles.passkeyButtonText, { color: colors.text }]}>
              {isLoading ? "Signing in..." : "Sign in with Passkey"}
            </Text>
          </TouchableOpacity>

          {/* Apple Button - Primary */}
          <TouchableOpacity
            onPress={handleSignInWithApple}
            disabled={isLoading}
            style={[styles.button, styles.appleButton]}
          >
            <Ionicons name="logo-apple" size={22} color={White} />
            <Text style={styles.appleButtonText}>
              {isLoading ? "Signing in..." : "Continue with Apple"}
            </Text>
          </TouchableOpacity>

          {/* Google Button */}
          <TouchableOpacity
            onPress={handleSignInWithGoogle}
            disabled={isLoading}
            style={[styles.button, styles.googleButton]}
          >
            <Image
              source={require("../../assets/images/google-icon.png")}
              style={{ width: 22, height: 22 }}
            />
            <Text style={styles.googleButtonText}>
              {isLoading ? "Signing in..." : "Continue with Google"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 32,
  },
  heroSection: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  appIcon: {
    width: 250,
    height: 250,
    borderRadius: 22,
    marginBottom: 28,
    shadowColor: AppleBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  appName: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  errorContainer: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255, 59, 48, 0.12)",
  },
  errorText: {
    color: Warning,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
  },
  buttonsContainer: { width: "100%", gap: 12 },
  button: {
    paddingVertical: 15,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  appleButton: {
    backgroundColor: Black,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  appleButtonText: {
    color: White,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  googleButton: {
    backgroundColor: White,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
  },
  googleButtonText: {
    color: Black,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  passkeyButton: { borderWidth: 1 },
  passkeyButtonText: { fontSize: 16, fontWeight: "600", letterSpacing: 0.2 },
});
