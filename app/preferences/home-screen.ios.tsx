
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedGet, authenticatedPut } from '@/utils/api';

const HOME_SCREEN_OPTIONS = [
  { value: 'reflect', label: 'Reflect', description: 'Start with reflection screen' },
  { value: 'goals-detailed', label: 'Goals Detailed', description: 'View goals in detailed mode' },
  { value: 'goals-concise', label: 'Goals Concise', description: 'View goals in concise mode' },
];

export default function HomeScreenPreferencesScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferredHomeScreen, setPreferredHomeScreen] = useState<'reflect' | 'goals-detailed' | 'goals-concise'>('reflect');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    console.log('[HomeScreenPreferences] Loading home screen preference');
    setLoading(true);
    try {
      const data = await authenticatedGet<any>('/api/user-preferences');
      const prefs = (data as any)?.data || data;
      setPreferredHomeScreen(prefs.preferredHomeScreen ?? 'reflect');
    } catch (error) {
      console.error('[HomeScreenPreferences] Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectHomeScreen = async (value: 'reflect' | 'goals-detailed' | 'goals-concise') => {
    setPreferredHomeScreen(value);
    setSaving(true);
    try {
      await authenticatedPut('/api/user-preferences', { preferredHomeScreen: value });
      console.log('[HomeScreenPreferences] Home screen preference saved:', value);
      setSuccessMessage('Preferences saved');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('[HomeScreenPreferences] Error saving preferences:', error);
      setErrorMessage('Failed to save preferences');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen 
        options={{ 
          title: 'Home Screen', 
          headerShown: true,
          headerBackTitle: 'Preferences',
        }} 
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {successMessage ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <Text style={styles.description}>
          Choose which screen to show first when you open the app
        </Text>
        
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 8 }} />
        ) : (
          <View style={styles.homeScreenOptions}>
            {HOME_SCREEN_OPTIONS.map((option) => {
              const isSelected = preferredHomeScreen === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.homeScreenOption, isSelected && styles.homeScreenOptionSelected]}
                  onPress={() => selectHomeScreen(option.value as any)}
                  disabled={saving}
                >
                  <View style={styles.homeScreenOptionContent}>
                    <View style={styles.homeScreenOptionText}>
                      <Text style={[styles.homeScreenOptionLabel, isSelected && styles.homeScreenOptionLabelSelected]}>
                        {option.label}
                      </Text>
                      <Text style={[styles.homeScreenOptionDesc, isSelected && styles.homeScreenOptionDescSelected]}>
                        {option.description}
                      </Text>
                    </View>
                    {isSelected && (
                      <IconSymbol
                        ios_icon_name="checkmark.circle.fill"
                        android_material_icon_name="check-circle"
                        size={20}
                        color={colors.primary}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
  },
  successBanner: {
    backgroundColor: colors.success,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: colors.error,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  homeScreenOptions: {
    gap: 8,
  },
  homeScreenOption: {
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    borderWidth: 2,
    borderColor: colors.cardBorder,
  },
  homeScreenOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  homeScreenOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homeScreenOptionText: {
    flex: 1,
    marginRight: 8,
  },
  homeScreenOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  homeScreenOptionLabelSelected: {
    color: colors.primary,
  },
  homeScreenOptionDesc: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  homeScreenOptionDescSelected: {
    color: colors.primary,
    opacity: 0.8,
  },
});
