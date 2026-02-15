
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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from '@/utils/api';
import DateTimePicker from '@react-native-community/datetimepicker';

interface JournalEntry {
  id: string;
  content: string;
  entryDate: string;
  createdAt: string;
  updatedAt: string;
}

interface Reflection {
  id: string;
  entryDate: string;
  category?: string;
  type: 'Restraint' | 'Proactive';
  description: string;
  linkedGoalId?: string;
  outcome?: 'success' | 'struggled';
  currencyChange?: {
    currencyId: string;
    amount: number;
    operation: 'add' | 'subtract';
    currencyName?: string;
    currencySymbol?: string;
  };
  lookupField1?: string;
  lookupField2?: string;
  createdAt: string;
}

interface Goal {
  id: string;
  title: string;
  behaviorCategories?: string[];
  rewardCurrencyId?: string;
  rewardAmount?: number;
  consequenceCurrencyId?: string;
  consequenceAmount?: number;
}

interface UserPreferences {
  reflectionCategoriesEnabled?: boolean;
  reflectionCategories?: string[];
}

export default function ReflectScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);
  const [journalContent, setJournalContent] = useState('');
  const [reflections, setReflections] = useState<Reflection[]>([]);

  const [showAddReflectionModal, setShowAddReflectionModal] = useState(false);
  const [editingReflection, setEditingReflection] = useState<Reflection | null>(null);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({});

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    console.log('Loading reflect data for date:', selectedDate.toISOString().split('T')[0]);
    setLoading(true);
    try {
      const dateString = selectedDate.toISOString().split('T')[0];
      
      const [journalRes, reflectionsRes, goalsRes, prefsRes] = await Promise.all([
        authenticatedGet(`/api/journals/by-date?date=${dateString}`),
        authenticatedGet(`/api/reflections/by-date?date=${dateString}`),
        authenticatedGet('/api/goals'),
        authenticatedGet('/api/user-preferences'),
      ]);

      const journalData = journalRes?.data || journalRes || null;
      const reflectionsData = Array.isArray(reflectionsRes) ? reflectionsRes : (reflectionsRes?.data || []);
      const goalsData = Array.isArray(goalsRes) ? goalsRes : (goalsRes?.data || []);
      const prefsData = prefsRes?.data || prefsRes || {};

      setJournalEntry(journalData);
      setJournalContent(journalData?.content || '');
      setReflections(reflectionsData);
      setGoals(goalsData);
      setUserPreferences(prefsData);

      console.log('Reflect data loaded successfully');
    } catch (error) {
      console.error('Error loading reflect data:', error);
      showError('Failed to load reflect data');
    } finally {
      setLoading(false);
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

  const handleSaveJournal = async () => {
    console.log('Saving journal entry...');
    try {
      setLoading(true);
      const dateString = selectedDate.toISOString().split('T')[0];
      
      const savedEntry = await authenticatedPost('/api/journals/by-date', {
        date: dateString,
        content: journalContent,
      });

      setJournalEntry(savedEntry?.data || savedEntry);
      showSuccess('Journal entry saved successfully');
    } catch (error) {
      console.error('Error saving journal:', error);
      showError('Failed to save journal entry');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
    }
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  const handleDeleteReflection = async (id: string) => {
    console.log('Deleting reflection:', id);
    try {
      setLoading(true);
      await authenticatedDelete(`/api/reflections/${id}`);
      setReflections(reflections.filter(r => r.id !== id));
      showSuccess('Reflection deleted successfully');
    } catch (error) {
      console.error('Error deleting reflection:', error);
      showError('Failed to delete reflection');
    } finally {
      setLoading(false);
    }
  };

  const openAddReflectionModal = () => {
    setEditingReflection(null);
    setShowAddReflectionModal(true);
  };

  const openEditReflectionModal = (reflection: Reflection) => {
    setEditingReflection(reflection);
    setShowAddReflectionModal(true);
  };

  const handleReflectionSaved = (reflection: Reflection) => {
    if (editingReflection) {
      setReflections(reflections.map(r => r.id === reflection.id ? reflection : r));
    } else {
      setReflections([...reflections, reflection]);
    }
    setShowAddReflectionModal(false);
    showSuccess('Reflection saved successfully');
  };

  const dateDisplay = formatDate(selectedDate);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reflect</Text>
          <TouchableOpacity onPress={() => router.push('/search-journals')}>
            <IconSymbol
              ios_icon_name="magnifyingglass"
              android_material_icon_name="search"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.dateNavigator}>
          <TouchableOpacity onPress={handlePreviousDay} style={styles.dateNavButton}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateDisplay}>
            <Text style={styles.dateText}>{dateDisplay}</Text>
            <IconSymbol
              ios_icon_name="calendar"
              android_material_icon_name="calendar-today"
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={handleNextDay} style={styles.dateNavButton}>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="calendar"
            onChange={handleDateChange}
          />
        )}

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily Journal</Text>
            <TextInput
              style={styles.journalInput}
              value={journalContent}
              onChangeText={setJournalContent}
              placeholder="Write your thoughts for today..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSaveJournal}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.saveButtonText}>Save Journal</Text>
              )}
            </TouchableOpacity>
            {journalEntry && (
              <View style={styles.timestampContainer}>
                <Text style={styles.timestampText}>
                  Last saved: {new Date(journalEntry.updatedAt).toLocaleString()}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Reflections</Text>
              <TouchableOpacity onPress={openAddReflectionModal} style={styles.addButton}>
                <IconSymbol
                  ios_icon_name="plus.circle.fill"
                  android_material_icon_name="add-circle"
                  size={32}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>

            {reflections.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  No reflections for this day. Tap + to add one.
                </Text>
              </View>
            ) : (
              reflections.map((reflection, index) => {
                const categoryText = reflection.category || 'General';
                const typeText = reflection.type;
                const outcomeText = reflection.outcome ? 
                  (reflection.outcome === 'success' ? 'Success' : 'Struggled') : 
                  'No outcome';
                
                return (
                  <React.Fragment key={index}>
                    <View style={styles.reflectionCard}>
                      <View style={styles.reflectionHeader}>
                        <View style={styles.reflectionBadges}>
                          {reflection.category && (
                            <View style={styles.badge}>
                              <Text style={styles.badgeText}>{categoryText}</Text>
                            </View>
                          )}
                          <View style={[styles.badge, styles.badgeType]}>
                            <Text style={styles.badgeText}>{typeText}</Text>
                          </View>
                        </View>
                        <View style={styles.reflectionActions}>
                          <TouchableOpacity
                            onPress={() => openEditReflectionModal(reflection)}
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
                            onPress={() => handleDeleteReflection(reflection.id)}
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

                      <Text style={styles.reflectionDescription}>{reflection.description}</Text>

                      {reflection.linkedGoalId && (
                        <View style={styles.reflectionMeta}>
                          <IconSymbol
                            ios_icon_name="target"
                            android_material_icon_name="flag"
                            size={16}
                            color={colors.primary}
                          />
                          <Text style={styles.reflectionMetaText}>
                            Linked to goal • {outcomeText}
                          </Text>
                        </View>
                      )}

                      {reflection.currencyChange && (
                        <View style={styles.currencyChange}>
                          <Text style={styles.currencyChangeText}>
                            {reflection.currencyChange.operation === 'add' ? '+' : '-'}
                            {reflection.currencyChange.amount} {reflection.currencyChange.currencySymbol || ''}
                          </Text>
                        </View>
                      )}

                      {(reflection.lookupField1 || reflection.lookupField2) && (
                        <View style={styles.lookupFields}>
                          {reflection.lookupField1 && (
                            <Text style={styles.lookupFieldText}>Field 1: {reflection.lookupField1}</Text>
                          )}
                          {reflection.lookupField2 && (
                            <Text style={styles.lookupFieldText}>Field 2: {reflection.lookupField2}</Text>
                          )}
                        </View>
                      )}
                    </View>
                  </React.Fragment>
                );
              })
            )}
          </View>
        </ScrollView>
      </View>

      {showAddReflectionModal && (
        <AddReflectionModal
          visible={showAddReflectionModal}
          onClose={() => setShowAddReflectionModal(false)}
          onSave={handleReflectionSaved}
          selectedDate={selectedDate}
          goals={goals}
          userPreferences={userPreferences}
          editingReflection={editingReflection}
        />
      )}

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

interface AddReflectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (reflection: Reflection) => void;
  selectedDate: Date;
  goals: Goal[];
  userPreferences: UserPreferences;
  editingReflection: Reflection | null;
}

