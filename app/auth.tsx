
import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
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
  Modal,
} from "react-native";
import { colors } from "@/styles/commonStyles";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AuthScreen() {
  const { user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithGoogleRedirect, requestPasswordReset } = useAuth();
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      console.log("[Auth] User authenticated, redirecting to home");
      router.replace("/");
    }
  }, [user, loading]);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (isSignUp && !name) {
      setError("Please enter your name");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, name);
      } else {
        await signInWithEmail(email, password);
      }
      // Navigation will happen automatically via useEffect when user state updates
    } catch (err: any) {
      console.error("[Auth] Email auth error:", err);
      setError(err.message || "Authentication failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setSubmitting(true);
    setError("");

    try {
      await signInWithGoogle();
      // Navigation will happen automatically via useEffect when user state updates
    } catch (err: any) {
      console.error("[Auth] Google sign in error:", err);
      
      // Show user-friendly error message
      let errorMessage = "Failed to sign in with Google. Please try again.";
      
      if (err.message?.includes("popup")) {
        errorMessage = "Please allow popups for this site and try again.";
      } else if (err.message?.includes("closed")) {
        errorMessage = "Sign-in was cancelled. Please try again.";
      } else if (err.message?.includes("session") || err.message?.includes("establish")) {
        // Session establishment failed - try redirect approach
        console.log("[Auth] Popup OAuth failed, trying redirect approach...");
        setSubmitting(false);
        setError("");
        try {
          await signInWithGoogleRedirect();
          // This will navigate away from the page
          return;
        } catch (redirectErr: any) {
          errorMessage = "Failed to sign in with Google. Please try again or use email/password.";
        }
      }
      
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      setError("Please enter your email address");
      return;
    }

    setResetSubmitting(true);
    setError("");

    try {
      await requestPasswordReset(resetEmail);
      setResetSuccess(true);
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetSuccess(false);
        setResetEmail("");
      }, 3000);
    } catch (err: any) {
      console.error("[Auth] Password reset error:", err);
      setError(err.message || "Failed to send reset email. Please try again.");
    } finally {
      setResetSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
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
          <View style={styles.logoContainer}>
            <Image
              source={require("@/assets/images/Chesbon_app_Logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.title}>{isSignUp ? "Create Account" : "Welcome Back"}</Text>
            <Text style={styles.subtitle}>
              {isSignUp ? "Sign up to get started" : "Sign in to continue"}
            </Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {isSignUp && (
              <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor={colors.textSecondary}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!submitting}
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
              editable={!submitting}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
            />

            {!isSignUp && (
              <TouchableOpacity
                onPress={() => setShowForgotPassword(true)}
                disabled={submitting}
              >
                <Text style={styles.forgotPassword}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{isSignUp ? "Sign Up" : "Sign In"}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setIsSignUp(!isSignUp);
                setError("");
              }}
              disabled={submitting}
            >
              <Text style={styles.switchText}>
                {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
              </Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.socialButton, submitting && styles.buttonDisabled]}
              onPress={handleGoogleSignIn}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Modal */}
      <Modal
        visible={showForgotPassword}
        transparent
        animationType="fade"
        onRequestClose={() => setShowForgotPassword(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            
            {resetSuccess ? (
              <View style={styles.successContainer}>
                <Text style={styles.successIcon}>✓</Text>
                <Text style={styles.successText}>
                  Password reset email sent! Check your inbox.
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalSubtitle}>
                  Enter your email address and we'll send you a link to reset your password.
                </Text>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={colors.textSecondary}
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!resetSubmitting}
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonSecondary]}
                    onPress={() => {
                      setShowForgotPassword(false);
                      setResetEmail("");
                      setError("");
                    }}
                    disabled={resetSubmitting}
                  >
                    <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonPrimary, resetSubmitting && styles.buttonDisabled]}
                    onPress={handleForgotPassword}
                    disabled={resetSubmitting}
                  >
                    {resetSubmitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalButtonTextPrimary}>Send Reset Link</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
  },
  formContainer: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 32,
    textAlign: "center",
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
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  forgotPassword: {
    color: colors.primary,
    fontSize: 14,
    textAlign: "right",
    marginBottom: 16,
  },
  switchText: {
    color: colors.primary,
    fontSize: 14,
    textAlign: "center",
    marginTop: 16,
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
    color: colors.textSecondary,
    fontSize: 14,
    marginHorizontal: 16,
  },
  socialButton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  socialButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modalButtonSecondary: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalButtonTextPrimary: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  modalButtonTextSecondary: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  successContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  successIcon: {
    fontSize: 48,
    color: "#34C759",
    marginBottom: 16,
  },
  successText: {
    fontSize: 16,
    color: colors.text,
    textAlign: "center",
  },
});
