
import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from '@/utils/api';
import { colors } from '@/styles/commonStyles';
import { ConfirmModal } from '@/components/ConfirmModal';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IconSymbol } from '@/components/IconSymbol';
import { COLOR_PALETTE, COLOR_GRID_COLUMNS } from '@/utils/colorPalette';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Switch,
  Platform,
  BackHandler,
} from 'react-native';
import { Stack, useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';

interface LifeArea {
  id: string;
  name: string;
  parentId?: string | null;
  icon?: string;
  color?: string;
  displayOrder: number;
  showProgress: boolean;
  children?: LifeArea[];
  goals?: Array<{
    id: string;
    title: string;
    status: 'ACTIVE' | 'DEACTIVATED';
    successCount: number;
    struggleCount: number;
  }>;
  successPercentage?: number;
  percentageColor?: 'green' | 'red';
  successStatus?: 'green' | 'red';
}

interface Strategy {
  id: string;
  name: string;
  description?: string;
  linkedGoalIds?: string[];
  difficulties?: string;
  overcomeDifficulties?: string;
  confidenceRating?: number;
}

interface Currency {
  id: string;
  name: string;
  symbol?: string;
  type?: 'reward' | 'consequence';
  onSuccess?: 'ADD' | 'SUBTRACT' | 'NONE';
  onFailure?: 'ADD' | 'SUBTRACT' | 'NONE';
}

interface Goal {
  id: string;
  title: string;
  description?: string;
  type?: 'RESTRAINING' | 'PROACTIVE';
  status?: 'ACTIVE' | 'DEACTIVATED';
  progress?: number;
  completed?: boolean;
  rewardCurrencyId?: string;
  rewardCurrencyBalance?: number;
  rewardCurrencySymbol?: string;
  consequenceCurrencyId?: string;
  consequenceCurrencyBalance?: number;
  consequenceCurrencySymbol?: string;
  successCount?: number;
  struggleCount?: number;
  lifeAreaId?: string;
}

interface NotificationAlarm {
  id: string;
  name: string;
  time: string;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  dayOfWeek?: string;
  dayOfMonth?: number;
}

interface UserPreferences {
  notificationsEnabled: boolean;
  notificationAlarms?: NotificationAlarm[];
  reflectionCategoriesEnabled?: boolean;
  reflectionCategories?: string[];
}

interface CurrencyBalance {
  currencyId: string;
  currencyName: string;
  symbol: string;
  totalBalance: number;
  goalBreakdown?: Array<{ goalId: string; goalTitle: string; balance: number }>;
}

interface GainLoss {
  id: string;
  name: string;
  type: 'Gain' | 'Loss';
  category?: string;
  subCategory?: string;
}

interface ReflectionWorthItTallies {
  worthIt: number;
  notWorthIt: number;
  total: number;
}

type SettingsSection =
  | 'main'
  | 'goals'
  | 'life-areas'
  | 'strategies'
  | 'currencies'
  | 'gains-losses'
  | 'notifications'
  | 'reflection'
  | 'reports';

const ICON_OPTIONS = ['flag', 'star', 'heart', 'home', 'work', 'school', 'fitness', 'health'];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  iconButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  modalButtonSave: {
    backgroundColor: colors.primary,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalButtonTextSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 8,
  },
  successText: {
    color: '#10B981',
    fontSize: 14,
    marginTop: 8,
  },
});

