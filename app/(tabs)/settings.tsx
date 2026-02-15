
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from '@/utils/api';
import DateTimePicker from '@react-native-community/datetimepicker';

interface LifeArea {
  id: string;
  name: string;
  parentId?: string;
  level: number;
  children?: LifeArea[];
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
  onSuccess?: 'ADD' | 'SUBTRACT' | 'NONE';
  onFailure?: 'ADD' | 'SUBTRACT' | 'NONE';
}

interface Goal {
  id: string;
  title: string;
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
  earned: number;
  lost: number;
  debtAdded: number;
  debtReduced: number;
  netBalance: number;
}

type SettingsSection = 'main' | 'lifeAreas' | 'strategies' | 'currencies' | 'reflectionPrefs' | 'notifications' | 'reports';

export default function SettingsScreen() {
  const [currentSection, setCurrentSection] = useState<SettingsSection>('main');
  const [loading, setLoading] = useState(false);
  
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>({
    notificationsEnabled: false,
    notificationAlarms: [],
    reflectionCategoriesEnabled: true,
    reflectionCategories: ['Action', 'Speech', 'Thought'],
  });
  const [currencyBalances, setCurrencyBalances] = useState<CurrencyBalance[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'lifeArea' | 'strategy' | 'currency' | 'alarm' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [formData, setFormData] = useState<any>({});
  
  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());

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
      const [lifeAreasRes, strategiesRes, currenciesRes, goalsRes, prefsRes] = await Promise.all([
        authenticatedGet('/api/life-areas'),
        authenticatedGet('/api/strategies'),
        authenticatedGet('/api/currencies'),
        authenticatedGet('/api/goals'),
        authenticatedGet('/api/user-preferences'),
      ]);

      console.log('Settings data loaded successfully');
      
      const lifeAreasData = Array.isArray(lifeAreasRes) 
        ? lifeAreasRes 
        : (Array.isArray(lifeAreasRes?.data) ? lifeAreasRes.data : []);
      
      const strategiesData = Array.isArray(strategiesRes) 
        ? strategiesRes 
        : (Array.isArray(strategiesRes?.data) ? strategiesRes.data : []);
      
      const currenciesData = Array.isArray(currenciesRes) 
        ? currenciesRes 
        : (Array.isArray(currenciesRes?.data) ? currenciesRes.data : []);
      
      const goalsData = Array.isArray(goalsRes) 
        ? goalsRes 
        : (Array.isArray(goalsRes?.data) ? goalsRes.data : []);
      
      const prefsData = prefsRes?.data || prefsRes || { 
        notificationsEnabled: false, 
        notificationAlarms: [],
        reflectionCategoriesEnabled: true,
        reflectionCategories: ['Action', 'Speech', 'Thought'],
      };
      
      setLifeAreas(buildLifeAreaHierarchy(lifeAreasData));
      setStrategies(strategiesData);
      setCurrencies(currenciesData);
      setGoals(goalsData);
      setPreferences(prefsData);
    } catch (error) {
      console.error('Error loading settings data:', error);
      showError('Failed to load settings data');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrencyBalances = async () => {
    console.log('Loading currency balances...');
    try {
      const balancesRes = await authenticatedGet('/api/reports/currency-balances');
      const balancesData = Array.isArray(balancesRes) ? balancesRes : (balancesRes?.data || []);
      setCurrencyBalances(balancesData);
    } catch (error) {
      console.error('Error loading currency balances:', error);
      showError('Failed to load currency balances');
    }
  };

  const buildLifeAreaHierarchy = (areas: LifeArea[]): LifeArea[] => {
    console.log('Building life area hierarchy from:', areas);
    
    if (!Array.isArray(areas)) {
      console.warn('buildLifeAreaHierarchy received non-array:', areas);
      return [];
    }
    
    if (areas.length === 0) {
      console.log('No life areas to build hierarchy from');
      return [];
    }
    
    const areaMap = new Map<string, LifeArea>();
    areas.forEach(area => {
      areaMap.set(area.id, { ...area, children: [] });
    });

    const rootAreas: LifeArea[] = [];
    areaMap.forEach(area => {
      if (area.parentId) {
        const parent = areaMap.get(area.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(area);
        }
      } else {
        rootAreas.push(area);
      }
    });

    console.log('Built hierarchy with root areas:', rootAreas);
    return rootAreas;
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessModal(true);
  };

  const openAddModal = (type: 'lifeArea' | 'strategy' | 'currency' | 'alarm') => {
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
    } else {
      setFormData({});
    }
    setShowModal(true);
  };

  const openEditModal = (type: 'lifeArea' | 'strategy' | 'currency' | 'alarm', item: any) => {
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

  const handleDeleteItem = async (type: 'lifeArea' | 'strategy' | 'currency' | 'alarm', id: string) => {
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

  const handleSavePreferences = async () => {
    try {
      setLoading(true);
      await authenticatedPut('/api/user-preferences', preferences);
      showSuccess('Notification preferences saved successfully');
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
    setShowTimePicker(Platform.OS === 'ios');
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
      { title: 'Life Areas', icon: 'category', section: 'lifeAreas' as SettingsSection },
      { title: 'Strategies', icon: 'lightbulb', section: 'strategies' as SettingsSection },
      { title: 'Currencies', icon: 'attach-money', section: 'currencies' as SettingsSection },
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

  const renderLifeAreas = () => {
    const renderLifeAreaItem = (area: LifeArea, depth: number = 0) => {
      const levelText = `Level ${area.level}`;
      
      return (
        <React.Fragment key={area.id}>
          <View style={[styles.listItem, { marginLeft: depth * 20 }]}>
            <View style={styles.listItemContent}>
              <Text style={styles.listItemTitle}>{area.name}</Text>
              <Text style={styles.listItemSubtitle}>{levelText}</Text>
            </View>
            <View style={styles.listItemActions}>
              <TouchableOpacity
                onPress={() => openEditModal('lifeArea', area)}
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
                onPress={() => handleDeleteItem('lifeArea', area.id)}
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
          {area.children && area.children.map(child => renderLifeAreaItem(child, depth + 1))}
        </React.Fragment>
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
        <ScrollView style={styles.listContainer}>
          {lifeAreas.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No life areas yet. Create one to organize your goals!</Text>
            </View>
          ) : (
            lifeAreas.map(area => renderLifeAreaItem(area))
          )}
        </ScrollView>
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
              const onSuccessText = `On Success: ${currency.onSuccess || 'NONE'}`;
              const onFailureText = `On Failure: ${currency.onFailure || 'NONE'}`;
              
              return (
                <React.Fragment key={index}>
                  <View style={styles.listItem}>
                    <View style={styles.listItemContent}>
                      <View style={styles.currencyHeader}>
                        <Text style={styles.listItemTitle}>{currency.name}</Text>
                        {symbolText && <Text style={styles.currencySymbol}>{symbolText}</Text>}
                      </View>
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

  const renderReports = () => {
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
          <Text style={styles.sectionSubtitle}>Currency Balances</Text>
          {currencyBalances.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No currency data yet. Complete some goals to see your balances!</Text>
            </View>
          ) : (
            currencyBalances.map((balance, index) => {
              const symbolText = balance.symbol || '';
              const earnedText = `Earned: ${balance.earned}`;
              const lostText = `Lost: ${balance.lost}`;
              const debtAddedText = `Debt Added: ${balance.debtAdded}`;
              const debtReducedText = `Debt Reduced: ${balance.debtReduced}`;
              const netBalanceText = `Net Balance: ${balance.netBalance}`;
              const netBalanceColor = balance.netBalance >= 0 ? colors.success : colors.error;
              
              return (
                <React.Fragment key={index}>
                  <View style={styles.reportCard}>
                    <View style={styles.reportHeader}>
                      <Text style={styles.reportTitle}>{balance.currencyName}</Text>
                      {symbolText && <Text style={styles.reportSymbol}>{symbolText}</Text>}
                    </View>
                    <View style={styles.reportStats}>
                      <Text style={styles.reportStat}>{earnedText}</Text>
                      <Text style={styles.reportStat}>{lostText}</Text>
                      <Text style={styles.reportStat}>{debtAddedText}</Text>
                      <Text style={styles.reportStat}>{debtReducedText}</Text>
                    </View>
                    <View style={styles.reportNetBalance}>
                      <Text style={[styles.reportNetBalanceText, { color: netBalanceColor }]}>
                        {netBalanceText}
                      </Text>
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

  const renderEditModal = () => {
    if (!modalType) return null;

    const modalTitle = editingItem ? `Edit ${modalType}` : `Add ${modalType}`;

    return (
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {modalType === 'lifeArea' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.name || ''}
                      onChangeText={(value) => setFormData({ ...formData, name: value })}
                      placeholder="Enter life area name"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Level</Text>
                    <View style={styles.optionsGrid}>
                      {[1, 2, 3].map((level, index) => {
                        const isSelected = formData.level === level;
                        const levelText = `Level ${level}`;
                        
                        return (
                          <React.Fragment key={index}>
                            <TouchableOpacity
                              style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                              onPress={() => setFormData({ ...formData, level })}
                            >
                              <Text style={[styles.optionButtonText, isSelected && styles.optionButtonTextSelected]}>
                                {levelText}
                              </Text>
                            </TouchableOpacity>
                          </React.Fragment>
                        );
                      })}
                    </View>
                  </View>

                  {formData.level > 1 && (
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Parent Life Area</Text>
                      <ScrollView style={styles.pickerContainer}>
                        {lifeAreas.map((area, index) => {
                          const isSelected = formData.parentId === area.id;
                          
                          return (
                            <React.Fragment key={index}>
                              <TouchableOpacity
                                style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                                onPress={() => setFormData({ ...formData, parentId: area.id })}
                              >
                                <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                                  {area.name}
                                </Text>
                              </TouchableOpacity>
                            </React.Fragment>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}

              {modalType === 'strategy' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.name || ''}
                      onChangeText={(value) => setFormData({ ...formData, name: value })}
                      placeholder="Enter strategy name"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Description</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={formData.description || ''}
                      onChangeText={(value) => setFormData({ ...formData, description: value })}
                      placeholder="Enter description"
                      placeholderTextColor={colors.textSecondary}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Linked Goals</Text>
                    <ScrollView style={styles.pickerContainer}>
                      {goals.map((goal, index) => {
                        const isSelected = formData.linkedGoalIds?.includes(goal.id);
                        
                        return (
                          <React.Fragment key={index}>
                            <TouchableOpacity
                              style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                              onPress={() => {
                                const currentGoals = formData.linkedGoalIds || [];
                                const newGoals = isSelected
                                  ? currentGoals.filter((id: string) => id !== goal.id)
                                  : [...currentGoals, goal.id];
                                setFormData({ ...formData, linkedGoalIds: newGoals });
                              }}
                            >
                              <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                                {goal.title}
                              </Text>
                            </TouchableOpacity>
                          </React.Fragment>
                        );
                      })}
                    </ScrollView>
                  </View>
                </>
              )}

              {modalType === 'currency' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Name</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.name || ''}
                      onChangeText={(value) => setFormData({ ...formData, name: value })}
                      placeholder="Enter currency name"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Symbol</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.symbol || ''}
                      onChangeText={(value) => setFormData({ ...formData, symbol: value })}
                      placeholder="$ or ⭐ or any symbol"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>On Success (Reward)</Text>
                    <View style={styles.optionsGrid}>
                      {['ADD', 'SUBTRACT', 'NONE'].map((option, index) => {
                        const isSelected = formData.onSuccess === option;
                        
                        return (
                          <React.Fragment key={index}>
                            <TouchableOpacity
                              style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                              onPress={() => setFormData({ ...formData, onSuccess: option })}
                            >
                              <Text style={[styles.optionButtonText, isSelected && styles.optionButtonTextSelected]}>
                                {option}
                              </Text>
                            </TouchableOpacity>
                          </React.Fragment>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>On Failure (Consequence)</Text>
                    <View style={styles.optionsGrid}>
                      {['ADD', 'SUBTRACT', 'NONE'].map((option, index) => {
                        const isSelected = formData.onFailure === option;
                        
                        return (
                          <React.Fragment key={index}>
                            <TouchableOpacity
                              style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                              onPress={() => setFormData({ ...formData, onFailure: option })}
                            >
                              <Text style={[styles.optionButtonText, isSelected && styles.optionButtonTextSelected]}>
                                {option}
                              </Text>
                            </TouchableOpacity>
                          </React.Fragment>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}

              {modalType === 'alarm' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Alarm Name</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.name || ''}
                      onChangeText={(value) => setFormData({ ...formData, name: value })}
                      placeholder="e.g., Morning Journal Reminder"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Time</Text>
                    <TouchableOpacity
                      style={styles.timePickerButton}
                      onPress={() => {
                        const [hours, minutes] = (formData.time || '09:00').split(':');
                        const date = new Date();
                        date.setHours(parseInt(hours));
                        date.setMinutes(parseInt(minutes));
                        setSelectedTime(date);
                        setShowTimePicker(true);
                      }}
                    >
                      <Text style={styles.timePickerText}>{formatTime(formData.time || '09:00')}</Text>
                      <IconSymbol
                        ios_icon_name="clock"
                        android_material_icon_name="access-time"
                        size={24}
                        color={colors.text}
                      />
                    </TouchableOpacity>
                    {showTimePicker && (
                      <DateTimePicker
                        value={selectedTime}
                        mode="time"
                        is24Hour={false}
                        display="spinner"
                        onChange={onTimeChange}
                      />
                    )}
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Frequency</Text>
                    <View style={styles.optionsGrid}>
                      {['daily', 'weekly', 'biweekly', 'monthly'].map((freq, index) => {
                        const isSelected = formData.frequency === freq;
                        const capitalizedFreq = freq.charAt(0).toUpperCase() + freq.slice(1);
                        
                        return (
                          <React.Fragment key={index}>
                            <TouchableOpacity
                              style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                              onPress={() => setFormData({ ...formData, frequency: freq })}
                            >
                              <Text style={[styles.optionButtonText, isSelected && styles.optionButtonTextSelected]}>
                                {capitalizedFreq}
                              </Text>
                            </TouchableOpacity>
                          </React.Fragment>
                        );
                      })}
                    </View>
                  </View>

                  {(formData.frequency === 'weekly' || formData.frequency === 'biweekly') && (
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Day of Week</Text>
                      <View style={styles.optionsGrid}>
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, index) => {
                          const isSelected = formData.dayOfWeek === day;
                          
                          return (
                            <React.Fragment key={index}>
                              <TouchableOpacity
                                style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                                onPress={() => setFormData({ ...formData, dayOfWeek: day })}
                              >
                                <Text style={[styles.optionButtonText, isSelected && styles.optionButtonTextSelected]}>
                                  {day}
                                </Text>
                              </TouchableOpacity>
                            </React.Fragment>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {formData.frequency === 'monthly' && (
                    <View style={styles.formGroup}>
                      <Text style={styles.label}>Day of Month</Text>
                      <TextInput
                        style={styles.input}
                        value={formData.dayOfMonth?.toString() || ''}
                        onChangeText={(value) => setFormData({ ...formData, dayOfMonth: parseInt(value) || undefined })}
                        placeholder="1-31"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="number-pad"
                      />
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.buttonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={handleSaveItem}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.buttonPrimaryText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
          {currentSection === 'lifeAreas' && renderLifeAreas()}
          {currentSection === 'strategies' && renderStrategies()}
          {currentSection === 'currencies' && renderCurrencies()}
          {currentSection === 'reflectionPrefs' && renderReflectionPreferences()}
          {currentSection === 'notifications' && renderNotifications()}
          {currentSection === 'reports' && renderReports()}
        </>
      )}

      {renderEditModal()}

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
    paddingTop: Platform.OS === 'android' ? 48 : 0,
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
  },
  reportNetBalanceText: {
    fontSize: 18,
    fontWeight: 'bold',
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
  alertButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  alertButtonText: {
    color: colors.background,
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
});