function AddReflectionModal({
  visible,
  onClose,
  onSave,
  selectedDate,
  goals,
  userPreferences,
  editingReflection,
}: AddReflectionModalProps) {
  const [category, setCategory] = useState<string | undefined>(editingReflection?.category);
  const [type, setType] = useState<'Restraint' | 'Proactive'>(editingReflection?.type || 'Proactive');
  const [description, setDescription] = useState(editingReflection?.description || '');
  const [linkedGoalId, setLinkedGoalId] = useState<string | undefined>(editingReflection?.linkedGoalId);
  const [outcome, setOutcome] = useState<'success' | 'struggled' | undefined>(editingReflection?.outcome);
  const [lookupField1, setLookupField1] = useState(editingReflection?.lookupField1 || '');
  const [lookupField2, setLookupField2] = useState(editingReflection?.lookupField2 || '');
  const [loading, setLoading] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [goalSearchQuery, setGoalSearchQuery] = useState('');

  const categoriesEnabled = userPreferences.reflectionCategoriesEnabled !== false;
  const availableCategories = userPreferences.reflectionCategories || ['Action', 'Speech', 'Thought'];

  const filteredGoals = goals.filter(goal => {
    if (!category) return true;
    if (!goal.behaviorCategories) return true;
    return goal.behaviorCategories.includes(category);
  }).filter(goal => {
    if (!goalSearchQuery) return true;
    return goal.title.toLowerCase().includes(goalSearchQuery.toLowerCase());
  });

  const selectedGoal = goals.find(g => g.id === linkedGoalId);

  const getDescriptionPlaceholder = () => {
    if (!category) {
      return type === 'Proactive' 
        ? 'I actively chose to...' 
        : 'I refrained from...';
    }

    if (type === 'Proactive') {
      if (category === 'Action') return 'Describe what you chose to do';
      if (category === 'Speech') return 'Describe what you chose to say';
      if (category === 'Thought' || category === 'Feeling') return 'Describe what you chose to think/feel';
    } else {
      if (category === 'Action') return 'Describe what you refrained from doing';
      if (category === 'Speech') return 'Describe what you refrained from saying';
      if (category === 'Thought' || category === 'Feeling') return 'Describe what you refrained from thinking/feeling';
    }

    return 'Describe your reflection';
  };

  const handleSave = async () => {
    if (!description.trim()) {
      alert('Please enter a description');
      return;
    }

    console.log('Saving reflection...');
    setLoading(true);
    try {
      const dateString = selectedDate.toISOString().split('T')[0];
      
      const payload = {
        date: dateString,
        category: categoriesEnabled ? category : undefined,
        type,
        description,
        linkedGoalId: linkedGoalId || undefined,
        outcome: linkedGoalId ? outcome : undefined,
        lookupField1: lookupField1 || undefined,
        lookupField2: lookupField2 || undefined,
      };

      let savedReflection;
      if (editingReflection) {
        savedReflection = await authenticatedPut(`/api/reflections/${editingReflection.id}`, payload);
      } else {
        savedReflection = await authenticatedPost('/api/reflections', payload);
      }

      onSave(savedReflection?.data || savedReflection);
    } catch (error) {
      console.error('Error saving reflection:', error);
      alert('Failed to save reflection');
    } finally {
      setLoading(false);
    }
  };

  const modalTitle = editingReflection ? 'Edit Reflection' : 'Add Reflection';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{modalTitle}</Text>
            <TouchableOpacity onPress={onClose}>
              <IconSymbol
                ios_icon_name="xmark"
                android_material_icon_name="close"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {categoriesEnabled && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Category (Optional)</Text>
                <View style={styles.optionsGrid}>
                  {availableCategories.map((cat, index) => {
                    const isSelected = category === cat;
                    
                    return (
                      <React.Fragment key={index}>
                        <TouchableOpacity
                          style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                          onPress={() => setCategory(isSelected ? undefined : cat)}
                        >
                          <Text style={[styles.optionButtonText, isSelected && styles.optionButtonTextSelected]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      </React.Fragment>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Type</Text>
              <View style={styles.optionsGrid}>
                {(['Proactive', 'Restraint'] as const).map((t, index) => {
                  const isSelected = type === t;
                  const displayText = t === 'Proactive' ? 'Proactive (I actively chose to...)' : 'Restraint (I refrained from...)';
                  
                  return (
                    <React.Fragment key={index}>
                      <TouchableOpacity
                        style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                        onPress={() => setType(t)}
                      >
                        <Text style={[styles.optionButtonText, isSelected && styles.optionButtonTextSelected]}>
                          {displayText}
                        </Text>
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder={getDescriptionPlaceholder()}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Link to a Goal (Optional)</Text>
              <TouchableOpacity
                style={styles.goalPickerButton}
                onPress={() => setShowGoalPicker(!showGoalPicker)}
              >
                <Text style={styles.goalPickerText}>
                  {selectedGoal ? selectedGoal.title : 'Select a goal...'}
                </Text>
                <IconSymbol
                  ios_icon_name="chevron.down"
                  android_material_icon_name="arrow-drop-down"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>

              {showGoalPicker && (
                <View style={styles.goalPickerContainer}>
                  <TextInput
                    style={styles.searchInput}
                    value={goalSearchQuery}
                    onChangeText={setGoalSearchQuery}
                    placeholder="Search goals..."
                    placeholderTextColor={colors.textSecondary}
                  />
                  <ScrollView style={styles.goalList}>
                    <TouchableOpacity
                      style={styles.goalItem}
                      onPress={() => {
                        setLinkedGoalId(undefined);
                        setOutcome(undefined);
                        setShowGoalPicker(false);
                      }}
                    >
                      <Text style={styles.goalItemText}>None</Text>
                    </TouchableOpacity>
                    {filteredGoals.map((goal, index) => {
                      const isSelected = linkedGoalId === goal.id;
                      
                      return (
                        <React.Fragment key={index}>
                          <TouchableOpacity
                            style={[styles.goalItem, isSelected && styles.goalItemSelected]}
                            onPress={() => {
                              setLinkedGoalId(goal.id);
                              setShowGoalPicker(false);
                            }}
                          >
                            <Text style={[styles.goalItemText, isSelected && styles.goalItemTextSelected]}>
                              {goal.title}
                            </Text>
                          </TouchableOpacity>
                        </React.Fragment>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            {linkedGoalId && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Outcome</Text>
                <View style={styles.optionsGrid}>
                  {(['success', 'struggled'] as const).map((o, index) => {
                    const isSelected = outcome === o;
                    const displayText = o === 'success' ? 'Success' : 'Struggled';
                    
                    return (
                      <React.Fragment key={index}>
                        <TouchableOpacity
                          style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                          onPress={() => setOutcome(o)}
                        >
                          <Text style={[styles.optionButtonText, isSelected && styles.optionButtonTextSelected]}>
                            {displayText}
                          </Text>
                        </TouchableOpacity>
                      </React.Fragment>
                    );
                  })}
                </View>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Lookup Field 1 (Optional)</Text>
              <TextInput
                style={styles.input}
                value={lookupField1}
                onChangeText={setLookupField1}
                placeholder="Enter value..."
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Lookup Field 2 (Optional)</Text>
              <TextInput
                style={styles.input}
                value={lookupField2}
                onChangeText={setLookupField2}
                placeholder="Enter value..."
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={onClose}
            >
              <Text style={styles.buttonSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleSave}
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
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? 48 : 0,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.card,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  dateNavButton: {
    padding: 8,
  },
  dateDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  addButton: {
    padding: 4,
  },
  journalInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    minHeight: 150,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  timestampContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  timestampText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  reflectionCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reflectionBadges: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  badge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeType: {
    backgroundColor: colors.secondary + '20',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  reflectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  reflectionDescription: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
    lineHeight: 22,
  },
  reflectionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  reflectionMetaText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  currencyChange: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  currencyChangeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
  lookupFields: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lookupFieldText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
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
    maxHeight: '90%',
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
  goalPickerButton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalPickerText: {
    fontSize: 16,
    color: colors.text,
  },
  goalPickerContainer: {
    marginTop: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 250,
  },
  searchInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    margin: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalList: {
    maxHeight: 180,
  },
  goalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  goalItemSelected: {
    backgroundColor: colors.primary + '20',
  },
  goalItemText: {
    fontSize: 16,
    color: colors.text,
  },
  goalItemTextSelected: {
    color: colors.primary,
    fontWeight: '600',
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
});
