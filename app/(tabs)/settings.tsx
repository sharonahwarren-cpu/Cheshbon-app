
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
  isSuccessful?: boolean;
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

interface UserPreferences {
  notificationsEnabled: boolean;
  notificationFrequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  notificationTime?: string;
  notificationDays?: string[];
}

type SettingsSection = 'main' | 'lifeAreas' | 'strategies' | 'currencies' | 'notifications';

export default function SettingsScreen() {
  const [currentSection, setCurrentSection] = useState<SettingsSection>('main');
  const [loading, setLoading] = useState(false);
  
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>({
    notificationsEnabled: false,
  });

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'lifeArea' | 'strategy' | 'currency' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [formData, setFormData] = useState<any>({});

  useEffect(() => {
    loadData();
  }, []);

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
      console.log('Life areas response:', lifeAreasRes);
      console.log('Strategies response:', strategiesRes);
      console.log('Currencies response:', currenciesRes);
      console.log('Goals response:', goalsRes);
      console.log('Preferences response:', prefsRes);
      
      // Handle both direct array and { data: array } response formats
      // Ensure we always have an array, even if empty
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
      
      const prefsData = prefsRes?.data || prefsRes || { notificationsEnabled: false };
      
      console.log('Processed life areas data:', lifeAreasData);
      console.log('Processed strategies data:', strategiesData);
      console.log('Processed currencies data:', currenciesData);
      console.log('Processed goals data:', goalsData);
      
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

  const buildLifeAreaHierarchy = (areas: LifeArea[]): LifeArea[] => {
    console.log('Building life area hierarchy from:', areas);
    
    // Safety check: ensure areas is an array
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

  const openAddModal = (type: 'lifeArea' | 'strategy' | 'currency') => {
    setModalType(type);
    setEditingItem(null);
    setFormData({});
    setShowModal(true);
  };

  const openEditModal = (type: 'lifeArea' | 'strategy' | 'currency', item: any) => {
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

  const handleDeleteItem = async (type: 'lifeArea' | 'strategy' | 'currency', id: string) => {
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

  const renderMainMenu = () => {
    const menuItems = [
      { title: 'Life Areas', icon: 'category', section: 'lifeAreas' as SettingsSection },
      { title: 'Strategies', icon: 'lightbulb', section: 'strategies' as SettingsSection },
      { title: 'Currencies', icon: 'attach-money', section: 'currencies' as SettingsSection },
      { title: 'Notifications', icon: 'notifications', section: 'notifications' as SettingsSection },
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
              const successText = strategy.isSuccessful === true ? 'Successful' : strategy.isSuccessful === false ? 'Not Successful' : 'Not Set';
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
                      <Text style={styles.listItemSubtitle}>{successText}</Text>
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
              const onSuccessText = `Reward: ${currency.onSuccess || 'NONE'}`;
              const onFailureText = `Consequence: ${currency.onFailure || 'NONE'}`;
              
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
    const frequencyOptions = ['daily', 'weekly', 'biweekly', 'monthly'];
    const dayOptions = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

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
          <View style={{ width: 24 }} />
        </View>
        <ScrollView style={styles.formContainer}>
          <View style={styles.formGroup}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Enable Notifications</Text>
              <Switch
                value={preferences.notificationsEnabled}
                onValueChange={(value) => setPreferences({ ...preferences, notificationsEnabled: value })}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.background}
              />
            </View>
          </View>

          {preferences.notificationsEnabled && (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Frequency</Text>
                <View style={styles.optionsGrid}>
                  {frequencyOptions.map((freq, index) => {
                    const isSelected = preferences.notificationFrequency === freq;
                    const capitalizedFreq = freq.charAt(0).toUpperCase() + freq.slice(1);
                    
                    return (
                      <React.Fragment key={index}>
                        <TouchableOpacity
                          style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                          onPress={() => setPreferences({ ...preferences, notificationFrequency: freq as any })}
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

              <View style={styles.formGroup}>
                <Text style={styles.label}>Time</Text>
                <TextInput
                  style={styles.input}
                  value={preferences.notificationTime || ''}
                  onChangeText={(value) => setPreferences({ ...preferences, notificationTime: value })}
                  placeholder="09:00"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {(preferences.notificationFrequency === 'weekly' || preferences.notificationFrequency === 'biweekly') && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>Days</Text>
                  <View style={styles.optionsGrid}>
                    {dayOptions.map((day, index) => {
                      const isSelected = preferences.notificationDays?.includes(day);
                      const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
                      
                      return (
                        <React.Fragment key={index}>
                          <TouchableOpacity
                            style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                            onPress={() => {
                              const currentDays = preferences.notificationDays || [];
                              const newDays = isSelected
                                ? currentDays.filter(d => d !== day)
                                : [...currentDays, day];
                              setPreferences({ ...preferences, notificationDays: newDays });
                            }}
                          >
                            <Text style={[styles.optionButtonText, isSelected && styles.optionButtonTextSelected]}>
                              {capitalizedDay}
                            </Text>
                          </TouchableOpacity>
                        </React.Fragment>
                      );
                    })}
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSavePreferences}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.saveButtonText}>Save Preferences</Text>
                )}
              </TouchableOpacity>
            </>
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
                    <Text style={styles.label}>Success Status</Text>
                    <View style={styles.optionsGrid}>
                      {[
                        { label: 'Not Set', value: null },
                        { label: 'Successful', value: true },
                        { label: 'Not Successful', value: false },
                      ].map((option, index) => {
                        const isSelected = formData.isSuccessful === option.value;
                        
                        return (
                          <React.Fragment key={index}>
                            <TouchableOpacity
                              style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                              onPress={() => setFormData({ ...formData, isSuccessful: option.value })}
                            >
                              <Text style={[styles.optionButtonText, isSelected && styles.optionButtonTextSelected]}>
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          </React.Fragment>
                        );
                      })}
                    </View>
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
          {currentSection === 'notifications' && renderNotifications()}
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
  saveButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: colors.background,
    fontSize: 16,
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
});
