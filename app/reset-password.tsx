
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
  Modal,
  Image,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { resetPassword } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    console.log("Reset password screen loaded with params:", params);
    const tokenParam = params.token;
    if (tokenParam) {
      setToken(Array.isArray(tokenParam) ? tokenParam[0] : tokenParam);
    } else {
      showError("Invalid reset link. Please request a new password reset.");
    }
  }, [params]);

  const showError = (message: string) => {
    console.log("Showing error:", message);
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  const showSuccess = () => {
    console.log("Password reset successful");
    setSuccessModalVisible(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      showError("Please enter and confirm your new password");
      return;
    }

    if (newPassword.length < 8) {
      showError("Password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      showError("Passwords do not match");
      return;
    }

    if (!token) {
      showError("Invalid reset token. Please request a new password reset.");
      return;
    }

    setLoading(true);
    try {
      console.log("User tapped Reset Password button");
      await resetPassword(token, newPassword);
      showSuccess();
    } catch (error: any) {
      showError(error.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessModalVisible(false);
    router.replace("/auth");
  };

  return (
    <>
      <Stack.Screen options={{ title: "Reset Password", headerShown: true }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            {/* App Logo */}
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/Chesbon_app_Logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            <Text style={styles.title}>Reset Your Password</Text>
            <Text style={styles.subtitle}>
              Enter your new password below. Make sure it's at least 8 characters long.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="New Password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Reset Password</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace("/auth")}
            >
              <Text style={styles.backButtonText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Error Modal */}
        <Modal
          visible={errorModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setErrorModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.alertModal}>
              <Text style={styles.alertTitle}>Error</Text>
              <Text style={styles.alertMessage}>{errorMessage}</Text>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={() => setErrorModalVisible(false)}
              >
                <Text style={styles.alertButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Success Modal */}
        <Modal
          visible={successModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={handleSuccessClose}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.alertModal}>
              <Text style={styles.alertTitle}>Success</Text>
              <Text style={styles.alertMessage}>
                Your password has been reset successfully! You can now sign in with your new password.
              </Text>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={handleSuccessClose}
              >
                <Text style={styles.alertButtonText}>Go to Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
    color: "#000",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  primaryButton: {
    height: 50,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  backButton: {
    marginTop: 16,
    alignItems: "center",
  },
  backButtonText: {
    color: "#007AFF",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  alertModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 40,
    width: "80%",
    maxWidth: 400,
    alignItems: "center",
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
    marginBottom: 12,
  },
  alertMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  alertButton: {
    backgroundColor: "#007AFF",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 100,
  },
  alertButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    textAlign: "center",
  },
});
