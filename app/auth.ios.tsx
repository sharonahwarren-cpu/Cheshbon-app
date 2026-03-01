
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import { colors } from "@/styles/commonStyles";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { IconSymbol } from "@/components/IconSymbol";

type Mode = "signin" | "signup";

const BIOMETRIC_CREDENTIALS_KEY = "cheshbon_biometric_credentials";

export default function AuthScreen() {
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, signInWithGitHub, loading: authLoading } =
    useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>("");
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);

  useEffect(() => {
    checkBiometricAvailability();
    checkSavedCredentials();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const available = compatible && enrolled;
      
      setBiometricAvailable(available);
      
      if (available) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const biometricTypeNames = types.map(type => {
          switch (type) {
            case LocalAuthentication.AuthenticationType.FINGERPRINT:
              return "Touch ID";
            case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
              return "Face ID";
            case LocalAuthentication.AuthenticationType.IRIS:
              return "Iris";
            default:
              return "Biometric";
          }
        });
        
        const typeText = biometricTypeNames.join(" / ");
        setBiometricType(typeText);
        console.log("✅ [iOS] Biometric authentication available:", typeText);
      } else {
        console.log("❌ [iOS] Biometric authentication not available");
      }
    } catch (error) {
      console.error("[iOS] Error checking biometric availability:", error);
      setBiometricAvailable(false);
    }
  };

  const checkSavedCredentials = async () => {
    try {
      const savedCreds = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY);
      setHasSavedCredentials(!!savedCreds);
      console.log("[iOS] Saved credentials:", savedCreds ? "Found" : "Not found");
    } catch (error) {
      console.error("[iOS] Error checking saved credentials:", error);
      setHasSavedCredentials(false);
    }
  };

  const handleBiometricAuth = async () => {
    try {
      console.log("🔐 [iOS] Starting biometric authentication...");
      
      const savedCredsString = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY);
      if (!savedCredsString) {
        Toast.show({
          type: "error",
          text1: "No Saved Credentials",
          text2: "Please sign in with email/password first to enable biometric login.",
        });
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Sign in to Cheshbon",
        fallbackLabel: "Use password",
        cancelLabel: "Cancel",
      });

      if (result.success) {
        console.log("✅ [iOS] Biometric authentication successful");
        
        const savedCreds = JSON.parse(savedCredsString);
        setLoading(true);
        
        try {
          await signInWithEmail(savedCreds.email, savedCreds.password);
          router.replace("/(tabs)/(home)");
        } catch (error: any) {
          console.error("❌ [iOS] Sign in failed after biometric auth:", error);
        } finally {
          setLoading(false);
        }
      } else {
        console.log("❌ [iOS] Biometric authentication failed or cancelled");
      }
    } catch (error) {
      console.error("❌ [iOS] Biometric authentication error:", error);
      Toast.show({
        type: "error",
        text1: "Authentication Failed",
        text2: "Could not authenticate with biometrics.",
      });
    }
  };

  const saveBiometricCredentials = async (email: string, password: string) => {
    try {
      const credentials = JSON.stringify({ email, password });
      await SecureStore.setItemAsync(BIOMETRIC_CREDENTIALS_KEY, credentials);
      setHasSavedCredentials(true);
      console.log("💾 [iOS] Biometric credentials saved");
    } catch (error) {
      console.error("[iOS] Error saving biometric credentials:", error);
    }
  };

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const handleEmailAuth = async () => {
    if (!email || !password) {
      Toast.show({
        type: "error",
        text1: "Missing Information",
        text2: "Please enter email and password",
      });
      return;
    }

    console.log(`📧 [iOS] User tapped ${mode === "signin" ? "Sign In" : "Sign Up"} button`);
    setLoading(true);
    try {
      if (mode === "signin") {
        console.log("📧 [iOS] Calling signInWithEmail...");
        await signInWithEmail(email, password);
        
        // Save credentials for biometric auth if available
        if (biometricAvailable) {
          await saveBiometricCredentials(email, password);
        }
        
        console.log("✅ [iOS] Email sign in successful, navigating to home");
        router.replace("/(tabs)/(home)");
      } else {
        console.log("📧 [iOS] Calling signUpWithEmail...");
        await signUpWithEmail(email, password, name);
        
        // Save credentials for biometric auth if available
        if (biometricAvailable) {
          await saveBiometricCredentials(email, password);
        }
        
        console.log("✅ [iOS] Email sign up successful, navigating to home");
        router.replace("/(tabs)/(home)");
      }
    } catch (error: any) {
      // Error is already shown by AuthContext
      console.log("❌ [iOS] Auth error handled by context:", error?.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuth = async (provider: "google" | "apple" | "github") => {
    console.log(`🔘 [iOS] User tapped ${provider} sign in button`);
    console.log(`📱 [iOS] Platform: ${Platform.OS}`);
    console.log(`⏰ [iOS] Timestamp: ${new Date().toISOString()}`);
    
    // Show immediate feedback
    Toast.show({
      type: "info",
      text1: `Opening ${provider}...`,
      text2: "Please wait",
      visibilityTime: 2000,
    });
    
    setLoading(true);
    try {
      if (provider === "google") {
        console.log("📞 [iOS] Calling signInWithGoogle...");
        await signInWithGoogle();
        console.log("✅ [iOS] signInWithGoogle completed");
      } else if (provider === "apple") {
        console.log("📞 [iOS] Calling signInWithApple...");
        await signInWithApple();
        console.log("✅ [iOS] signInWithApple completed");
      } else if (provider === "github") {
        console.log("📞 [iOS] Calling signInWithGitHub...");
        await signInWithGitHub();
        console.log("✅ [iOS] signInWithGitHub completed");
      }
      
      // Navigation is handled by the deep link callback
      console.log("📱 [iOS] Waiting for deep link navigation...");
    } catch (error: any) {
      // Error is already shown by AuthContext
      console.log("❌ [iOS] Social auth error:", error?.message);
      console.log("❌ [iOS] Error stack:", error?.stack);
    } finally {
      console.log("🏁 [iOS] Social auth flow finished, resetting loading state");
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image
              source={require("@/assets/images/Chesbon_app_Logo Small.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Cheshbon</Text>
            <Text style={styles.tagline}>Journaling, Goals & Tracking</Text>
          </View>

          <Text style={styles.title}>
            {mode === "signin" ? "Sign In" : "Sign Up"}
          </Text>

          {mode === "signup" && (
            <TextInput
              style={styles.input}
              placeholder="Name (optional)"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              editable={!loading}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleEmailAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === "signin" ? "Sign In" : "Sign Up"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchModeButton}
            onPress={() => setMode(mode === "signin" ? "signup" : "signin")}
            disabled={loading}
          >
            <Text style={styles.switchModeText}>
              {mode === "signin"
                ? "Don't have an account? Sign Up"
                : "Already have an account? Sign In"}
            </Text>
          </TouchableOpacity>

          {biometricAvailable && hasSavedCredentials && mode === "signin" && (
            <TouchableOpacity
              style={styles.biometricButton}
              onPress={handleBiometricAuth}
              disabled={loading}
            >
              <IconSymbol
                ios_icon_name="faceid"
                android_material_icon_name="fingerprint"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.biometricButtonText}>
                Sign in with {biometricType}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.socialButton, loading && styles.buttonDisabled]}
            onPress={() => handleSocialAuth("google")}
            disabled={loading}
          >
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialButton, styles.appleButton, loading && styles.buttonDisabled]}
            onPress={() => handleSocialAuth("apple")}
            disabled={loading}
          >
            <Text style={[styles.socialButtonText, styles.appleButtonText]}>
              Continue with Apple
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 60,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  appName: {
    fontSize: 36,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 32,
    textAlign: "center",
    color: colors.text,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: colors.backgroundAlt,
    color: colors.text,
  },
  primaryButton: {
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  switchModeButton: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 8,
  },
  switchModeText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  dividerText: {
    marginHorizontal: 12,
    color: colors.textSecondary,
    fontSize: 14,
  },
  socialButton: {
    height: 50,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: colors.backgroundAlt,
  },
  socialButtonText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: "500",
  },
  appleButton: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  appleButtonText: {
    color: colors.background,
  },
  biometricButton: {
    height: 50,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: colors.backgroundAlt,
    flexDirection: "row",
    gap: 12,
  },
  biometricButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: "600",
  },
});
