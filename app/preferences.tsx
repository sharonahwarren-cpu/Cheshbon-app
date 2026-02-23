
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Switch,
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
    route: '/preferences/home-screen',
    title: 'Home Screen',
    description: 'Choose which screen to show first when you open the app',
    iosIcon: 'house.fill',
    androidIcon: 'home',
  },
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
    route: '/alarms',
    title: 'Alarms',
    description: 'Create and manage smart alarms with astronomical, calendar, and location triggers',
    iosIcon: 'alarm.fill',
    androidIcon: 'alarm',
  },
  {
    route: '/preferences/alternative-calendars',
    title: 'Alternative Calendars',
    description: 'Use Hebrew, Chinese, or Islamic calendar alongside Gregorian',
    iosIcon: 'calendar',
    androidIcon: 'calendar-today',
  },
];

export default function PreferencesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userPreferences, setUserPreferences] = useState<any>({});
  const [useAiCheshbon, setUseAiCheshbon] = useState(false);

  useEffect(() => {
    console.log('[Preferences] Screen loaded - loading user preferences');
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await authenticatedGet('/api/user-preferences');
      const prefs = response?.data || response || {};
      console.log('[Preferences] Loaded preferences:', prefs);
      setUserPreferences(prefs);
      setUseAiCheshbon(prefs.useAiCheshbon || false);
    } catch (error) {
      console.error('[Preferences] Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAiCheshbon = async (value: boolean) => {
    console.log('[Preferences] Toggling AI Cheshbon:', value);
    setUseAiCheshbon(value);
    
    try {
      await authenticatedPut('/api/user-preferences', { useAiCheshbon: value });
      console.log('[Preferences] AI Cheshbon preference saved');
    } catch (error) {
      console.error('[Preferences] Error saving AI Cheshbon preference:', error);
      // Revert on error
      setUseAiCheshbon(!value);
    }
  };

  const isHebrewCalendar = userPreferences.alternativeCalendar === 'hebrew';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Preferences', headerShown: true }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionGroupTitle}>Settings</Text>

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

        {isHebrewCalendar && (
          <>
            <Text style={[styles.sectionGroupTitle, { marginTop: 24 }]}>Hebrew Calendar Features</Text>
            
            <View style={styles.sectionCard}>
              <View style={styles.iconContainer}>
                <IconSymbol
                  ios_icon_name="mic.fill"
                  android_material_icon_name="mic"
                  size={24}
                  color={colors.primary}
                />
              </View>
              <View style={styles.sectionTextContainer}>
                <Text style={styles.sectionTitle}>Use AI to do Cheshbon on Mitzvot</Text>
                <Text style={styles.sectionDescription}>
                  Enable AI-powered voice reflection and mitzvot tracking
                </Text>
              </View>
              <Switch
                value={useAiCheshbon}
                onValueChange={handleToggleAiCheshbon}
                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                thumbColor={useAiCheshbon ? colors.primary : colors.textSecondary}
              />
            </View>
          </>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 100,
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
