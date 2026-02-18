
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedPost, authenticatedPut } from '@/utils/api';
import { useRouter } from 'expo-router';

interface GainLoss {
  id: string;
  name: string;
  type: 'Gain' | 'Loss';
  category?: string;
  subCategory?: string;
}

interface Strategy {
  id: string;
  name: string;
  description?: string;
  category?: string;
  successCount: number;
  failureCount: number;
  timesUsed: number;
  successRate: number;
}

interface Reflection {
  id: string;
  entryDate: string;
  category?: string;
  type: 'Restraint' | 'Proactive';
  description: string;
  linkedGoalId?: string;
  linkedGoalTitle?: string;
  outcome?: 'success' | 'struggled';
  currencyChange?: {
    currencyId: string;
    amount: number;
    operation: 'add' | 'subtract';
    currencyName?: string;
    currencySymbol?: string;
  };
  gainedIds?: string[];
  lostIds?: string[];
  wasWorthIt?: boolean;
  additionalThoughts?: string;
  strategyEffectiveness?: {
    strategyId: string;
    worked: boolean;
  }[];
  createdAt: string;
}

interface Goal {
  id: string;
  title: string;
  behaviorCategories?: string[];
  rewardCurrencyId?: string;
  rewardAmount?: number;
  rewardSuccesses?: number;
  consequenceCurrencyId?: string;
  consequenceAmount?: number;
  consequenceFailures?: number;
  successCount?: number;
  struggleCount?: number;
}

interface Currency {
  id: string;
  name: string;
  symbol?: string;
  onSuccess?: 'ADD' | 'SUBTRACT' | 'NONE';
  onFailure?: 'ADD' | 'SUBTRACT' | 'NONE';
}

interface UserPreferences {
  reflectionCategoriesEnabled?: boolean;
  reflectionCategories?: string[];
}

interface AddReflectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (reflection: Reflection) => void;
  selectedDate: Date;
  goals: Goal[];
  currencies: Currency[];
  userPreferences: UserPreferences;
  editingReflection: Reflection | null;
  gainsLosses: GainLoss[];
  strategies: Strategy[];
  prefilledGoalId?: string;
  sourceScreen?: 'express' | 'reflect';
}

