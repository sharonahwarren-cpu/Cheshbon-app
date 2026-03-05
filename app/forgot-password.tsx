
import React, { useState } from 'react';
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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { apiPost } from '@/utils/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const showError = (message: string) => {
    console.error('[FORGOT PASSWORD] Error:', message);
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  const handleSubmit = async () => {
    console.log('[FORGOT PASSWORD] Submit button pressed');
    console.log('[FORGOT PASSWORD] Email:', email);

    if (!email.trim()) {
      showError('Please enter your email address.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      // Better Auth endpoint is /api/auth/forget-password (not "forgot")
      // Also try /api/auth/request-password-reset as fallback
      console.log('[FORGOT PASSWORD] Calling /api/auth/forget-password...');
      const response = await apiPost('/api/auth/forget-password', { email: email.trim(), redirectTo: '/reset-password' });
      console.log('[FORGOT PASSWORD] Success:', response);
      // Always show success modal (backend doesn't reveal if email exists)
      setSuccessModalVisible(true);
    } catch (error: any) {
      console.error('[FORGOT PASSWORD] Error:', error);
      // Extract clean error message from API error format "API error: 400 - {...}"
      let errorMessage = 'Failed to send reset link. Please try again.';
      if (error.message) {
        const match = error.message.match(/API error: \d+ - (.+)/);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]);
            errorMessage = parsed.error || parsed.message || errorMessage;
          } catch {
            errorMessage = match[1] || errorMessage;
          }
        } else {
          errorMessage = error.message;
        }
      }
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessModalVisible(false);
    router.replace('/auth');
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Forgot Password',
          headerBackTitle: 'Back',
        }}
      />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.iconContainer}>
              <IconSymbol
                ios_icon_name="lock.fill"
                android_material_icon_name="lock"
                size={64}
                color={colors.primary}
              />
            </View>

            <Text style={styles.title}>Reset Your Password</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we'll send you a link to reset your password.
            </Text>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <IconSymbol
                  ios_icon_name="envelope.fill"
                  android_material_icon_name="email"
                  size={20}
                  color={colors.textSecondary}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email Address"
                  placeholderTextColor={colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  autoCorrect={false}
                  editable={!loading}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <IconSymbol
                      ios_icon_name="paperplane.fill"
                      android_material_icon_name="send"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.buttonText}>Send Reset Link</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
                disabled={loading}
              >
                <Text style={styles.backButtonText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.helpContainer}>
              <Text style={styles.helpText}>
                Need help? Contact us at{' '}
                <Text style={styles.helpEmail}>cheshbon.app.me@gmail.com</Text>
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Success Modal */}
        <Modal
          visible={successModalVisible}
          transparent
          animationType="fade"
          onRequestClose={handleSuccessClose}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.successModal}>
              <View style={styles.successModalHeader}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={64}
                  color={colors.success}
                />
                <Text style={styles.successModalTitle}>Email Sent!</Text>
              </View>
              <Text style={styles.successModalMessage}>
                If an account with that email exists, a password reset link has been sent.
                Please check your inbox and spam folder.
              </Text>
              <Text style={styles.successModalNote}>
                The link will expire in 1 hour.
              </Text>
              <TouchableOpacity
                style={styles.successModalButton}
                onPress={handleSuccessClose}
              >
                <Text style={styles.successModalButtonText}>Back to Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Error Modal */}
        <Modal
          visible={errorModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setErrorModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.errorModal}>
              <View style={styles.errorModalHeader}>
                <IconSymbol
                  ios_icon_name="exclamationmark.triangle.fill"
                  android_material_icon_name="warning"
                  size={48}
                  color={colors.error}
                />
                <Text style={styles.errorModalTitle}>Error</Text>
              </View>
              <Text style={styles.errorModalMessage}>{errorMessage}</Text>
              <TouchableOpacity
                style={styles.errorModalButton}
                onPress={() => setErrorModalVisible(false)}
              >
                <Text style={styles.errorModalButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  form: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  helpContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: colors.highlight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  helpText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  helpEmail: {
    color: colors.primary,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  successModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  successModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 12,
  },
  successModalMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  successModalNote: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 20,
  },
  successModalButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 10,
    minWidth: 200,
    alignItems: 'center',
  },
  successModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  errorModalHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  errorModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 8,
  },
  errorModalMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  errorModalButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  errorModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