export default function SettingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [currentSection, setCurrentSection] = useState<SettingsSection>('main');
  const [loading, setLoading] = useState(true);

  // Data states
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [gainsLosses, setGainsLosses] = useState<GainLoss[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    notificationsEnabled: false,
  });

  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [modalType, setModalType] = useState<'lifeArea' | 'strategy' | 'currency' | 'gainLoss' | 'alarm' | null>(null);

  // Form states
  const [formData, setFormData] = useState<any>({});

  // Get initial section from params
  const getInitialSection = useCallback((): SettingsSection => {
    const section = params.section as string;
    console.log('[Settings] getInitialSection - params.section:', section);
    
    if (section === 'goals') return 'goals';
    if (section === 'life-areas') return 'life-areas';
    if (section === 'strategies') return 'strategies';
    if (section === 'currencies') return 'currencies';
    if (section === 'gains-losses') return 'gains-losses';
    if (section === 'notifications') return 'notifications';
    if (section === 'reflection') return 'reflection';
    if (section === 'reports') return 'reports';
    
    return 'main';
  }, [params.section]);

  // Set section when params change
  useEffect(() => {
    const section = getInitialSection();
    console.log('[Settings] Setting currentSection to:', section);
    setCurrentSection(section);
  }, [params.section, getInitialSection]);

  // Load data on mount
  useEffect(() => {
    console.log('[Settings] Component mounted');
    loadData();
  }, []);

  // Handle back button press
  const handleBackPress = useCallback(() => {
    console.log('[Settings] Back button pressed, currentSection:', currentSection, 'params.section:', params.section);
    
    // If we came from settings-menu (indicated by params.section), go back to settings-menu
    if (params.section) {
      console.log('[Settings] Navigating back to /settings-menu');
      router.replace('/settings-menu');
      return true;
    }
    
    // Otherwise, use default back behavior
    console.log('[Settings] Using default back behavior');
    router.back();
    return true;
  }, [currentSection, params.section, router]);

  // Register back handler
  useFocusEffect(
    useCallback(() => {
      console.log('[Settings] Screen focused, registering back handler');
      const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
      
      return () => {
        console.log('[Settings] Screen unfocused, removing back handler');
        backHandler.remove();
      };
    }, [handleBackPress])
  );

  const loadData = async () => {
    setLoading(true);

    try {
      console.log('[Settings] Loading data...');
      
      const [lifeAreasRes, strategiesRes, currenciesRes, gainsLossesRes, goalsRes, preferencesRes] = await Promise.all([
        authenticatedGet('/api/life-areas'),
        authenticatedGet('/api/strategies'),
        authenticatedGet('/api/currencies'),
        authenticatedGet('/api/gains-losses'),
        authenticatedGet('/api/goals'),
        authenticatedGet('/api/preferences'),
      ]);

      setLifeAreas(lifeAreasRes || []);
      setStrategies(strategiesRes || []);
      setCurrencies(currenciesRes || []);
      setGainsLosses(gainsLossesRes || []);
      setGoals(goalsRes || []);
      setUserPreferences(preferencesRes || { notificationsEnabled: false });

      console.log('[Settings] Data loaded successfully');
    } catch (error) {
      console.error('[Settings] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const showError = (message: string) => {
    console.error('[Settings] Error:', message);
  };

  const showSuccess = (message: string) => {
    console.log('[Settings] Success:', message);
  };

  // Render loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen
          options={{
            headerShown: true,
            title: 'Settings',
            headerBackTitle: 'Settings Menu',
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // Render section content
  const renderSectionContent = () => {
    switch (currentSection) {
      case 'goals':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Goals</Text>
            {goals.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No goals yet. Create your first goal!</Text>
              </View>
            ) : (
              goals.map((goal) => (
                <View key={goal.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{goal.title}</Text>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => router.push(`/create-goal?id=${goal.id}`)}
                    >
                      <IconSymbol
                        ios_icon_name="pencil"
                        android_material_icon_name="edit"
                        size={20}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  </View>
                  {goal.description && (
                    <Text style={styles.cardDescription}>{goal.description}</Text>
                  )}
                </View>
              ))
            )}
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/create-goal')}
            >
              <Text style={styles.addButtonText}>+ Add Goal</Text>
            </TouchableOpacity>
          </View>
        );

      case 'life-areas':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Life Areas</Text>
            {lifeAreas.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No life areas yet.</Text>
              </View>
            ) : (
              lifeAreas.map((area) => (
                <View key={area.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{area.name}</Text>
                </View>
              ))
            )}
          </View>
        );

      case 'strategies':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Strategies</Text>
            {strategies.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No strategies yet.</Text>
              </View>
            ) : (
              strategies.map((strategy) => (
                <View key={strategy.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{strategy.name}</Text>
                  {strategy.description && (
                    <Text style={styles.cardDescription}>{strategy.description}</Text>
                  )}
                </View>
              ))
            )}
          </View>
        );

      case 'currencies':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Currencies</Text>
            {currencies.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No currencies yet.</Text>
              </View>
            ) : (
              currencies.map((currency) => (
                <View key={currency.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {currency.name} {currency.symbol ? `(${currency.symbol})` : ''}
                  </Text>
                </View>
              ))
            )}
          </View>
        );

      case 'gains-losses':
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gains & Losses</Text>
            {gainsLosses.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No gains or losses yet.</Text>
              </View>
            ) : (
              gainsLosses.map((item) => (
                <View key={item.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {item.name} ({item.type})
                  </Text>
                </View>
              ))
            )}
          </View>
        );

      default:
        return (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Section not implemented yet.</Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: currentSection === 'goals' ? 'Goals' :
                 currentSection === 'life-areas' ? 'Life Areas' :
                 currentSection === 'strategies' ? 'Strategies' :
                 currentSection === 'currencies' ? 'Currencies' :
                 currentSection === 'gains-losses' ? 'Gains & Losses' :
                 'Settings',
          headerBackTitle: 'Settings Menu',
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderSectionContent()}
      </ScrollView>
    </SafeAreaView>
  );
}
