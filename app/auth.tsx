
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
import { Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import * as AppleAuthentication from 'expo-apple-authentication';

type Mode = 'signin' | 'signup';

export default function AuthScreen() {
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithApple,
    signInWithBiometrics,
    checkBiometricsAvailable,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  // Error modal state (no Alert.alert - web compatible)
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const showError = (message: string) => {
    console.error('[AUTH SCREEN] Error:', message);
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  // Check biometrics availability
  useEffect(() => {
    console.log('🔐 [AUTH SCREEN] Checking biometrics availability...');
    if (checkBiometricsAvailable) {
      checkBiometricsAvailable()
        .then((available) => {
          console.log('🔐 [AUTH SCREEN] Biometrics available:', available);
          setBiometricsAvailable(available);
        })
        .catch(() => setBiometricsAvailable(false));
    }
  }, []);

  // Check Apple Authentication availability
  useEffect(() => {
    console.log('📞 [AUTH SCREEN] Checking Apple Authentication availability...');
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        console.log('📞 [AUTH SCREEN] Apple Authentication available:', available);
        setAppleAuthAvailable(available);
      })
      .catch(() => setAppleAuthAvailable(false));
  }, []);

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
      } else {
        console.log('📧 [AUTH SCREEN] Calling signInWithEmail...');
        await signInWithEmail(email.trim(), password);
        console.log('✅ [AUTH SCREEN] Sign in successful');
      }
      // Navigation is handled by AuthBootstrap in _layout.tsx
    } catch (error: any) {
      console.error('❌ [AUTH SCREEN] Email auth error:', error);
      showError(error.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log('📱 [AUTH SCREEN] Google sign-in button pressed');
    setLoading(true);
    try {
      console.log('📱 [AUTH SCREEN] Calling signInWithGoogle...');
      await signInWithGoogle();
      console.log('✅ [AUTH SCREEN] Google sign-in flow initiated');
    } catch (error: any) {
      console.error('❌ [AUTH SCREEN] Google sign-in error:', error);
      showError(error.message || 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    console.log('📞 [AUTH SCREEN] Apple sign-in button pressed');
    setLoading(true);
    try {
      console.log('📞 [AUTH SCREEN] Calling signInWithApple...');
      await signInWithApple();
      console.log('✅ [AUTH SCREEN] Apple sign-in successful');
    } catch (error: any) {
      console.error('❌ [AUTH SCREEN] Apple sign-in error:', error);
      if (error.message !== 'Apple Sign-In was cancelled') {
        showError(error.message || 'Apple sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricSignIn = async () => {
    console.log('🔐 [AUTH SCREEN] Biometric sign-in button pressed');
    setLoading(true);
    try {
      console.log('🔐 [AUTH SCREEN] Calling signInWithBiometrics...');
      if (signInWithBiometrics) {
        await signInWithBiometrics();
        console.log('✅ [AUTH SCREEN] Biometric sign-in successful');
      }
    } catch (error: any) {
      console.error('❌ [AUTH SCREEN] Biometric sign-in error:', error);
      showError(error.message || 'Biometric authentication failed.');
    } finally {
      setLoading(false);
    }
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

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social / Biometric Buttons */}
            <View style={styles.socialButtons}>
              {/* Biometric - only show if available AND not in sign-up mode */}
              {biometricsAvailable && mode === 'signin' && signInWithBiometrics && (
                <TouchableOpacity
                  style={[styles.button, styles.biometricButton, loading && styles.buttonDisabled]}
                  onPress={handleBiometricSignIn}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <IconSymbol
                    ios_icon_name="faceid"
                    android_material_icon_name="fingerprint"
                    size={24}
                    color="#fff"
                  />
                  <Text style={styles.buttonText}>
                    {Platform.OS === 'ios' ? 'Face ID / Touch ID' : 'Biometric Sign In'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Google */}
              <TouchableOpacity
                style={[styles.button, styles.googleButton, loading && styles.buttonDisabled]}
                onPress={handleGoogleSignIn}
                disabled={loading}
                activeOpacity={0.8}
              >
                <IconSymbol
                  ios_icon_name="globe"
                  android_material_icon_name="language"
                  size={24}
                  color="#fff"
                />
                <Text style={styles.buttonText}>Continue with Google</Text>
              </TouchableOpacity>

              {/* Apple - only on iOS */}
              {appleAuthAvailable && (
                <TouchableOpacity
                  style={[styles.button, styles.appleButton, loading && styles.buttonDisabled]}
                  onPress={handleAppleSignIn}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <IconSymbol
                    ios_icon_name="apple.logo"
                    android_material_icon_name="phone-iphone"
                    size={24}
                    color="#fff"
                  />
                  <Text style={styles.buttonText}>Continue with Apple</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Demo hint */}
            <View style={styles.demoHint}>
              <Text style={styles.demoHintText}>Demo: test@cheshbon.com / password123</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Error Modal - web-compatible, no Alert.alert */}
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
  biometricButton: {
    backgroundColor: '#8B5CF6',
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  appleButton: {
    backgroundColor: '#1C1C1E',
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 12,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  socialButtons: {
    gap: 0,
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
