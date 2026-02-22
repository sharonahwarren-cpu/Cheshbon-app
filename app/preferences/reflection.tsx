
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedGet, authenticatedPut } from '@/utils/api';

interface UserPreferences {
  reflectionCategoriesEnabled?: boolean;
  reflectionCategories?: string[];
}

const BEHAVIOR_CATEGORIES = ['Action', 'Speech', 'Thought', 'Feeling'];

export default function ReflectionPreferencesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>({
    reflectionCategoriesEnabled: true,
    reflectionCategories: BEHAVIOR_CATEGORIES,
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    console.log('Loading reflection preferences');
    setLoading(true);
    try {
      const data = await authenticatedGet<UserPreferences>('/api/user-preferences');
      const prefs = (data as any)?.data || data;
      let categories = prefs.reflectionCategories ?? BEHAVIOR_CATEGORIES;
      if (typeof categories === 'string') {
        try { categories = JSON.parse(categories); } catch { categories = BEHAVIOR_CATEGORIES; }
      }
      setPreferences({
        reflectionCategoriesEnabled: prefs.reflectionCategoriesEnabled ?? true,
        reflectionCategories: Array.isArray(categories) ? categories : BEHAVIOR_CATEGORIES,
      });
    } catch (error) {
      console.error('Error loading preferences:', error);
      showError('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async (updatedPreferences: UserPreferences) => {
    console.log('Saving reflection preferences:', updatedPreferences);
    setSaving(true);
    try {
      await authenticatedPut('/api/user-preferences', updatedPreferences);
      showSuccess('Preferences saved');
    } catch (error) {
      console.error('Error saving preferences:', error);
      showError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(''), 3000);
  };

  const toggleReflectionCategories = async (value: boolean) => {
    const updated = { ...preferences, reflectionCategoriesEnabled: value };
    setPreferences(updated);
    await savePreferences(updated);
  };

  const toggleCategory = async (category: string) => {
    const currentCategories = preferences.reflectionCategories || [];
    const updatedCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category];
    
    const updated = { ...preferences, reflectionCategories: updatedCategories };
    setPreferences(updated);
    await savePreferences(updated);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ title: 'Reflection', headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: 'Reflection', headerShown: true }} />
      
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

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Behavior Categories</Text>
            <Switch
              value={preferences.reflectionCategoriesEnabled}
              onValueChange={toggleReflectionCategories}
              trackColor={{ false: colors.cardBorder, true: colors.primary }}
              thumbColor="#FFFFFF"
              disabled={saving}
            />
          </View>
          <Text style={styles.sectionDescription}>
            Enable or disable specific behavior categories for reflections
          </Text>
          {preferences.reflectionCategoriesEnabled && (
            <View style={styles.categoriesContainer}>
              {BEHAVIOR_CATEGORIES.map((category) => {
                const isEnabled = (preferences.reflectionCategories || []).includes(category);
                return (
                  <TouchableOpacity
                    key={category}
                    style={[styles.categoryChip, isEnabled && styles.categoryChipActive]}
                    onPress={() => toggleCategory(category)}
                    disabled={saving}
                  >
                    <Text style={[styles.categoryChipText, isEnabled && styles.categoryChipTextActive]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
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
  },
  scrollContent: {
    padding: 20,
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
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: colors.text,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