export function AddReflectionModal({
  visible,
  onClose,
  onSave,
  selectedDate,
  goals,
  currencies,
  userPreferences,
  editingReflection,
  gainsLosses,
  strategies,
  prefilledGoalId,
  sourceScreen,
}: AddReflectionModalProps) {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const descriptionInputRef = useRef<TextInput>(null);
  const additionalThoughtsInputRef = useRef<TextInput>(null);
  const strategyNameInputRef = useRef<TextInput>(null);
  const strategyDescInputRef = useRef<TextInput>(null);
  
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<string | undefined>(editingReflection?.category);
  const [type, setType] = useState<'Restraint' | 'Proactive'>(editingReflection?.type || 'Proactive');
  const [description, setDescription] = useState(editingReflection?.description || '');
  const [linkedGoalId, setLinkedGoalId] = useState<string | undefined>(editingReflection?.linkedGoalId || prefilledGoalId);
  const [outcome, setOutcome] = useState<'success' | 'struggled' | undefined>(editingReflection?.outcome);
  const [gainedIds, setGainedIds] = useState<string[]>(editingReflection?.gainedIds || []);
  const [lostIds, setLostIds] = useState<string[]>(editingReflection?.lostIds || []);
  const [wasWorthIt, setWasWorthIt] = useState<boolean | undefined>(editingReflection?.wasWorthIt);
  const [additionalThoughts, setAdditionalThoughts] = useState(editingReflection?.additionalThoughts || '');
  const [strategyEffectiveness, setStrategyEffectiveness] = useState<{strategyId: string; worked: boolean}[]>(editingReflection?.strategyEffectiveness || []);
  const [loading, setLoading] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [goalSearchQuery, setGoalSearchQuery] = useState('');
  const [showGainsPicker, setShowGainsPicker] = useState(false);
  const [showLossesPicker, setShowLossesPicker] = useState(false);
  const [showStrategyPicker, setShowStrategyPicker] = useState(false);
  const [showCreateGainModal, setShowCreateGainModal] = useState(false);
  const [showCreateLossModal, setShowCreateLossModal] = useState(false);
  const [showCreateStrategyModal, setShowCreateStrategyModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');

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
  
  const currencyBalanceInfo = (() => {
    if (!linkedGoalId || !outcome || !selectedGoal) return null;
    
    const isSuccess = outcome === 'success';
    const currencyId = isSuccess ? selectedGoal.rewardCurrencyId : selectedGoal.consequenceCurrencyId;
    const amount = isSuccess ? selectedGoal.rewardAmount : selectedGoal.consequenceAmount;
    const threshold = isSuccess ? selectedGoal.rewardSuccesses : selectedGoal.consequenceFailures;
    
    if (!currencyId || !amount) return null;
    
    const currency = currencies.find(c => c.id === currencyId);
    if (!currency) return null;
    
    const operation = isSuccess ? currency.onSuccess : currency.onFailure;
    if (!operation || operation === 'NONE') return null;
    
    const actionText = isSuccess 
      ? (operation === 'ADD' ? 'earn' : 'lose')
      : (operation === 'ADD' ? 'gain' : 'lose');
    
    const displayAmount = amount;
    const displaySymbol = currency.symbol || '';
    const displayThreshold = threshold || 1;
    
    return {
      operation: operation === 'ADD' ? 'add' : 'subtract',
      amount: displayAmount,
      symbol: displaySymbol,
      name: currency.name,
      threshold: displayThreshold,
      actionText,
      isSuccess,
    };
  })();

  const getCategoryIcon = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower === 'action') return { ios: 'figure.walk', android: 'directions-run' };
    if (categoryLower === 'speech') return { ios: 'bubble.left.fill', android: 'chat-bubble' };
    if (categoryLower === 'thought') return { ios: 'brain.head.profile', android: 'psychology' };
    if (categoryLower === 'feeling') return { ios: 'heart.fill', android: 'favorite' };
    return { ios: 'sparkles', android: 'auto-awesome' };
  };

  const getDescriptionPlaceholder = () => {
    if (!category) {
      return type === 'Proactive' 
        ? 'I chose to or didn\'t refrain from...' 
        : 'I refrained from or didn\'t...';
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

  const handleNext = () => {
    if (step === 1 && !description.trim()) {
      alert('Please enter a description');
      return;
    }
    Keyboard.dismiss();
    setStep(step + 1);
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }, 100);
  };

  const handleBack = () => {
    if (step > 1) {
      Keyboard.dismiss();
      setStep(step - 1);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
    }
  };

  const handleSave = async () => {
    if (!description.trim()) {
      alert('Please enter a description');
      return;
    }

    console.log('Saving reflection from shared AddReflectionModal, sourceScreen:', sourceScreen);
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
        gainedIds: gainedIds.length > 0 ? gainedIds : undefined,
        lostIds: lostIds.length > 0 ? lostIds : undefined,
        wasWorthIt: wasWorthIt !== undefined ? wasWorthIt : undefined,
        additionalThoughts: additionalThoughts.trim() || undefined,
        strategyEffectiveness: strategyEffectiveness.length > 0 ? strategyEffectiveness : undefined,
      };

      let savedReflection;
      if (editingReflection) {
        savedReflection = await authenticatedPut(`/api/reflections/${editingReflection.id}`, payload);
      } else {
        savedReflection = await authenticatedPost('/api/reflections', payload);
      }

      console.log('[AddReflectionModal] Reflection saved successfully, calling onSave callback');
      onSave(savedReflection?.data || savedReflection);
      
      // Navigate back to Express if the reflection was created from Express
      if (sourceScreen === 'express') {
        console.log('[AddReflectionModal] Navigating back to Express screen');
        setTimeout(() => {
          router.push('/(tabs)/(home)');
        }, 500);
      }
    } catch (error) {
      console.error('Error saving reflection:', error);
      alert('Failed to save reflection');
      setLoading(false);
    }
  };

  const handleCreateGoal = () => {
    router.push('/create-goal');
  };

  const handleCreateGain = async () => {
    if (!newItemName.trim()) {
      alert('Please enter a name');
      return;
    }

    try {
      setLoading(true);
      const newGain = await authenticatedPost('/api/gains-losses', {
        name: newItemName,
        type: 'Gain',
      });
      
      gainsLosses.push(newGain?.data || newGain);
      gainedIds.push((newGain?.data || newGain).id);
      setNewItemName('');
      setShowCreateGainModal(false);
    } catch (error) {
      console.error('Error creating gain:', error);
      alert('Failed to create gain');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLoss = async () => {
    if (!newItemName.trim()) {
      alert('Please enter a name');
      return;
    }

    try {
      setLoading(true);
      const newLoss = await authenticatedPost('/api/gains-losses', {
        name: newItemName,
        type: 'Loss',
      });
      
      gainsLosses.push(newLoss?.data || newLoss);
      lostIds.push((newLoss?.data || newLoss).id);
      setNewItemName('');
      setShowCreateLossModal(false);
    } catch (error) {
      console.error('Error creating loss:', error);
      alert('Failed to create loss');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStrategy = async () => {
    if (!newItemName.trim()) {
      alert('Please enter a name');
      return;
    }

    try {
      setLoading(true);
      const newStrategy = await authenticatedPost('/api/strategies', {
        name: newItemName,
        description: newItemDescription || undefined,
        category: category || undefined,
      });
      
      strategies.push(newStrategy?.data || newStrategy);
      setNewItemName('');
      setNewItemDescription('');
      setShowCreateStrategyModal(false);
    } catch (error) {
      console.error('Error creating strategy:', error);
      alert('Failed to create strategy');
    } finally {
      setLoading(false);
    }
  };

  const toggleStrategy = (strategyId: string) => {
    const existing = strategyEffectiveness.find(se => se.strategyId === strategyId);
    if (existing) {
      setStrategyEffectiveness(strategyEffectiveness.filter(se => se.strategyId !== strategyId));
    } else {
      setStrategyEffectiveness([...strategyEffectiveness, { strategyId, worked: true }]);
    }
  };

  const setStrategyWorked = (strategyId: string, worked: boolean) => {
    setStrategyEffectiveness(strategyEffectiveness.map(se => 
      se.strategyId === strategyId ? { ...se, worked } : se
    ));
  };

  const modalTitle = editingReflection ? 'Edit Reflection' : 'Add Reflection';
  const totalSteps = 4;
  const progressPercent = (step / totalSteps) * 100;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
        keyboardVerticalOffset={0}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={step > 1 ? handleBack : onClose} style={styles.backButton}>
              <IconSymbol
                ios_icon_name={step > 1 ? "chevron.left" : "xmark"}
                android_material_icon_name={step > 1 ? "arrow-back" : "close"}
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            <View style={styles.modalTitleContainer}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <Text style={styles.stepIndicator}>Step {step} of {totalSteps}</Text>
            </View>
            <View style={styles.backButton} />
          </View>

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>

          <ScrollView 
            ref={scrollViewRef}
            style={styles.modalBody} 
            contentContainerStyle={styles.modalBodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {step === 1 && (
              <React.Fragment>
                {categoriesEnabled && (
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <IconSymbol
                        ios_icon_name="tag.fill"
                        android_material_icon_name="label"
                        size={18}
                        color={colors.primary}
                      />
                      <Text style={styles.label}>Category (Optional)</Text>
                    </View>
                    <View style={styles.optionsGrid}>
                      {availableCategories.map((cat, index) => {
                        const isSelected = category === cat;
                        const categoryIcon = getCategoryIcon(cat);
                        
                        return (
                          <React.Fragment key={index}>
                            <TouchableOpacity
                              style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                              onPress={() => setCategory(isSelected ? undefined : cat)}
                            >
                              <IconSymbol
                                ios_icon_name={categoryIcon.ios}
                                android_material_icon_name={categoryIcon.android}
                                size={16}
                                color={isSelected ? colors.background : colors.primary}
                              />
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
                  <View style={styles.labelRow}>
                    <IconSymbol
                      ios_icon_name="arrow.triangle.2.circlepath"
                      android_material_icon_name="sync"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.label}>Type</Text>
                  </View>
                  <View style={styles.optionsColumn}>
                    {(['Proactive', 'Restraint'] as const).map((t, index) => {
                      const isSelected = type === t;
                      const displayText = t === 'Proactive' 
                        ? 'Proactive (I chose to or didn\'t refrain from…)' 
                        : 'Restraint (I refrained from or didn\'t…)';
                      
                      return (
                        <React.Fragment key={index}>
                          <TouchableOpacity
                            style={[styles.optionButtonLarge, isSelected && styles.optionButtonSelected]}
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
                  <View style={styles.labelRow}>
                    <IconSymbol
                      ios_icon_name="text.alignleft"
                      android_material_icon_name="description"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.label}>Description</Text>
                  </View>
                  <TextInput
                    ref={descriptionInputRef}
                    style={[styles.input, styles.textArea]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder={getDescriptionPlaceholder()}
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={6}
                    blurOnSubmit={false}
                    onFocus={() => {
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 300);
                    }}
                  />
                </View>
              </React.Fragment>
            )}

            {step === 2 && (
              <React.Fragment>
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <IconSymbol
                      ios_icon_name="target"
                      android_material_icon_name="flag"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.label}>Link to a Goal (Optional)</Text>
                  </View>
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
                        <TouchableOpacity
                          style={styles.createNewButton}
                          onPress={handleCreateGoal}
                        >
                          <IconSymbol
                            ios_icon_name="plus.circle.fill"
                            android_material_icon_name="add-circle"
                            size={20}
                            color={colors.primary}
                          />
                          <Text style={styles.createNewText}>Create New Goal</Text>
                        </TouchableOpacity>
                      </ScrollView>
                    </View>
                  )}
                </View>

                {linkedGoalId && (
                  <View style={styles.formGroup}>
                    <View style={styles.labelRow}>
                      <IconSymbol
                        ios_icon_name="chart.bar.fill"
                        android_material_icon_name="bar-chart"
                        size={18}
                        color={colors.primary}
                      />
                      <Text style={styles.label}>Outcome</Text>
                    </View>
                    <View style={styles.optionsGrid}>
                      {(['success', 'struggled'] as const).map((o, index) => {
                        const isSelected = outcome === o;
                        const displayText = o === 'success' ? 'Success' : 'Struggled';
                        const iconName = o === 'success' ? 'check-circle' : 'cancel';
                        
                        return (
                          <React.Fragment key={index}>
                            <TouchableOpacity
                              style={[styles.outcomeButton, isSelected && (o === 'success' ? styles.outcomeButtonSuccess : styles.outcomeButtonStruggled)]}
                              onPress={() => setOutcome(o)}
                            >
                              <IconSymbol
                                ios_icon_name={o === 'success' ? "checkmark.circle.fill" : "xmark.circle.fill"}
                                android_material_icon_name={iconName}
                                size={20}
                                color={isSelected ? colors.background : (o === 'success' ? colors.success : colors.error)}
                              />
                              <Text style={[styles.outcomeButtonText, isSelected && styles.outcomeButtonTextSelected]}>
                                {displayText}
                              </Text>
                            </TouchableOpacity>
                          </React.Fragment>
                        );
                      })}
                    </View>
                    
                    {currencyBalanceInfo && (
                      <View style={[
                        styles.currencyBalanceInfo,
                        currencyBalanceInfo.isSuccess ? styles.currencyBalanceInfoSuccess : styles.currencyBalanceInfoStruggled
                      ]}>
                        <View style={styles.currencyBalanceHeader}>
                          <IconSymbol
                            ios_icon_name="dollarsign.circle.fill"
                            android_material_icon_name="account-balance-wallet"
                            size={20}
                            color={currencyBalanceInfo.isSuccess ? colors.success : colors.error}
                          />
                          <Text style={styles.currencyBalanceTitle}>Currency Impact</Text>
                        </View>
                        <View style={styles.currencyBalanceAmount}>
                          <Text style={[
                            styles.currencyBalanceText,
                            currencyBalanceInfo.operation === 'add' ? styles.currencyBalancePositive : styles.currencyBalanceNegative
                          ]}>
                            {currencyBalanceInfo.operation === 'add' ? '+' : '-'}
                            {currencyBalanceInfo.amount} {currencyBalanceInfo.symbol}
                          </Text>
                        </View>
                        <Text style={styles.currencyBalanceDescription}>
                          After {currencyBalanceInfo.threshold} {currencyBalanceInfo.isSuccess ? 'successes' : 'struggles'}, {currencyBalanceInfo.actionText} {currencyBalanceInfo.amount} {currencyBalanceInfo.name}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </React.Fragment>
            )}

            {step === 3 && (
              <React.Fragment>
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <IconSymbol
                      ios_icon_name="arrow.up.circle.fill"
                      android_material_icon_name="trending-up"
                      size={18}
                      color={colors.success}
                    />
                    <Text style={styles.label}>What was Gained (Optional)</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.goalPickerButton}
                    onPress={() => setShowGainsPicker(!showGainsPicker)}
                  >
                    <Text style={styles.goalPickerText}>
                      {gainedIds.length > 0 ? `${gainedIds.length} gains selected` : 'Select gains...'}
                    </Text>
                    <IconSymbol
                      ios_icon_name="chevron.down"
                      android_material_icon_name="arrow-drop-down"
                      size={24}
                      color={colors.text}
                    />
                  </TouchableOpacity>

                  {showGainsPicker && (
                    <View style={styles.pickerContainer}>
                      <ScrollView style={styles.pickerList}>
                        {gainsLosses.filter(gl => gl.type === 'Gain').map((gain, index) => {
                          const isSelected = gainedIds.includes(gain.id);
                          
                          return (
                            <React.Fragment key={index}>
                              <TouchableOpacity
                                style={[styles.goalItem, isSelected && styles.goalItemSelected]}
                                onPress={() => {
                                  if (isSelected) {
                                    setGainedIds(gainedIds.filter(id => id !== gain.id));
                                  } else {
                                    setGainedIds([...gainedIds, gain.id]);
                                  }
                                }}
                              >
                                <Text style={[styles.goalItemText, isSelected && styles.goalItemTextSelected]}>
                                  {gain.name}
                                  {gain.category && ` (${gain.category})`}
                                </Text>
                                {isSelected && (
                                  <IconSymbol
                                    ios_icon_name="checkmark.circle.fill"
                                    android_material_icon_name="check-circle"
                                    size={20}
                                    color={colors.primary}
                                  />
                                )}
                              </TouchableOpacity>
                            </React.Fragment>
                          );
                        })}
                        <TouchableOpacity
                          style={styles.createNewButton}
                          onPress={() => setShowCreateGainModal(true)}
                        >
                          <IconSymbol
                            ios_icon_name="plus.circle.fill"
                            android_material_icon_name="add-circle"
                            size={20}
                            color={colors.primary}
                          />
                          <Text style={styles.createNewText}>Add New Gain</Text>
                        </TouchableOpacity>
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <IconSymbol
                      ios_icon_name="arrow.down.circle.fill"
                      android_material_icon_name="trending-down"
                      size={18}
                      color={colors.error}
                    />
                    <Text style={styles.label}>What was Lost (Optional)</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.goalPickerButton}
                    onPress={() => setShowLossesPicker(!showLossesPicker)}
                  >
                    <Text style={styles.goalPickerText}>
                      {lostIds.length > 0 ? `${lostIds.length} losses selected` : 'Select losses...'}
                    </Text>
                    <IconSymbol
                      ios_icon_name="chevron.down"
                      android_material_icon_name="arrow-drop-down"
                      size={24}
                      color={colors.text}
                    />
                  </TouchableOpacity>

                  {showLossesPicker && (
                    <View style={styles.pickerContainer}>
                      <ScrollView style={styles.pickerList}>
                        {gainsLosses.filter(gl => gl.type === 'Loss').map((loss, index) => {
                          const isSelected = lostIds.includes(loss.id);
                          
                          return (
                            <React.Fragment key={index}>
                              <TouchableOpacity
                                style={[styles.goalItem, isSelected && styles.goalItemSelected]}
                                onPress={() => {
                                  if (isSelected) {
                                    setLostIds(lostIds.filter(id => id !== loss.id));
                                  } else {
                                    setLostIds([...lostIds, loss.id]);
                                  }
                                }}
                              >
                                <Text style={[styles.goalItemText, isSelected && styles.goalItemTextSelected]}>
                                  {loss.name}
                                  {loss.category && ` (${loss.category})`}
                                </Text>
                                {isSelected && (
                                  <IconSymbol
                                    ios_icon_name="checkmark.circle.fill"
                                    android_material_icon_name="check-circle"
                                    size={20}
                                    color={colors.primary}
                                  />
                                )}
                              </TouchableOpacity>
                            </React.Fragment>
                          );
                        })}
                        <TouchableOpacity
                          style={styles.createNewButton}
                          onPress={() => setShowCreateLossModal(true)}
                        >
                          <IconSymbol
                            ios_icon_name="plus.circle.fill"
                            android_material_icon_name="add-circle"
                            size={20}
                            color={colors.primary}
                          />
                          <Text style={styles.createNewText}>Add New Loss</Text>
                        </TouchableOpacity>
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <IconSymbol
                      ios_icon_name="questionmark.circle.fill"
                      android_material_icon_name="help"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.label}>Was it worth it?</Text>
                  </View>
                  <View style={styles.optionsColumn}>
                    {[
                      { label: 'Yes, worth it', value: true },
                      { label: 'No, not worth it', value: false },
                    ].map((option, index) => {
                      const isSelected = wasWorthIt === option.value;
                      
                      return (
                        <React.Fragment key={index}>
                          <TouchableOpacity
                            style={[styles.optionButtonLarge, isSelected && styles.optionButtonSelected]}
                            onPress={() => setWasWorthIt(option.value)}
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
                  <View style={styles.labelRow}>
                    <IconSymbol
                      ios_icon_name="text.bubble.fill"
                      android_material_icon_name="chat-bubble"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.label}>Notes on weighing up gains and losses (Optional)</Text>
                  </View>
                  <TextInput
                    ref={additionalThoughtsInputRef}
                    style={[styles.input, styles.textArea]}
                    value={additionalThoughts}
                    onChangeText={setAdditionalThoughts}
                    placeholder="Notes on weighing up gains and losses..."
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    numberOfLines={6}
                    blurOnSubmit={false}
                    onFocus={() => {
                      setTimeout(() => {
                        scrollViewRef.current?.scrollToEnd({ animated: true });
                      }, 300);
                    }}
                  />
                </View>
              </React.Fragment>
            )}

            {step === 4 && (
              <React.Fragment>
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <IconSymbol
                      ios_icon_name="lightbulb.fill"
                      android_material_icon_name="lightbulb"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.label}>Strategies (Optional)</Text>
                  </View>
                  <Text style={styles.helperText}>
                    Select strategies you used or want to use for this reflection
                  </Text>
                  <TouchableOpacity
                    style={styles.goalPickerButton}
                    onPress={() => setShowStrategyPicker(!showStrategyPicker)}
                  >
                    <Text style={styles.goalPickerText}>
                      {strategyEffectiveness.length > 0 ? `${strategyEffectiveness.length} strategies selected` : 'Select strategies...'}
                    </Text>
                    <IconSymbol
                      ios_icon_name="chevron.down"
                      android_material_icon_name="arrow-drop-down"
                      size={24}
                      color={colors.text}
                    />
                  </TouchableOpacity>

                  {showStrategyPicker && (
                    <View style={styles.pickerContainer}>
                      <ScrollView style={styles.pickerList}>
                        {strategies.map((strategy, index) => {
                          const isSelected = strategyEffectiveness.some(se => se.strategyId === strategy.id);
                          const successRateText = `${Math.round(strategy.successRate)}%`;
                          const timesUsedText = `${strategy.timesUsed} times`;
                          
                          return (
                            <React.Fragment key={index}>
                              <TouchableOpacity
                                style={[styles.strategyListItem, isSelected && styles.goalItemSelected]}
                                onPress={() => toggleStrategy(strategy.id)}
                              >
                                <View style={styles.strategyListItemContent}>
                                  <Text style={[styles.goalItemText, isSelected && styles.goalItemTextSelected]}>
                                    {strategy.name}
                                  </Text>
                                  <View style={styles.strategyStats}>
                                    <Text style={styles.strategyStatText}>{successRateText}</Text>
                                    <Text style={styles.strategyStatText}>•</Text>
                                    <Text style={styles.strategyStatText}>{timesUsedText}</Text>
                                  </View>
                                </View>
                                {isSelected && (
                                  <IconSymbol
                                    ios_icon_name="checkmark.circle.fill"
                                    android_material_icon_name="check-circle"
                                    size={20}
                                    color={colors.primary}
                                  />
                                )}
                              </TouchableOpacity>
                            </React.Fragment>
                          );
                        })}
                        <TouchableOpacity
                          style={styles.createNewButton}
                          onPress={() => setShowCreateStrategyModal(true)}
                        >
                          <IconSymbol
                            ios_icon_name="plus.circle.fill"
                            android_material_icon_name="add-circle"
                            size={20}
                            color={colors.primary}
                          />
                          <Text style={styles.createNewText}>Add New Strategy</Text>
                        </TouchableOpacity>
                      </ScrollView>
                    </View>
                  )}
                </View>

                {strategyEffectiveness.length > 0 && (
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Did these strategies work?</Text>
                    {strategyEffectiveness.map((se, index) => {
                      const strategy = strategies.find(s => s.id === se.strategyId);
                      if (!strategy) return null;
                      
                      const successRateText = `${Math.round(strategy.successRate)}%`;
                      const fractionText = `${strategy.successCount}/${strategy.timesUsed}`;
                      
                      return (
                        <React.Fragment key={index}>
                          <View style={styles.strategyEffectivenessCard}>
                            <View style={styles.strategyEffectivenessHeader}>
                              <Text style={styles.strategyEffectivenessName}>{strategy.name}</Text>
                              <Text style={styles.strategyEffectivenessRate}>
                                {successRateText} ({fractionText})
                              </Text>
                            </View>
                            {strategy.description && (
                              <Text style={styles.strategyEffectivenessDescription}>
                                {strategy.description}
                              </Text>
                            )}
                            <View style={styles.strategyEffectivenessButtons}>
                              <TouchableOpacity
                                style={[
                                  styles.strategyEffectivenessButton,
                                  se.worked && styles.strategyEffectivenessButtonWorked
                                ]}
                                onPress={() => setStrategyWorked(se.strategyId, true)}
                              >
                                <IconSymbol
                                  ios_icon_name="checkmark.circle.fill"
                                  android_material_icon_name="check-circle"
                                  size={20}
                                  color={se.worked ? colors.background : colors.success}
                                />
                                <Text style={[
                                  styles.strategyEffectivenessButtonText,
                                  se.worked && styles.strategyEffectivenessButtonTextSelected
                                ]}>
                                  Worked
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.strategyEffectivenessButton,
                                  !se.worked && styles.strategyEffectivenessButtonDidntWork
                                ]}
                                onPress={() => setStrategyWorked(se.strategyId, false)}
                              >
                                <IconSymbol
                                  ios_icon_name="xmark.circle.fill"
                                  android_material_icon_name="cancel"
                                  size={20}
                                  color={!se.worked ? colors.background : colors.error}
                                />
                                <Text style={[
                                  styles.strategyEffectivenessButtonText,
                                  !se.worked && styles.strategyEffectivenessButtonTextSelected
                                ]}>
                                  Didn't work
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </React.Fragment>
                      );
                    })}
                  </View>
                )}
              </React.Fragment>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            {step < totalSteps ? (
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={handleNext}
              >
                <Text style={styles.buttonPrimaryText}>Next</Text>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="arrow-forward"
                  size={20}
                  color={colors.background}
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <React.Fragment>
                    <IconSymbol
                      ios_icon_name="checkmark.circle.fill"
                      android_material_icon_name="check-circle"
                      size={20}
                      color={colors.background}
                    />
                    <Text style={styles.buttonPrimaryText}>Save Reflection</Text>
                  </React.Fragment>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showCreateGainModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateGainModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.createItemModal}>
            <Text style={styles.alertTitle}>Add New Gain</Text>
            <TextInput
              style={styles.input}
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder="Gain name..."
              placeholderTextColor={colors.textSecondary}
              blurOnSubmit={false}
              autoFocus
            />
            <View style={styles.alertButtons}>
              <TouchableOpacity
                style={[styles.alertButton, styles.alertButtonSecondary]}
                onPress={() => {
                  setNewItemName('');
                  setShowCreateGainModal(false);
                }}
              >
                <Text style={styles.alertButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={handleCreateGain}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.alertButtonText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showCreateLossModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateLossModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.createItemModal}>
            <Text style={styles.alertTitle}>Add New Loss</Text>
            <TextInput
              style={styles.input}
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder="Loss name..."
              placeholderTextColor={colors.textSecondary}
              blurOnSubmit={false}
              autoFocus
            />
            <View style={styles.alertButtons}>
              <TouchableOpacity
                style={[styles.alertButton, styles.alertButtonSecondary]}
                onPress={() => {
                  setNewItemName('');
                  setShowCreateLossModal(false);
                }}
              >
                <Text style={styles.alertButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={handleCreateLoss}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.alertButtonText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showCreateStrategyModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateStrategyModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.createItemModal}>
            <Text style={styles.alertTitle}>Add New Strategy</Text>
            <TextInput
              ref={strategyNameInputRef}
              style={styles.input}
              value={newItemName}
              onChangeText={setNewItemName}
              placeholder="Strategy name..."
              placeholderTextColor={colors.textSecondary}
              blurOnSubmit={false}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => strategyDescInputRef.current?.focus()}
            />
            <TextInput
              ref={strategyDescInputRef}
              style={[styles.input, styles.textArea, { marginTop: 12 }]}
              value={newItemDescription}
              onChangeText={setNewItemDescription}
              placeholder="Description (optional)..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
              blurOnSubmit={false}
              returnKeyType="done"
            />
            <View style={styles.alertButtons}>
              <TouchableOpacity
                style={[styles.alertButton, styles.alertButtonSecondary]}
                onPress={() => {
                  setNewItemName('');
                  setNewItemDescription('');
                  setShowCreateStrategyModal(false);
                }}
              >
                <Text style={styles.alertButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertButton}
                onPress={handleCreateStrategy}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.alertButtonText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  stepIndicator: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 16,
    paddingBottom: 120,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  formGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  helperText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 140,
    maxHeight: 200,
    textAlignVertical: 'top',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionsColumn: {
    gap: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionButtonLarge: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionButtonText: {
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
  },
  optionButtonTextSelected: {
    color: colors.background,
    fontWeight: '600',
  },
  outcomeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  outcomeButtonSuccess: {
    borderColor: colors.success,
  },
  outcomeButtonStruggled: {
    borderColor: colors.error,
  },
  outcomeButtonText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  outcomeButtonTextSelected: {
    color: colors.background,
  },
  goalPickerButton: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalPickerText: {
    fontSize: 15,
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
  pickerContainer: {
    marginTop: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 300,
  },
  searchInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    margin: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalList: {
    maxHeight: 200,
  },
  pickerList: {
    maxHeight: 280,
  },
  goalItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalItemSelected: {
    backgroundColor: colors.primary + '20',
  },
  goalItemText: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  goalItemTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  createNewButton: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  createNewText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  currencyBalanceInfo: {
    marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
  },
  currencyBalanceInfoSuccess: {
    borderColor: colors.success + '60',
    backgroundColor: colors.success + '10',
  },
  currencyBalanceInfoStruggled: {
    borderColor: colors.error + '60',
    backgroundColor: colors.error + '10',
  },
  currencyBalanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  currencyBalanceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  currencyBalanceAmount: {
    marginBottom: 6,
  },
  currencyBalanceText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  currencyBalancePositive: {
    color: colors.success,
  },
  currencyBalanceNegative: {
    color: colors.error,
  },
  currencyBalanceDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  strategyListItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  strategyListItemContent: {
    flex: 1,
  },
  strategyStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  strategyStatText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  strategyEffectivenessCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  strategyEffectivenessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  strategyEffectivenessName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  strategyEffectivenessRate: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  strategyEffectivenessDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  strategyEffectivenessButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  strategyEffectivenessButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
  },
  strategyEffectivenessButtonWorked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  strategyEffectivenessButtonDidntWork: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  strategyEffectivenessButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  strategyEffectivenessButtonTextSelected: {
    color: colors.background,
  },
  button: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonPrimaryText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  createItemModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    margin: 20,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  alertButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  alertButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 14,
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
    fontSize: 15,
    fontWeight: '600',
  },
  alertButtonSecondaryText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
