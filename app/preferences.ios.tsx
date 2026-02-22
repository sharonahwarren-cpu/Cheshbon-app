
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedGet, authenticatedPut } from '@/utils/api';

const HOME_SCREEN_OPTIONS = [
  { value: 'reflect', label: 'Reflect', description: 'Start with reflection screen' },
  { value: 'goals-detailed', label: 'Goals Detailed', description: 'View goals in detailed mode' },
  { value: 'goals-concise', label: 'Goals Concise', description: 'View goals in concise mode' },
];

const PREFERENCE_SECTIONS = [
  {
    route: '/preferences/reflection',
    title: 'Reflection',
    description: 'Configure behavior categories for reflections',
    iosIcon: 'brain.head.profile',
    androidIcon: 'psychology',
  },
  {
    route: '/preferences/notification',
    title: 'Notifications',
    description: 'Set up notification alarms and reminders',
    iosIcon: 'bell.fill',
    androidIcon: 'notifications',
  },
  {
    route: '/preferences/home-screen',
    title: 'Alternative Calendars',
    description: 'Use Hebrew or Chinese calendar alongside Gregorian',
    iosIcon: 'calendar',
    androidIcon: 'calendar-today',
  },
];

export default function PreferencesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferredHomeScreen, setPreferredHomeScreen] = useState<'reflect' | 'goals-detailed' | 'goals-concise'>('reflect');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    console.log('[Preferences] Loading home screen preference');
    setLoading(true);
    try {
      const data = await authenticatedGet<any>('/api/user-preferences');
      const prefs = (data as any)?.data || data;
      setPreferredHomeScreen(prefs.preferredHomeScreen ?? 'reflect');
    } catch (error) {
      console.error('[Preferences] Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectHomeScreen = async (value: 'reflect' | 'goals-detailed' | 'goals-concise') => {
    setPreferredHomeScreen(value);
    setSaving(true);
    try {
      await authenticatedPut('/api/user-preferences', { preferredHomeScreen: value });
      console.log('[Preferences] Home screen preference saved:', value);
      setSuccessMessage('Preferences saved');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('[Preferences] Error saving preferences:', error);
      setErrorMessage('Failed to save preferences');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Preferences', headerShown: true }} />

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

        {/* Home Screen Section - Inline */}
        <View style={styles.inlineSection}>
          <View style={styles.inlineSectionHeader}>
            <View style={styles.iconContainer}>
              <IconSymbol
                ios_icon_name="house.fill"
                android_material_icon_name="home"
                size={22}
                color={colors.primary}
              />
            </View>
            <Text style={styles.inlineSectionTitle}>Home Screen</Text>
          </View>
          <Text style={styles.inlineSectionDescription}>
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
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Other Preference Sections */}
        <Text style={styles.sectionGroupTitle}>More Settings</Text>

        {PREFERENCE_SECTIONS.map((section) => (
          <TouchableOpacity
            key={section.route}
            style={styles.sectionCard}
            onPress={() => {
              console.log(`Navigating to ${section.route}`);
              router.push(section.route as any);
            }}
          >
            <View style={styles.iconContainer}>
              <IconSymbol
                ios_icon_name={section.iosIcon}
                android_material_icon_name={section.androidIcon}
                size={24}
                color={colors.primary}
              />
            </View>
            <View style={styles.sectionTextContainer}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionDescription}>{section.description}</Text>
            </View>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="chevron-right"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ))}
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
  inlineSection: {
    marginBottom: 8,
  },
  inlineSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  inlineSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  inlineSectionDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
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
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: 20,
  },
  sectionGroupTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  sectionTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 3,
  },
  sectionDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
