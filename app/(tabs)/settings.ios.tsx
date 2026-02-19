
import React, { useState, useEffect, useMemo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from '@/utils/api';
import DateTimePicker from '@react-native-community/datetimepicker';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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

type SettingsSection = 'main' | 'goals' | 'lifeAreas' | 'strategies' | 'currencies' | 'gainsLosses' | 'reflectionPrefs' | 'notifications' | 'reports';

export default function SettingsScreen() {
  const router = useRouter();
  const [currentSection, setCurrentSection] = useState<SettingsSection>('main');
  const [loading, setLoading] = useState(false);
  
  const [goals, setGoals] = useState<Goal[]>([]);
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [gainsLosses, setGainsLosses] = useState<GainLoss[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>({
    notificationsEnabled: false,
    notificationAlarms: [],
    reflectionCategoriesEnabled: true,
    reflectionCategories: ['Action', 'Speech', 'Thought'],
  });
  const [currencyBalances, setCurrencyBalances] = useState<CurrencyBalance[]>([]);
  const [worthItTallies, setWorthItTallies] = useState<ReflectionWorthItTallies | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'lifeArea' | 'strategy' | 'currency' | 'gainLoss' | 'alarm' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Currency claim/pay modal state
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [currencyModalType, setCurrencyModalType] = useState<'claim' | 'pay'>('claim');
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>('');
  const [selectedCurrencyBalance, setSelectedCurrencyBalance] = useState<number>(0);
  const [currencyAmount, setCurrencyAmount] = useState<string>('');

  const [formData, setFormData] = useState<any>({});
  
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());

  // Parent Life Area picker state
  const [showParentPicker, setShowParentPicker] = useState(false);
  
  // Color picker state
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  // Icon picker state (for image upload)
  const [uploadingIcon, setUploadingIcon] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (currentSection === 'reports') {
      loadCurrencyBalances();
    }
  }, [currentSection]);

  const loadData = async () => {
    console.log('Loading settings data...');
    setLoading(true);
    try {
      const [goalsRes, lifeAreasRes, strategiesRes, currenciesRes, gainsLossesRes, prefsRes, goalProgressRes] = await Promise.all([
        authenticatedGet('/api/goals'),
        authenticatedGet('/api/life-areas'),
        authenticatedGet('/api/strategies'),
        authenticatedGet('/api/currencies'),
        authenticatedGet('/api/gains-losses'),
        authenticatedGet('/api/user-preferences'),
        authenticatedGet('/api/reports/goal-progress'),
      ]);

      console.log('Settings data loaded successfully');
      
      const goalsData = Array.isArray(goalsRes) 
        ? goalsRes 
        : (Array.isArray(goalsRes?.data) ? goalsRes.data : []);
      
      const lifeAreasData = Array.isArray(lifeAreasRes) 
        ? lifeAreasRes 
        : (Array.isArray(lifeAreasRes?.data) ? lifeAreasRes.data : []);
      
      const strategiesData = Array.isArray(strategiesRes) 
        ? strategiesRes 
        : (Array.isArray(strategiesRes?.data) ? strategiesRes.data : []);
      
      const currenciesData = Array.isArray(currenciesRes) 
        ? currenciesRes 
        : (Array.isArray(currenciesRes?.data) ? currenciesRes.data : []);
      
      const gainsLossesData = Array.isArray(gainsLossesRes) 
        ? gainsLossesRes 
        : (Array.isArray(gainsLossesRes?.data) ? gainsLossesRes.data : []);
      
      const prefsData = prefsRes?.data || prefsRes || { 
        notificationsEnabled: false, 
        notificationAlarms: [],
        reflectionCategoriesEnabled: true,
        reflectionCategories: ['Action', 'Speech', 'Thought'],
      };

      const goalProgressData = Array.isArray(goalProgressRes) 
        ? goalProgressRes 
        : (Array.isArray(goalProgressRes?.data) ? goalProgressRes.data : []);

      // Merge goal progress data (which includes per-goal currency balances) with goals
      const goalsWithBalances = goalsData.map((goal: Goal) => {
        const progressInfo = goalProgressData.find((gp: any) => gp.goalId === goal.id);
        if (progressInfo) {
          return {
            ...goal,
            rewardCurrencyBalance: progressInfo.rewardCurrencyBalance,
            rewardCurrencySymbol: progressInfo.rewardCurrencySymbol,
            consequenceCurrencyBalance: progressInfo.consequenceCurrencyBalance,
            consequenceCurrencySymbol: progressInfo.consequenceCurrencySymbol,
            successCount: progressInfo.successCount || 0,
            struggleCount: progressInfo.struggleCount || 0,
            status: progressInfo.status || goal.status || 'ACTIVE',
          };
        }
        return { ...goal, status: goal.status || 'ACTIVE' };
      });
      
      console.log('[Settings iOS] Life areas loaded:', lifeAreasData);
      
      setGoals(goalsWithBalances);
      // Life Areas API now returns nested structure with goals and success percentages
      setLifeAreas(lifeAreasData);
      setStrategies(strategiesData);
      setCurrencies(currenciesData);
      setGainsLosses(gainsLossesData);
      setPreferences(prefsData);
    } catch (error) {
      console.error('Error loading settings data:', error);
      showError('Failed to load settings data');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrencyBalances = async () => {
    console.log('Loading currency balances and reflection tallies...');
    try {
      const [balancesRes, talliesRes] = await Promise.all([
        authenticatedGet('/api/reports/currency-balances'),
        authenticatedGet('/api/reports/reflection-worth-it-tallies'),
      ]);
      
      const balancesData = Array.isArray(balancesRes) ? balancesRes : (balancesRes?.data || []);
      const talliesData = talliesRes?.data || talliesRes || null;
      
      setCurrencyBalances(balancesData);
      setWorthItTallies(talliesData);
    } catch (error) {
      console.error('Error loading reports data:', error);
      showError('Failed to load reports data');
    }
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessModal(true);
  };

  const openAddModal = (type: 'lifeArea' | 'strategy' | 'currency' | 'gainLoss' | 'alarm') => {
    if (type === 'lifeArea') {
      // Navigate to the new Life Area wizard screen
      console.log('[Settings iOS] Opening Life Area wizard');
      router.push('/life-area-wizard');
      return;
    }
    
    setModalType(type);
    setEditingItem(null);
    if (type === 'alarm') {
      setFormData({ 
        name: '', 
        time: '09:00', 
        frequency: 'daily',
        dayOfWeek: undefined,
        dayOfMonth: undefined,
      });
    } else if (type === 'gainLoss') {
      setFormData({ 
        name: '', 
        type: 'Gain',
        category: undefined,
        subCategory: undefined,
      });
    } else if (type === 'currency') {
      setFormData({
        name: '',
        symbol: '',
        type: 'consequence',
        onSuccess: 'ADD',
        onFailure: 'ADD',
      });
    } else {
      setFormData({});
    }
    setShowModal(true);
  };

  const openEditModal = (type: 'lifeArea' | 'strategy' | 'currency' | 'gainLoss' | 'alarm', item: any) => {
    if (type === 'lifeArea') {
      // Navigate to the Life Area wizard screen with edit mode
      console.log('[Settings iOS] Opening Life Area wizard for editing:', item.id);
      router.push(`/life-area-wizard?id=${item.id}`);
      return;
    }
    
    setModalType(type);
    setEditingItem(item);
    setFormData(item);
    setShowModal(true);
  };

  const handleSaveItem = async () => {
    if (!modalType) return;

    try {
      setLoading(true);
      
      if (modalType === 'lifeArea') {
        if (editingItem) {
          await authenticatedPut(`/api/life-areas/${editingItem.id}`, formData);
          showSuccess('Life area updated successfully');
        } else {
          await authenticatedPost('/api/life-areas', formData);
          showSuccess('Life area created successfully');
        }
      } else if (modalType === 'strategy') {
        if (editingItem) {
          await authenticatedPut(`/api/strategies/${editingItem.id}`, formData);
          showSuccess('Strategy updated successfully');
        } else {
          await authenticatedPost('/api/strategies', formData);
          showSuccess('Strategy created successfully');
        }
      } else if (modalType === 'currency') {
        if (editingItem) {
          await authenticatedPut(`/api/currencies/${editingItem.id}`, formData);
          showSuccess('Currency updated successfully');
        } else {
          await authenticatedPost('/api/currencies', formData);
          showSuccess('Currency created successfully');
        }
      } else if (modalType === 'gainLoss') {
        if (editingItem) {
          await authenticatedPut(`/api/gains-losses/${editingItem.id}`, formData);
          showSuccess('Gain/Loss updated successfully');
        } else {
          await authenticatedPost('/api/gains-losses', formData);
          showSuccess('Gain/Loss created successfully');
        }
      } else if (modalType === 'alarm') {
        const alarms = preferences.notificationAlarms || [];
        if (editingItem) {
          const updatedAlarms = alarms.map(a => a.id === editingItem.id ? formData : a);
          await authenticatedPut('/api/user-preferences', { ...preferences, notificationAlarms: updatedAlarms });
          setPreferences({ ...preferences, notificationAlarms: updatedAlarms });
        } else {
          const newAlarm = { ...formData, id: Date.now().toString() };
          const updatedAlarms = [...alarms, newAlarm];
          await authenticatedPut('/api/user-preferences', { ...preferences, notificationAlarms: updatedAlarms });
          setPreferences({ ...preferences, notificationAlarms: updatedAlarms });
        }
        showSuccess('Notification alarm saved successfully');
      }

      setShowModal(false);
      await loadData();
    } catch (error) {
      console.error('Error saving item:', error);
      showError('Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (type: 'lifeArea' | 'strategy' | 'currency' | 'gainLoss' | 'alarm', id: string) => {
    try {
      setLoading(true);
      
      if (type === 'lifeArea') {
        await authenticatedDelete(`/api/life-areas/${id}`);
        showSuccess('Life area deleted successfully');
      } else if (type === 'strategy') {
        await authenticatedDelete(`/api/strategies/${id}`);
        showSuccess('Strategy deleted successfully');
      } else if (type === 'currency') {
        await authenticatedDelete(`/api/currencies/${id}`);
        showSuccess('Currency deleted successfully');
      } else if (type === 'gainLoss') {
        await authenticatedDelete(`/api/gains-losses/${id}`);
        showSuccess('Gain/Loss deleted successfully');
      } else if (type === 'alarm') {
        const alarms = preferences.notificationAlarms || [];
        const updatedAlarms = alarms.filter(a => a.id !== id);
        await authenticatedPut('/api/user-preferences', { ...preferences, notificationAlarms: updatedAlarms });
        setPreferences({ ...preferences, notificationAlarms: updatedAlarms });
        showSuccess('Notification alarm deleted successfully');
      }

      await loadData();
    } catch (error) {
      console.error('Error deleting item:', error);
      showError('Failed to delete item');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      setLoading(true);
      await authenticatedDelete(`/api/goals/${id}`);
      showSuccess('Goal deleted successfully');
      await loadData();
    } catch (error) {
      console.error('Error deleting goal:', error);
      showError('Failed to delete goal');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateGoal = async (id: string) => {
    try {
      setLoading(true);
      console.log(`[API] Toggling goal status for goal ${id}`);
      await authenticatedPost(`/api/goals/${id}/deactivate`, {});
      showSuccess('Goal status updated successfully');
      await loadData();
    } catch (error: any) {
      console.error('[API] Error toggling goal status:', error);
      showError(error.message || 'Failed to update goal status');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setLoading(true);
      await authenticatedPut('/api/user-preferences', preferences);
      showSuccess('Preferences saved successfully');
    } catch (error) {
      console.error('Error saving preferences:', error);
      showError('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      setSelectedTime(selectedDate);
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;
      setFormData({ ...formData, time: timeString });
    }
  };

  const renderMainMenu = () => {
    const menuItems = [
      { title: 'Goals', icon: 'flag', section: 'goals' as SettingsSection },
      { title: 'Life Areas', icon: 'category', section: 'lifeAreas' as SettingsSection },
      { title: 'Strategies', icon: 'lightbulb', section: 'strategies' as SettingsSection },
      { title: 'Currencies', icon: 'attach-money', section: 'currencies' as SettingsSection },
      { title: 'Gains and Losses', icon: 'compare-arrows', section: 'gainsLosses' as SettingsSection },
      { title: 'Reflection Preferences', icon: 'edit-note', section: 'reflectionPrefs' as SettingsSection },
      { title: 'Notifications', icon: 'notifications', section: 'notifications' as SettingsSection },
      { title: 'Reports', icon: 'assessment', section: 'reports' as SettingsSection },
    ];

    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Settings</Text>
        {menuItems.map((item, index) => (
          <React.Fragment key={index}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => setCurrentSection(item.section)}
            >
              <View style={styles.menuItemLeft}>
                <IconSymbol
                  ios_icon_name="gear"
                  android_material_icon_name={item.icon}
                  size={24}
                  color={colors.text}
                />
                <Text style={styles.menuItemText}>{item.title}</Text>
              </View>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>
    );
  };

  const openCurrencyModal = (type: 'claim' | 'pay', currencyId: string, balance: number) => {
    setCurrencyModalType(type);
    setSelectedCurrencyId(currencyId);
    setSelectedCurrencyBalance(balance);
    setCurrencyAmount(Math.abs(balance).toString());
    setShowCurrencyModal(true);
  };

  const handleCurrencyAction = async () => {
    try {
      setLoading(true);
      const amount = parseInt(currencyAmount);
      
      if (isNaN(amount) || amount <= 0) {
        showError('Please enter a valid amount');
        return;
      }

      if (currencyModalType === 'claim') {
        console.log(`[API] Claiming ${amount} of currency ${selectedCurrencyId}`);
        await authenticatedPost(`/api/currencies/${selectedCurrencyId}/claim`, { amount });
        showSuccess(`Claimed ${amount} successfully`);
      } else {
        console.log(`[API] Paying ${amount} of currency ${selectedCurrencyId}`);
        await authenticatedPost(`/api/currencies/${selectedCurrencyId}/pay`, { amount });
        showSuccess(`Paid ${amount} successfully`);
      }

      setShowCurrencyModal(false);
      await loadData();
      if (currentSection === 'reports') {
        await loadCurrencyBalances();
      }
    } catch (error: any) {
      console.error('[API] Error with currency action:', error);
      showError(error.message || 'Failed to process currency action');
    } finally {
      setLoading(false);
    }
  };

  const getCurrencyActionText = (currency: Currency, isSuccess: boolean): string => {
    const action = isSuccess ? currency.onSuccess : currency.onFailure;
    if (action === 'ADD') {
      return isSuccess ? 'Gain' : 'Increase Debt';
    } else if (action === 'SUBTRACT') {
      return isSuccess ? 'Reduce Debt' : 'Lose';
    } else {
      return 'No Change';
    }
  };

  // Determine if a currency is a reward type (onSuccess = ADD) or consequence type (onFailure = ADD)
  const isRewardCurrency = (currency: Currency): boolean => {
    return currency.onSuccess === 'ADD';
  };

  const isConsequenceCurrency = (currency: Currency): boolean => {
    return currency.onFailure === 'ADD';
  };

  // Sort goals: Active first (alphabetically), then Deactivated (alphabetically)
  const sortedGoals = useMemo(() => {
    const activeGoals = goals.filter(g => g.status === 'ACTIVE');
    const deactivatedGoals = goals.filter(g => g.status === 'DEACTIVATED');

    activeGoals.sort((a, b) => a.title.localeCompare(b.title));
    deactivatedGoals.sort((a, b) => a.title.localeCompare(b.title));

    return [...activeGoals, ...deactivatedGoals];
  }, [goals]);

  const flattenLifeAreas = (areas: LifeArea[], depth: number = 0): Array<LifeArea & { depth: number }> => {
    let result: Array<LifeArea & { depth: number }> = [];
    areas.forEach(area => {
      result.push({ ...area, depth });
      if (area.children && area.children.length > 0) {
        result = result.concat(flattenLifeAreas(area.children, depth + 1));
      }
    });
    return result;
  };

  const handleReorderLifeAreas = async ({ data }: { data: Array<LifeArea & { depth: number }> }) => {
    console.log('[Settings iOS] Reordering life areas with re-nesting support...');
    
    // Guard clause: ensure data is valid
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.error('[Settings iOS] Invalid data for reordering:', data);
      showError('Invalid data for reordering');
      return;
    }
    
    try {
      // Build updates array with parentId and displayOrder based on depth changes
      const updates: Array<{ id: string; parentId: string | null; displayOrder: number }> = [];
      
      for (let i = 0; i < data.length; i++) {
        const currentArea = data[i];
        const prevArea = i > 0 ? data[i - 1] : null;
        const nextArea = i < data.length - 1 ? data[i + 1] : null;
        
        let newParentId: string | null = null;
        
        // Determine parent based on depth relative to neighbors
        if (currentArea.depth > 0 && prevArea) {
          if (currentArea.depth > prevArea.depth) {
            // This area is a child of the previous area
            newParentId = prevArea.id;
          } else if (currentArea.depth === prevArea.depth) {
            // Same level as previous area, share the same parent
            newParentId = prevArea.parentId || null;
          } else {
            // Less depth than previous, need to find the correct parent by going up
            // Find the closest ancestor at depth - 1
            for (let j = i - 1; j >= 0; j--) {
              if (data[j].depth === currentArea.depth - 1) {
                newParentId = data[j].id;
                break;
              } else if (data[j].depth < currentArea.depth - 1) {
                // No direct parent found at depth - 1, use null (top level)
                newParentId = null;
                break;
              }
            }
          }
        }
        
        updates.push({
          id: currentArea.id,
          parentId: newParentId,
          displayOrder: i,
        });
      }
      
      console.log('[Settings iOS] Sending updates to backend:', updates);
      
      // Send updates to backend
      await authenticatedPut('/api/life-areas/reorder', { updates });
      console.log('[Settings iOS] Life areas reordered successfully');
      
      // Reload data to get the updated structure
      await loadData();
      showSuccess('Life areas reordered successfully');
    } catch (error: any) {
      console.error('[Settings iOS] Error reordering life areas:', error);
      showError(error.message || 'Failed to reorder life areas');
      // Reload data to revert to previous state
      await loadData();
    }
  };

  const handleIndentArea = (areaId: string, direction: 'left' | 'right') => {
    const flatAreas = flattenLifeAreas(lifeAreas);
    const areaIndex = flatAreas.findIndex(a => a.id === areaId);
    
    if (areaIndex === -1) return;
    
    const updatedAreas = [...flatAreas];
    const currentArea = updatedAreas[areaIndex];
    
    if (direction === 'right') {
      // Indent (increase depth) - make it a child of the previous sibling
      if (areaIndex > 0) {
        const prevArea = updatedAreas[areaIndex - 1];
        // Can only indent if previous area is at same or greater depth
        if (prevArea.depth >= currentArea.depth) {
          currentArea.depth = prevArea.depth + 1;
          currentArea.parentId = prevArea.id;
        }
      }
    } else {
      // Outdent (decrease depth) - move up one level
      if (currentArea.depth > 0) {
        currentArea.depth = currentArea.depth - 1;
        // Find new parent (the parent of current parent)
        if (currentArea.parentId) {
          const currentParent = updatedAreas.find(a => a.id === currentArea.parentId);
          currentArea.parentId = currentParent?.parentId || null;
        }
      }
    }
    
    // Update all children to maintain relative depth
    const updateChildrenDepth = (parentId: string, depthDelta: number) => {
      for (const area of updatedAreas) {
        if (area.parentId === parentId) {
          area.depth += depthDelta;
          updateChildrenDepth(area.id, depthDelta);
        }
      }
    };
    
    handleReorderLifeAreas({ data: updatedAreas });
  };

  const renderLifeAreas = () => {
    const flatAreas = flattenLifeAreas(lifeAreas);

    const renderLifeAreaItem = ({ item, drag, isActive }: RenderItemParams<LifeArea & { depth: number }>) => {
      const iconName = item.icon;
      const areaColor = item.color || colors.primary;
      const percentage = item.successPercentage || 0;
      const percentageText = `${Math.round(percentage)}%`;
      const statusColor = item.percentageColor || item.successStatus;
      const percentageColor = (statusColor === 'green') ? colors.success : colors.error;
      const canIndentRight = flatAreas.findIndex(a => a.id === item.id) > 0;
      const canIndentLeft = item.depth > 0;
      
      return (
        <ScaleDecorator>
          <View
            style={[
              styles.lifeAreaCardCompact,
              { marginLeft: item.depth * 20, borderLeftColor: areaColor },
              isActive && styles.lifeAreaCardActive,
            ]}
          >
            <View style={styles.lifeAreaCompactContent}>
              <View style={styles.lifeAreaCompactLeft}>
                <TouchableOpacity onLongPress={drag} disabled={isActive} style={styles.dragHandle}>
                  <IconSymbol
                    ios_icon_name="line.3.horizontal"
                    android_material_icon_name="drag-handle"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
                {iconName ? (
                  <Text style={[styles.lifeAreaIcon, { color: areaColor }]}>{iconName}</Text>
                ) : (
                  <View style={styles.iconPlaceholder} />
                )}
                <Text style={styles.lifeAreaCompactName}>{item.name}</Text>
                {item.showProgress && (
                  <Text style={[styles.lifeAreaCompactPercentage, { color: percentageColor }]}>
                    {percentageText}
                  </Text>
                )}
              </View>
              <View style={styles.lifeAreaCompactActions}>
                {canIndentLeft && (
                  <TouchableOpacity
                    onPress={() => handleIndentArea(item.id, 'left')}
                    style={styles.iconButtonCompact}
                  >
                    <IconSymbol
                      ios_icon_name="chevron.left"
                      android_material_icon_name="chevron-left"
                      size={16}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                )}
                {canIndentRight && (
                  <TouchableOpacity
                    onPress={() => handleIndentArea(item.id, 'right')}
                    style={styles.iconButtonCompact}
                  >
                    <IconSymbol
                      ios_icon_name="chevron.right"
                      android_material_icon_name="chevron-right"
                      size={16}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => openEditModal('lifeArea', item)}
                  style={styles.iconButtonCompact}
                >
                  <IconSymbol
                    ios_icon_name="pencil"
                    android_material_icon_name="edit"
                    size={16}
                    color={colors.primary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteItem('lifeArea', item.id)}
                  style={styles.iconButtonCompact}
                >
                  <IconSymbol
                    ios_icon_name="trash"
                    android_material_icon_name="delete"
                    size={16}
                    color={colors.error}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScaleDecorator>
      );
    };

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentSection('main')}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Life Areas</Text>
          <TouchableOpacity onPress={() => openAddModal('lifeArea')}>
            <IconSymbol
              ios_icon_name="plus"
              android_material_icon_name="add"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.helperText}>
          Long press to drag. Use arrows to change nesting level.
        </Text>
        {flatAreas.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No life areas yet. Create one to organize your goals!</Text>
          </View>
        ) : (
          <GestureHandlerRootView style={styles.listContainer}>
            <DraggableFlatList
              data={flatAreas}
              onDragEnd={handleReorderLifeAreas}
              keyExtractor={(item) => item.id}
              renderItem={renderLifeAreaItem}
              contentContainerStyle={styles.draggableListContent}
            />
          </GestureHandlerRootView>
        )}
      </View>
    );
  };

  const renderStrategies = () => {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentSection('main')}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Strategies</Text>
          <TouchableOpacity onPress={() => openAddModal('strategy')}>
            <IconSymbol
              ios_icon_name="plus"
              android_material_icon_name="add"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.listContainer}>
          {strategies.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No strategies yet. Create one to help achieve your goals!</Text>
            </View>
          ) : (
            strategies.map((strategy, index) => {
              const linkedGoalsCount = strategy.linkedGoalIds?.length || 0;
              const linkedGoalsText = `${linkedGoalsCount} linked goals`;
              
              return (
                <React.Fragment key={index}>
                  <View style={styles.listItem}>
                    <View style={styles.listItemContent}>
                      <Text style={styles.listItemTitle}>{strategy.name}</Text>
                      {strategy.description && (
                        <Text style={styles.listItemSubtitle}>{strategy.description}</Text>
                      )}
                      <Text style={styles.listItemSubtitle}>{linkedGoalsText}</Text>
                    </View>
                    <View style={styles.listItemActions}>
                      <TouchableOpacity
                        onPress={() => openEditModal('strategy', strategy)}
                        style={styles.iconButton}
                      >
                        <IconSymbol
                          ios_icon_name="pencil"
                          android_material_icon_name="edit"
                          size={20}
                          color={colors.primary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteItem('strategy', strategy.id)}
                        style={styles.iconButton}
                      >
                        <IconSymbol
                          ios_icon_name="trash"
                          android_material_icon_name="delete"
                          size={20}
                          color={colors.error}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </React.Fragment>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  };

  const renderCurrencies = () => {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentSection('main')}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Currencies</Text>
          <TouchableOpacity onPress={() => openAddModal('currency')}>
            <IconSymbol
              ios_icon_name="plus"
              android_material_icon_name="add"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.listContainer}>
          {currencies.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No currencies yet. Create one to get started!</Text>
            </View>
          ) : (
            currencies.map((currency, index) => {
              const symbolText = currency.symbol || '';
              const typeText = currency.type === 'reward' ? 'Reward' : 'Consequence';
              const onSuccessAction = getCurrencyActionText(currency, true);
              const onFailureAction = getCurrencyActionText(currency, false);
              const onSuccessText = `On Success: ${onSuccessAction}`;
              const onFailureText = `On Failure: ${onFailureAction}`;
              
              return (
                <React.Fragment key={index}>
                  <View style={styles.listItem}>
                    <View style={styles.listItemContent}>
                      <View style={styles.currencyHeader}>
                        <Text style={styles.listItemTitle}>{currency.name}</Text>
                        {symbolText && <Text style={styles.currencySymbol}>{symbolText}</Text>}
                      </View>
                      <Text style={[styles.currencyTypeText, currency.type === 'reward' ? styles.currencyTypeReward : styles.currencyTypeConsequence]}>
                        {typeText}
                      </Text>
                      <Text style={styles.listItemSubtitle}>{onSuccessText}</Text>
                      <Text style={styles.listItemSubtitle}>{onFailureText}</Text>
                    </View>
                    <View style={styles.listItemActions}>
                      <TouchableOpacity
                        onPress={() => openEditModal('currency', currency)}
                        style={styles.iconButton}
                      >
                        <IconSymbol
                          ios_icon_name="pencil"
                          android_material_icon_name="edit"
                          size={20}
                          color={colors.primary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteItem('currency', currency.id)}
                        style={styles.iconButton}
                      >
                        <IconSymbol
                          ios_icon_name="trash"
                          android_material_icon_name="delete"
                          size={20}
                          color={colors.error}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </React.Fragment>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  };

  const renderGainsLosses = () => {
    const gains = gainsLosses.filter(gl => gl.type === 'Gain');
    const losses = gainsLosses.filter(gl => gl.type === 'Loss');

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentSection('main')}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gains and Losses</Text>
          <TouchableOpacity onPress={() => openAddModal('gainLoss')}>
            <IconSymbol
              ios_icon_name="plus"
              android_material_icon_name="add"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.listContainer}>
          {gainsLosses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No gains or losses yet. Create some to track in reflections!</Text>
            </View>
          ) : (
            <>
              {gains.length > 0 && (
                <>
                  <Text style={styles.sectionSubtitle}>Gains</Text>
                  {gains.map((gain, index) => {
                    const categoryText = gain.category ? `${gain.category}${gain.subCategory ? ` > ${gain.subCategory}` : ''}` : '';
                    
                    return (
                      <React.Fragment key={index}>
                        <View style={styles.listItem}>
                          <View style={styles.listItemContent}>
                            <Text style={styles.listItemTitle}>{gain.name}</Text>
                            {categoryText && <Text style={styles.listItemSubtitle}>{categoryText}</Text>}
                          </View>
                          <View style={styles.listItemActions}>
                            <TouchableOpacity
                              onPress={() => openEditModal('gainLoss', gain)}
                              style={styles.iconButton}
                            >
                              <IconSymbol
                                ios_icon_name="pencil"
                                android_material_icon_name="edit"
                                size={20}
                                color={colors.primary}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteItem('gainLoss', gain.id)}
                              style={styles.iconButton}
                            >
                              <IconSymbol
                                ios_icon_name="trash"
                                android_material_icon_name="delete"
                                size={20}
                                color={colors.error}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </React.Fragment>
                    );
                  })}
                </>
              )}

              {losses.length > 0 && (
                <>
                  <Text style={styles.sectionSubtitle}>Losses</Text>
                  {losses.map((loss, index) => {
                    const categoryText = loss.category ? `${loss.category}${loss.subCategory ? ` > ${loss.subCategory}` : ''}` : '';
                    
                    return (
                      <React.Fragment key={index}>
                        <View style={styles.listItem}>
                          <View style={styles.listItemContent}>
                            <Text style={styles.listItemTitle}>{loss.name}</Text>
                            {categoryText && <Text style={styles.listItemSubtitle}>{categoryText}</Text>}
                          </View>
                          <View style={styles.listItemActions}>
                            <TouchableOpacity
                              onPress={() => openEditModal('gainLoss', loss)}
                              style={styles.iconButton}
                            >
                              <IconSymbol
                                ios_icon_name="pencil"
                                android_material_icon_name="edit"
                                size={20}
                                color={colors.primary}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleDeleteItem('gainLoss', loss.id)}
                              style={styles.iconButton}
                            >
                              <IconSymbol
                                ios_icon_name="trash"
                                android_material_icon_name="delete"
                                size={20}
                                color={colors.error}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </React.Fragment>
                    );
                  })}
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderNotifications = () => {
    const alarms = preferences.notificationAlarms || [];

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentSection('main')}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <TouchableOpacity onPress={() => openAddModal('alarm')}>
            <IconSymbol
              ios_icon_name="plus"
              android_material_icon_name="add"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.formContainer}>
          <View style={styles.formGroup}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Enable Notifications</Text>
              <Switch
                value={preferences.notificationsEnabled}
                onValueChange={(value) => {
                  setPreferences({ ...preferences, notificationsEnabled: value });
                  handleSavePreferences();
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>
          </View>

          {preferences.notificationsEnabled && (
            <>
              <Text style={styles.sectionSubtitle}>Notification Alarms</Text>
              {alarms.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No notification alarms set. Tap + to add one.</Text>
                </View>
              ) : (
                alarms.map((alarm, index) => {
                  const frequencyText = alarm.frequency.charAt(0).toUpperCase() + alarm.frequency.slice(1);
                  const timeText = formatTime(alarm.time);
                  let scheduleText = frequencyText;
                  if (alarm.dayOfWeek) {
                    scheduleText += ` - ${alarm.dayOfWeek}`;
                  }
                  if (alarm.dayOfMonth) {
                    scheduleText += ` - Day ${alarm.dayOfMonth}`;
                  }
                  
                  return (
                    <React.Fragment key={index}>
                      <View style={styles.alarmItem}>
                        <View style={styles.alarmContent}>
                          <Text style={styles.alarmName}>{alarm.name}</Text>
                          <Text style={styles.alarmTime}>{timeText}</Text>
                          <Text style={styles.alarmSchedule}>{scheduleText}</Text>
                        </View>
                        <View style={styles.listItemActions}>
                          <TouchableOpacity
                            onPress={() => openEditModal('alarm', alarm)}
                            style={styles.iconButton}
                          >
                            <IconSymbol
                              ios_icon_name="pencil"
                              android_material_icon_name="edit"
                              size={20}
                              color={colors.primary}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleDeleteItem('alarm', alarm.id)}
                            style={styles.iconButton}
                          >
                            <IconSymbol
                              ios_icon_name="trash"
                              android_material_icon_name="delete"
                              size={20}
                              color={colors.error}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </React.Fragment>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderReflectionPreferences = () => {
    const allCategories = ['Action', 'Speech', 'Thought', 'Feeling'];
    const selectedCategories = preferences.reflectionCategories || ['Action', 'Speech', 'Thought'];

    const toggleCategory = (category: string) => {
      const currentCategories = preferences.reflectionCategories || [];
      const newCategories = currentCategories.includes(category)
        ? currentCategories.filter(c => c !== category)
        : [...currentCategories, category];
      
      setPreferences({ ...preferences, reflectionCategories: newCategories });
    };

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentSection('main')}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reflection Preferences</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView style={styles.formContainer}>
          <View style={styles.formGroup}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Enable Categories in Reflections</Text>
              <Switch
                value={preferences.reflectionCategoriesEnabled !== false}
                onValueChange={(value) => {
                  setPreferences({ ...preferences, reflectionCategoriesEnabled: value });
                }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>
            <Text style={styles.helperText}>
              When enabled, you can categorize reflections as Action, Speech, Thought, or Feeling
            </Text>
          </View>

          {preferences.reflectionCategoriesEnabled !== false && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Available Categories</Text>
              <Text style={styles.helperText}>
                Select which categories you want to use in your reflections
              </Text>
              <View style={styles.optionsGrid}>
                {allCategories.map((category, index) => {
                  const isSelected = selectedCategories.includes(category);
                  
                  return (
                    <React.Fragment key={index}>
                      <TouchableOpacity
                        style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                        onPress={() => toggleCategory(category)}
                      >
                        <Text style={[styles.optionButtonText, isSelected && styles.optionButtonTextSelected]}>
                          {category}
                        </Text>
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.savePreferencesButton}
            onPress={handleSavePreferences}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.savePreferencesButtonText}>Save Preferences</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  const renderGoals = () => {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentSection('main')}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Goals</Text>
          <TouchableOpacity onPress={() => router.push('/create-goal')}>
            <IconSymbol
              ios_icon_name="plus"
              android_material_icon_name="add"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.listContainer}>
          {sortedGoals.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No goals yet. Create one to get started!</Text>
            </View>
          ) : (
            sortedGoals.map((goal, index) => {
              const successCount = goal.successCount || 0;
              const struggleCount = goal.struggleCount || 0;
              const isDeactivated = goal.status === 'DEACTIVATED';
              
              // Display per-goal currency balance (not total)
              let displayCurrencyId = null;
              let displayCurrencyBalance = 0;
              let displayCurrencySymbol = '';
              let displayCurrency = null;
              let displayButtonType: 'claim' | 'pay' = 'claim';
              
              if (goal.rewardCurrencyId && goal.rewardCurrencyBalance !== undefined && goal.rewardCurrencyBalance !== null) {
                displayCurrencyId = goal.rewardCurrencyId;
                displayCurrencyBalance = goal.rewardCurrencyBalance;
                displayCurrencySymbol = goal.rewardCurrencySymbol || '';
                displayCurrency = currencies.find(c => c.id === goal.rewardCurrencyId);
                if (displayCurrency && isRewardCurrency(displayCurrency) && displayCurrencyBalance > 0) {
                  displayButtonType = 'claim';
                } else if (displayCurrencyBalance < 0) {
                  displayButtonType = 'pay';
                } else {
                  displayButtonType = 'claim';
                }
              } else if (goal.consequenceCurrencyId && goal.consequenceCurrencyBalance !== undefined && goal.consequenceCurrencyBalance !== null) {
                displayCurrencyId = goal.consequenceCurrencyId;
                displayCurrencyBalance = goal.consequenceCurrencyBalance;
                displayCurrencySymbol = goal.consequenceCurrencySymbol || '';
                displayCurrency = currencies.find(c => c.id === goal.consequenceCurrencyId);
                if (displayCurrency && isConsequenceCurrency(displayCurrency) && displayCurrencyBalance > 0) {
                  displayButtonType = 'pay';
                } else if (displayCurrencyBalance < 0) {
                  displayButtonType = 'claim';
                } else {
                  displayButtonType = 'pay';
                }
              }
              
              const showCurrencyButton = displayCurrencyId && displayCurrencyBalance !== 0;
              
              return (
                <React.Fragment key={index}>
                  <View style={[styles.goalCardExpanded, isDeactivated && styles.goalCardDeactivated]}>
                    <View style={styles.goalHeader}>
                      <View style={styles.goalTitleRow}>
                        {goal.type === 'PROACTIVE' && (
                          <IconSymbol
                            ios_icon_name="checkmark.circle.fill"
                            android_material_icon_name="check-circle"
                            size={20}
                            color={colors.success}
                          />
                        )}
                        {goal.type === 'RESTRAINING' && (
                          <IconSymbol
                            ios_icon_name="stop.circle.fill"
                            android_material_icon_name="cancel"
                            size={20}
                            color={colors.error}
                          />
                        )}
                        <Text style={styles.listItemTitle}>{goal.title}</Text>
                      </View>
                      <View style={styles.listItemActions}>
                        <TouchableOpacity
                          onPress={() => handleDeactivateGoal(goal.id)}
                          style={styles.iconButton}
                        >
                          <IconSymbol
                            ios_icon_name="power"
                            android_material_icon_name="power-settings-new"
                            size={20}
                            color={isDeactivated ? colors.textSecondary : colors.primary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => router.push(`/create-goal?id=${goal.id}`)}
                          style={styles.iconButton}
                        >
                          <IconSymbol
                            ios_icon_name="pencil"
                            android_material_icon_name="edit"
                            size={20}
                            color={colors.primary}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteGoal(goal.id)}
                          style={styles.iconButton}
                        >
                          <IconSymbol
                            ios_icon_name="trash"
                            android_material_icon_name="delete"
                            size={20}
                            color={colors.error}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                    
                    {goal.description && (
                      <Text style={styles.listItemSubtitle}>{goal.description}</Text>
                    )}
                    
                    {/* Success/Struggle counts with icons */}
                    <View style={styles.goalStats}>
                      <View style={styles.goalStatItem}>
                        <IconSymbol
                          ios_icon_name="checkmark.circle"
                          android_material_icon_name="check-circle"
                          size={16}
                          color={colors.success}
                        />
                        <Text style={[styles.goalStatText, { color: colors.success }]}>
                          {successCount}
                        </Text>
                      </View>
                      <View style={styles.goalStatItem}>
                        <IconSymbol
                          ios_icon_name="xmark.circle"
                          android_material_icon_name="cancel"
                          size={16}
                          color={colors.error}
                        />
                        <Text style={[styles.goalStatText, { color: colors.error }]}>
                          {struggleCount}
                        </Text>
                      </View>
                    </View>
                    
                    {/* Per-goal currency balance (not total) */}
                    {displayCurrencyId && (
                      <View style={styles.currencyBalances}>
                        <View style={styles.currencyBalanceRow}>
                          <Text style={styles.currencyBalanceValue}>
                            {displayCurrencySymbol}{displayCurrencyBalance}
                          </Text>
                          {showCurrencyButton && (
                            <TouchableOpacity
                              style={[styles.currencyActionButton, { backgroundColor: displayButtonType === 'claim' ? colors.success : colors.error }]}
                              onPress={() => {
                                if (displayCurrencyId) {
                                  openCurrencyModal(displayButtonType, displayCurrencyId, displayCurrencyBalance);
                                }
                              }}
                            >
                              <Text style={styles.currencyActionButtonText}>
                                {displayButtonType === 'claim' ? 'Claim' : 'Pay'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                </React.Fragment>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  };

  const renderReports = () => {
    const worthItPercentage = worthItTallies && worthItTallies.total > 0 
      ? Math.round((worthItTallies.worthIt / worthItTallies.total) * 100)
      : 0;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setCurrentSection('main')}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reports</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView style={styles.listContainer}>
          {worthItTallies && worthItTallies.total > 0 && (
            <>
              <Text style={styles.sectionSubtitle}>Reflection Worth It Analysis</Text>
              <View style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportTitle}>Was it worth it?</Text>
                </View>
                <View style={styles.reportStats}>
                  <Text style={styles.reportStat}>Total Reflections: {worthItTallies.total}</Text>
                  <Text style={[styles.reportStat, { color: colors.success }]}>
                    Worth It: {worthItTallies.worthIt} ({worthItPercentage}%)
                  </Text>
                  <Text style={[styles.reportStat, { color: colors.error }]}>
                    Not Worth It: {worthItTallies.notWorthIt} ({100 - worthItPercentage}%)
                  </Text>
                </View>
              </View>
            </>
          )}

          <Text style={styles.sectionSubtitle}>Total Currency Balances</Text>
          {currencyBalances.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No currency data yet. Complete some goals to see your balances!</Text>
            </View>
          ) : (
            currencyBalances.map((balance, index) => {
              const symbolText = balance.symbol || '';
              const totalBalanceText = `${balance.totalBalance}`;
              const totalBalanceColor = balance.totalBalance >= 0 ? colors.success : colors.error;
              const currency = currencies.find(c => c.id === balance.currencyId);
              
              // Determine button type based on balance and currency type
              let buttonType: 'claim' | 'pay' = 'claim';
              if (balance.totalBalance > 0) {
                buttonType = (currency && isRewardCurrency(currency)) ? 'claim' : 'pay';
              } else if (balance.totalBalance < 0) {
                buttonType = (currency && isRewardCurrency(currency)) ? 'pay' : 'claim';
              }
              
              return (
                <React.Fragment key={index}>
                  <TouchableOpacity 
                    style={styles.reportCard}
                    onPress={() => {
                      console.log('Navigating to currency reflections for:', balance.currencyId);
                      router.push(`/currency-reflections?currencyId=${balance.currencyId}`);
                    }}
                  >
                    <View style={styles.reportHeader}>
                      <Text style={styles.reportTitle}>{balance.currencyName}</Text>
                      {symbolText && <Text style={styles.reportSymbol}>{symbolText}</Text>}
                    </View>
                    <View style={styles.reportNetBalance}>
                      <Text style={[styles.reportNetBalanceText, { color: totalBalanceColor }]}>
                        Total: {totalBalanceText}
                      </Text>
                    </View>
                    
                    {balance.goalBreakdown && balance.goalBreakdown.length > 0 && (
                      <View style={styles.goalBreakdownSection}>
                        <Text style={styles.goalBreakdownTitle}>Per Goal:</Text>
                        {balance.goalBreakdown.map((goalBalance, idx) => {
                          const goalBalanceText = `${goalBalance.balance}`;
                          const goalBalanceColor = goalBalance.balance >= 0 ? colors.success : colors.error;
                          
                          return (
                            <View key={idx} style={styles.goalBreakdownRow}>
                              <Text style={styles.goalBreakdownGoal}>{goalBalance.goalTitle}</Text>
                              <Text style={[styles.goalBreakdownBalance, { color: goalBalanceColor }]}>
                                {symbolText}{goalBalanceText}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                    
                    {balance.totalBalance !== 0 && (
                      <TouchableOpacity
                        style={[styles.currencyTotalActionButton, { backgroundColor: buttonType === 'claim' ? colors.success : colors.error }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          openCurrencyModal(buttonType, balance.currencyId, balance.totalBalance);
                        }}
                      >
                        <Text style={styles.currencyTotalActionButtonText}>
                          {buttonType === 'claim' ? 'Claim' : 'Pay'} {Math.abs(balance.totalBalance)} {symbolText}
                        </Text>
                      </TouchableOpacity>
                    )}
                    
                    <View style={styles.drillDownHint}>
                      <IconSymbol
                        ios_icon_name="chevron.right"
                        android_material_icon_name="arrow-forward"
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={styles.drillDownText}>Tap to view related reflections</Text>
                    </View>
                  </TouchableOpacity>
                </React.Fragment>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {loading && currentSection === 'main' ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          {currentSection === 'main' && renderMainMenu()}
          {currentSection === 'goals' && renderGoals()}
          {currentSection === 'lifeAreas' && renderLifeAreas()}
          {currentSection === 'strategies' && renderStrategies()}
          {currentSection === 'currencies' && renderCurrencies()}
          {currentSection === 'gainsLosses' && renderGainsLosses()}
          {currentSection === 'reflectionPrefs' && renderReflectionPreferences()}
          {currentSection === 'notifications' && renderNotifications()}
          {currentSection === 'reports' && renderReports()}
        </>
      )}

      {/* Currency Claim/Pay Modal */}
      <Modal
        visible={showCurrencyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCurrencyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertModal}>
            <Text style={styles.alertTitle}>
              {currencyModalType === 'claim' ? 'Claim Currency' : 'Pay Currency'}
            </Text>
            <Text style={styles.alertMessage}>
              {currencyModalType === 'claim' 
                ? `You have ${Math.abs(selectedCurrencyBalance)} to claim. Enter amount:`
                : `You owe ${Math.abs(selectedCurrencyBalance)}. Enter amount to pay:`
              }
            </Text>
            <TextInput
              style={styles.currencyInput}
              value={currencyAmount}
              onChangeText={setCurrencyAmount}
              keyboardType="number-pad"
              placeholder="Enter amount"
              placeholderTextColor={colors.textSecondary}
            />
            <View style={styles.alertButtons}>
              <TouchableOpacity
                style={[styles.alertButton, styles.alertButtonSecondary]}
                onPress={() => setShowCurrencyModal(false)}
              >
                <Text style={styles.alertButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={handleCurrencyAction}
              >
                <Text style={styles.alertButtonText}>
                  {currencyModalType === 'claim' ? 'Claim' : 'Pay'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertModal}>
            <Text style={styles.alertTitle}>Error</Text>
            <Text style={styles.alertMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertModal}>
            <Text style={styles.alertTitle}>Success</Text>
            <Text style={styles.alertMessage}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 24,
  },
  sectionSubtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  listContainer: {
    flex: 1,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  listItemContent: {
    flex: 1,
    marginRight: 12,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  listItemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
  goalCardExpanded: {
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  goalCardDeactivated: {
    opacity: 0.6,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  goalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  goalStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  goalStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  goalStatText: {
    fontSize: 14,
    fontWeight: '600',
  },
  currencyBalances: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  currencyBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyBalanceValue: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    color: colors.text,
  },
  currencyActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  currencyActionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  currencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  formContainer: {
    flex: 1,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionButtonText: {
    fontSize: 14,
    color: colors.text,
  },
  optionButtonTextSelected: {
    color: colors.background,
    fontWeight: '600',
  },
  timePickerButton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  timePickerText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  alarmItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  alarmContent: {
    flex: 1,
    marginRight: 12,
  },
  alarmName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  alarmTime: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 2,
  },
  alarmSchedule: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  reportCard: {
    backgroundColor: colors.card,
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  reportSymbol: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  reportStats: {
    marginBottom: 12,
  },
  reportStat: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  reportNetBalance: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginBottom: 12,
  },
  reportNetBalanceText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  goalBreakdownSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  goalBreakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  goalBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  goalBreakdownGoal: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  goalBreakdownBalance: {
    fontSize: 14,
    fontWeight: '600',
  },
  currencyTotalActionButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  currencyTotalActionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  drillDownHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  drillDownText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonPrimaryText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    maxHeight: 200,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemSelected: {
    backgroundColor: colors.primary + '20',
  },
  pickerItemText: {
    fontSize: 16,
    color: colors.text,
  },
  pickerItemTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  alertModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  alertMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  currencyInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    textAlign: 'center',
  },
  alertButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  alertButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  alertButtonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  alertButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  alertButtonSecondaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  helperText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  savePreferencesButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  savePreferencesButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  iconPlaceholder: {
    width: 20,
    height: 20,
  },
  parentPickerButton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  parentPickerText: {
    fontSize: 16,
    color: colors.text,
  },
  iconUploadContainer: {
    alignItems: 'center',
    padding: 20,
  },
  iconPreview: {
    alignItems: 'center',
    gap: 12,
  },
  removeIconButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.error,
    borderRadius: 8,
  },
  removeIconText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '600',
  },
  iconPlaceholderLarge: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconPlaceholderText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  colorPickerButton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorPreviewText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  lifeAreaCardCompact: {
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  lifeAreaCardActive: {
    backgroundColor: colors.border,
    opacity: 0.8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  draggableListContent: {
    paddingBottom: 20,
  },
  lifeAreaCompactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lifeAreaCompactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  lifeAreaIcon: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  lifeAreaCompactName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  lifeAreaCompactPercentage: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  lifeAreaCompactActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconButtonCompact: {
    padding: 4,
  },
  dragHandle: {
    padding: 4,
    marginRight: 4,
  },
  currencyTypeText: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 4,
  },
  currencyTypeReward: {
    color: colors.success,
  },
  currencyTypeConsequence: {
    color: colors.error,
  },
  formContainer: {
    flex: 1,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionButtonText: {
    fontSize: 14,
    color: colors.text,
  },
  optionButtonTextSelected: {
    color: colors.background,
    fontWeight: '600',
  },
});
