
import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import Toast from 'react-native-toast-message';
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
  const { user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, signInWithGoogleRedirect, requestPasswordReset } = useAuth();
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

  // Track which button was pressed for better debugging
  const [activeAuthMethod, setActiveAuthMethod] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      console.log("[Auth Screen] ✅ User authenticated, redirecting to home. User:", user.email);
      Toast.show({
        type: 'success',
        text1: 'Welcome back!',
        text2: `Signed in as ${user.email}`,
        position: 'top',
        visibilityTime: 2000,
      });
      router.replace("/");
    }
  }, [user, loading]);

  const showErrorToast = (title: string, message: string) => {
    console.error(`[Auth Screen] ❌ ${title}: ${message}`);
    setError(message);
    Toast.show({
      type: 'error',
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 4000,
    });
  };

  const showSuccessToast = (title: string, message: string) => {
    console.log(`[Auth Screen] ✅ ${title}: ${message}`);
    Toast.show({
      type: 'success',
      text1: title,
      text2: message,
      position: 'top',
      visibilityTime: 3000,
    });
  };

  const handleSubmit = async () => {
    console.log("[Auth Screen] 📧 Email/password submit button pressed");
    console.log("[Auth Screen] Platform:", Platform.OS);
    console.log("[Auth Screen] Is Sign Up:", isSignUp);
    console.log("[Auth Screen] Email:", email);
    
    if (!email || !password) {
      showErrorToast("Missing Information", "Please fill in all fields");
      return;
    }

    if (isSignUp && !name) {
      showErrorToast("Missing Information", "Please enter your name");
      return;
    }

    setSubmitting(true);
    setActiveAuthMethod('email');
    setError("");

    try {
      if (isSignUp) {
        console.log("[Auth Screen] 🔐 Attempting sign up with email:", email);
        await signUpWithEmail(email, password, name);
        console.log("[Auth Screen] ✅ Email sign up successful");
        showSuccessToast("Account Created", "Welcome to Cheshbon!");
      } else {
        console.log("[Auth Screen] 🔐 Attempting sign in with email:", email);
        await signInWithEmail(email, password);
        console.log("[Auth Screen] ✅ Email sign in successful");
        showSuccessToast("Signed In", "Welcome back!");
      }
      // Navigation will happen automatically via useEffect when user state updates
    } catch (err: any) {
      console.error("[Auth Screen] ❌ Email auth error:", err);
      console.error("[Auth Screen] Error details:", {
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
      showErrorToast(
        "Authentication Failed",
        err.message || "Failed to authenticate. Please check your credentials and try again."
      );
    } finally {
      setSubmitting(false);
      setActiveAuthMethod(null);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log("[Auth Screen] 🔵 Google sign-in button pressed");
    console.log("[Auth Screen] Platform:", Platform.OS);
    console.log("[Auth Screen] Device info:", {
      os: Platform.OS,
      version: Platform.Version,
    });
    
    setSubmitting(true);
    setActiveAuthMethod('google');
    setError("");

    try {
      console.log("[Auth Screen] 🔐 Calling signInWithGoogle()...");
      const startTime = Date.now();
      
      await signInWithGoogle();
      
      const duration = Date.now() - startTime;
      console.log("[Auth Screen] ✅ Google sign-in completed successfully in", duration, "ms");
      showSuccessToast("Signed In", "Welcome back!");
      // Navigation will happen automatically via useEffect when user state updates
    } catch (err: any) {
      console.error("[Auth Screen] ❌ Google sign in error:", err);
      console.error("[Auth Screen] Error details:", {
        message: err.message,
        stack: err.stack,
        name: err.name,
        cause: err.cause,
      });
      
      // Show user-friendly error message
      let errorTitle = "Google Sign-In Failed";
      let errorMessage = "Failed to sign in with Google. Please try again.";
      
      if (err.message?.includes("popup")) {
        errorTitle = "Popup Blocked";
        errorMessage = "Please allow popups for this site and try again.";
      } else if (err.message?.includes("closed")) {
        errorTitle = "Sign-In Cancelled";
        errorMessage = "Sign-in was cancelled. Please try again.";
      } else if (err.message?.includes("session") || err.message?.includes("establish")) {
        errorTitle = "Session Error";
        errorMessage = "Failed to establish session. Trying alternative method...";
        
        // Try redirect approach
        console.log("[Auth Screen] 🔄 Popup OAuth failed, trying redirect approach...");
        setSubmitting(false);
        setActiveAuthMethod(null);
        setError("");
        try {
          await signInWithGoogleRedirect();
          // This will navigate away from the page
          return;
        } catch (redirectErr: any) {
          console.error("[Auth Screen] ❌ Redirect OAuth also failed:", redirectErr);
          errorMessage = "Failed to sign in with Google. Please try email/password instead.";
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      showErrorToast(errorTitle, errorMessage);
    } finally {
      setSubmitting(false);
      setActiveAuthMethod(null);
    }
  };

  const handleAppleSignIn = async () => {
    console.log("[Auth Screen] 🍎 Apple sign-in button pressed");
    console.log("[Auth Screen] Platform:", Platform.OS);
    console.log("[Auth Screen] Device info:", {
      os: Platform.OS,
      version: Platform.Version,
    });
    
    setSubmitting(true);
    setActiveAuthMethod('apple');
    setError("");

    try {
      console.log("[Auth Screen] 🔐 Calling signInWithApple()...");
      const startTime = Date.now();
      
      await signInWithApple();
      
      const duration = Date.now() - startTime;
      console.log("[Auth Screen] ✅ Apple sign-in completed successfully in", duration, "ms");
      showSuccessToast("Signed In", "Welcome back!");
      // Navigation will happen automatically via useEffect when user state updates
    } catch (err: any) {
      console.error("[Auth Screen] ❌ Apple sign in error:", err);
      console.error("[Auth Screen] Error details:", {
        message: err.message,
        stack: err.stack,
        name: err.name,
        cause: err.cause,
      });
      
      // Show user-friendly error message
      let errorTitle = "Apple Sign-In Failed";
      let errorMessage = "Failed to sign in with Apple. Please try again.";
      
      if (err.message?.includes("popup")) {
        errorTitle = "Popup Blocked";
        errorMessage = "Please allow popups for this site and try again.";
      } else if (err.message?.includes("closed")) {
        errorTitle = "Sign-In Cancelled";
        errorMessage = "Sign-in was cancelled. Please try again.";
      } else if (err.message?.includes("not available")) {
        errorTitle = "Not Available";
        errorMessage = "Apple Sign-In is not available on this device.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      showErrorToast(errorTitle, errorMessage);
    } finally {
      setSubmitting(false);
      setActiveAuthMethod(null);
    }
  };

  const handleForgotPassword = async () => {
    console.log("[Auth Screen] 🔑 Forgot password requested for:", resetEmail);
    
    if (!resetEmail) {
      showErrorToast("Missing Email", "Please enter your email address");
      return;
    }

    setResetSubmitting(true);
    setError("");

    try {
      console.log("[Auth Screen] 📧 Requesting password reset...");
      await requestPasswordReset(resetEmail);
      console.log("[Auth Screen] ✅ Password reset email sent");
      setResetSuccess(true);
      showSuccessToast("Email Sent", "Check your inbox for reset instructions");
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetSuccess(false);
        setResetEmail("");
      }, 3000);
    } catch (err: any) {
      console.error("[Auth Screen] ❌ Password reset error:", err);
      console.error("[Auth Screen] Error details:", {
        message: err.message,
        stack: err.stack,
      });
      showErrorToast(
        "Reset Failed",
        err.message || "Failed to send reset email. Please try again."
      );
    } finally {
      setResetSubmitting(false);
    }
  };

  if (loading) {
    console.log("[Auth Screen] ⏳ Loading authentication state...");
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const isButtonLoading = (method: string) => submitting && activeAuthMethod === method;

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
              {isButtonLoading('email') ? (
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
              {isButtonLoading('google') ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.socialButtonText}>Continue with Google</Text>
              )}
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.socialButton, styles.appleButton, submitting && styles.buttonDisabled]}
                onPress={handleAppleSignIn}
                disabled={submitting}
              >
                {isButtonLoading('apple') ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.appleButtonText}>Continue with Apple</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Debug Info (only visible in development) */}
            {__DEV__ && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugText}>Debug Info:</Text>
                <Text style={styles.debugText}>Platform: {Platform.OS}</Text>
                <Text style={styles.debugText}>Loading: {loading ? 'Yes' : 'No'}</Text>
                <Text style={styles.debugText}>User: {user ? user.email : 'None'}</Text>
                <Text style={styles.debugText}>Submitting: {submitting ? 'Yes' : 'No'}</Text>
                <Text style={styles.debugText}>Active Method: {activeAuthMethod || 'None'}</Text>
              </View>
            )}
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

      {/* Toast Message Component */}
      <Toast />
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
    marginBottom: 12,
  },
  socialButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
  appleButton: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  appleButtonText: {
    color: "#fff",
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
  debugContainer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  debugText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
