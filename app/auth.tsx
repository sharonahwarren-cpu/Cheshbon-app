
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { colors } from "@/styles/commonStyles";
import Toast from 'react-native-toast-message';
import { IconSymbol } from "@/components/IconSymbol";

export default function AuthScreen() {
  const { user, loading: authLoading, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, signInWithGoogleRedirect } = useAuth();
  const router = useRouter();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !authLoading) {
      console.log("[Auth Screen] User authenticated, redirecting to home");
      router.replace("/(tabs)/(home)");
    }
  }, [user, authLoading]);

  const handleEmailAuth = async () => {
    if (!email || !password) {
      Toast.show({
        type: 'error',
        text1: 'Missing Information',
        text2: 'Please enter email and password',
      });
      return;
    }

    if (isSignUp && !name) {
      Toast.show({
        type: 'error',
        text1: 'Missing Information',
        text2: 'Please enter your name',
      });
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        console.log("[Auth Screen] Signing up with email:", email);
        await signUpWithEmail(email, password, name);
        Toast.show({
          type: 'success',
          text1: 'Account Created',
          text2: 'Welcome to Cheshbon!',
        });
      } else {
        console.log("[Auth Screen] Signing in with email:", email);
        await signInWithEmail(email, password);
        Toast.show({
          type: 'success',
          text1: 'Signed In',
          text2: 'Welcome back!',
        });
      }
    } catch (error: any) {
      console.error("[Auth Screen] Email auth failed:", error);
      Toast.show({
        type: 'error',
        text1: isSignUp ? 'Sign Up Failed' : 'Sign In Failed',
        text2: error.message || 'Please try again',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log("[Auth Screen] Google sign-in button pressed");
    setGoogleLoading(true);
    try {
      console.log("[Auth Screen] Calling signInWithGoogle()...");
      await signInWithGoogle();
      console.log("[Auth Screen] ✅ Google sign-in completed successfully");
      // Success toast is shown in AuthContext
    } catch (error: any) {
      console.error("[Auth Screen] ❌ Google sign-in failed:", error);
      Toast.show({
        type: 'error',
        text1: 'Google Sign-In Failed',
        text2: error.message || 'Please try again',
      });
      
      // If popup was blocked, try redirect flow
      if (Platform.OS === 'web' && error.message?.toLowerCase().includes("popup")) {
        console.log("[Auth Screen] Popup blocked, trying redirect flow...");
        try {
          await signInWithGoogleRedirect();
        } catch (redirectErr: any) {
          console.error("[Auth Screen] Redirect flow also failed:", redirectErr);
        }
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    console.log("[Auth Screen] Apple sign-in button pressed");
    setAppleLoading(true);
    try {
      console.log("[Auth Screen] Calling signInWithApple()...");
      await signInWithApple();
      console.log("[Auth Screen] ✅ Apple sign-in completed successfully");
      // Success toast is shown in AuthContext
    } catch (error: any) {
      console.error("[Auth Screen] ❌ Apple sign-in failed:", error);
      Toast.show({
        type: 'error',
        text1: 'Apple Sign-In Failed',
        text2: error.message || 'Please try again',
      });
    } finally {
      setAppleLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push("/reset-password");
  };

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Image
              source={require("@/assets/images/Chesbon_app_Logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Cheshbon</Text>
            <Text style={styles.subtitle}>
              {isSignUp ? "Create your account" : "Welcome back"}
            </Text>
          </View>

          <View style={styles.form}>
            {isSignUp && (
              <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
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
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {!isSignUp && (
              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={styles.forgotPassword}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleEmailAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {isSignUp ? "Sign Up" : "Sign In"}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.button, styles.socialButton]}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="globe"
                    android_material_icon_name="language"
                    size={20}
                    color={colors.text}
                  />
                  <Text style={styles.socialButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {Platform.OS === "ios" && (
              <TouchableOpacity
                style={[styles.button, styles.socialButton]}
                onPress={handleAppleSignIn}
                disabled={appleLoading}
              >
                {appleLoading ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <>
                    <IconSymbol
                      ios_icon_name="apple.logo"
                      android_material_icon_name="apple"
                      size={20}
                      color={colors.text}
                    />
                    <Text style={styles.socialButtonText}>Continue with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsSignUp(!isSignUp)}
            >
              <Text style={styles.switchButtonText}>
                {isSignUp
                  ? "Already have an account? Sign In"
                  : "Don't have an account? Sign Up"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Debug info (only in development) */}
          {__DEV__ && (
            <View style={styles.debugPanel}>
              <Text style={styles.debugTitle}>Debug Info:</Text>
              <Text style={styles.debugText}>Platform: {Platform.OS}</Text>
              <Text style={styles.debugText}>Loading: {authLoading ? "YES" : "NO"}</Text>
              <Text style={styles.debugText}>User: {user ? user.email : "None"}</Text>
              <Text style={styles.debugText}>Submitting: {loading ? "YES" : "NO"}</Text>
              <Text style={styles.debugText}>Google Loading: {googleLoading ? "YES" : "NO"}</Text>
              <Text style={styles.debugText}>Apple Loading: {appleLoading ? "YES" : "NO"}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  form: {
    width: "100%",
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  forgotPassword: {
    color: colors.primary,
    textAlign: "right",
    marginBottom: 16,
    fontSize: 14,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  socialButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    gap: 12,
  },
  socialButtonText: {
    color: colors.text,
    fontSize: 16,
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
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 16,
    color: colors.textSecondary,
    fontSize: 14,
  },
  switchButton: {
    marginTop: 16,
    alignItems: "center",
  },
  switchButtonText: {
    color: colors.primary,
    fontSize: 14,
  },
  debugPanel: {
    marginTop: 32,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
});
