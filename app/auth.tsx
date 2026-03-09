
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { signInWithEmail, signUpWithEmail } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  // Error modal state
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Success modal for email verification
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const showError = (message: string) => {
    console.error('[AUTH SCREEN] Error:', message);
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  // Check for verified query parameter
  useEffect(() => {
    if (params.verified === 'true') {
      console.log('✅ [AUTH SCREEN] Email verified successfully');
      setSuccessMessage('Email verified successfully! You can now sign in.');
      setSuccessModalVisible(true);
      setMode('signin');
    }
  }, [params.verified]);

  const handleEmailAuth = async () => {
    console.log(`📧 [AUTH SCREEN] ${mode === 'signup' ? 'Sign up' : 'Sign in'} button pressed`);
    console.log('📧 [AUTH SCREEN] Email:', email);

    if (!email.trim() || !password.trim()) {
      showError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        console.log('📧 [AUTH SCREEN] Calling signUpWithEmail...');
        await signUpWithEmail(email.trim(), password, name.trim() || undefined);
        console.log('✅ [AUTH SCREEN] Sign up successful');
        setSuccessMessage('Account created! Please check your email to verify your account.');
        setSuccessModalVisible(true);
      } else {
        console.log('📧 [AUTH SCREEN] Calling signInWithEmail...');
        await signInWithEmail(email.trim(), password);
        console.log('✅ [AUTH SCREEN] Sign in successful');
      }
    } catch (error: any) {
      console.error('❌ [AUTH SCREEN] Email auth error:', error);
      showError(error.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    console.log('📧 [AUTH SCREEN] Forgot password pressed - navigating to forgot password screen');
    router.push('/forgot-password');
  };

  const modeText = mode === 'signup' ? 'Create Account' : 'Sign In';
  const switchModeText =
    mode === 'signup' ? 'Already have an account? Sign In' : "Don't have an account? Sign Up";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.header}>
              <Image
                source={require('@/assets/images/Chesbon_app_Logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.title}>Cheshbon</Text>
              <Text style={styles.subtitle}>{modeText}</Text>
            </View>

            {/* Email/Password Form */}
            <View style={styles.form}>
              {mode === 'signup' && (
                <View style={styles.inputContainer}>
                  <IconSymbol
                    ios_icon_name="person.fill"
                    android_material_icon_name="person"
                    size={20}
                    color={colors.textSecondary}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name (optional)"
                    placeholderTextColor={colors.textSecondary}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    autoComplete="name"
                    editable={!loading}
                  />
                </View>
              )}

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
                />
              </View>

              <View style={styles.inputContainer}>
                <IconSymbol
                  ios_icon_name="lock.fill"
                  android_material_icon_name="lock"
                  size={20}
                  color={colors.textSecondary}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  editable={!loading}
                />
              </View>

              {/* Forgot Password Link - only show in sign-in mode */}
              {mode === 'signin' && (
                <TouchableOpacity
                  style={styles.forgotPasswordButton}
                  onPress={handleForgotPassword}
                  disabled={loading}
                >
                  <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleEmailAuth}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <IconSymbol
                      ios_icon_name={
                        mode === 'signup' ? 'person.badge.plus' : 'arrow.right.circle.fill'
                      }
                      android_material_icon_name={mode === 'signup' ? 'person-add' : 'login'}
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.buttonText}>{modeText}</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchModeButton}
                onPress={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setEmail('');
                  setPassword('');
                  setName('');
                }}
                disabled={loading}
              >
                <Text style={styles.switchModeText}>{switchModeText}</Text>
              </TouchableOpacity>
            </View>

            {/* Info hint */}
            <View style={styles.demoHint}>
              <Text style={styles.demoHintText}>
                Powered by Supabase Auth. Your data is secure and encrypted.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

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
                  size={32}
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

        {/* Success Modal */}
        <Modal
          visible={successModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSuccessModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.errorModal}>
              <View style={styles.errorModalHeader}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={32}
                  color={colors.primary}
                />
                <Text style={styles.errorModalTitle}>Success</Text>
              </View>
              <Text style={styles.errorModalMessage}>{successMessage}</Text>
              <TouchableOpacity
                style={styles.errorModalButton}
                onPress={() => setSuccessModalVisible(false)}
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
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 12,
    borderRadius: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  form: {
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
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
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
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
  switchModeButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchModeText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  demoHint: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.highlight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  demoHintText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
