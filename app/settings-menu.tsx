
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';

export default function SettingsMenuScreen() {
  const router = useRouter();

  const settingsOptions = [
    {
      id: 'goals',
      title: 'Goals',
      icon: 'flag',
      iosIcon: 'flag',
      section: 'goals',
    },
    {
      id: 'strategies',
      title: 'Strategies',
      icon: 'lightbulb',
      iosIcon: 'lightbulb',
      section: 'strategies',
    },
    {
      id: 'gains-losses',
      title: 'Gains & Losses',
      icon: 'swap-vert',
      iosIcon: 'arrow.up.arrow.down',
      section: 'gainsLosses',
    },
    {
      id: 'life-areas',
      title: 'Life Areas',
      icon: 'category',
      iosIcon: 'square.grid.2x2',
      section: 'lifeAreas',
    },
    {
      id: 'currencies',
      title: 'Currencies',
      icon: 'attach-money',
      iosIcon: 'dollarsign.circle',
      section: 'currencies',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Settings',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>
            Manage your goals, strategies, life areas, and more
          </Text>
        </View>

        <View style={styles.optionsList}>
          {settingsOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.optionButton}
              onPress={() => {
                console.log('Navigating to settings section:', option.section);
                router.push(`/(tabs)/settings?section=${option.section}` as any);
              }}
            >
              <View style={styles.optionLeft}>
                <View style={styles.iconContainer}>
                  <IconSymbol
                    ios_icon_name={option.iosIcon}
                    android_material_icon_name={option.icon}
                    size={24}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.optionTitle}>{option.title}</Text>
              </View>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="chevron-right"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          ))}
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  header: {
    paddingTop: Platform.OS === 'android' ? 20 : 10,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  optionsList: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
});
