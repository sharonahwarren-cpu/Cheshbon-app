
import React, { useState, useRef } from 'react';
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
}: AddReflectionModalProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [category, setCategory] = useState<string>(editingReflection?.category || '');
  const [type, setType] = useState<'Restraint' | 'Proactive'>(editingReflection?.type || 'Restraint');
  const [description, setDescription] = useState(editingReflection?.description || '');
  const [linkedGoalId, setLinkedGoalId] = useState<string>(prefilledGoalId || editingReflection?.linkedGoalId || '');
  const [outcome, setOutcome] = useState<'success' | 'struggled' | undefined>(editingReflection?.outcome);
  const [currencyChange, setCurrencyChange] = useState<{
    currencyId: string;
    amount: number;
    operation: 'add' | 'subtract';
  } | undefined>(editingReflection?.currencyChange);
  const [gainedIds, setGainedIds] = useState<string[]>(editingReflection?.gainedIds || []);
  const [lostIds, setLostIds] = useState<string[]>(editingReflection?.lostIds || []);
  const [wasWorthIt, setWasWorthIt] = useState<boolean | undefined>(editingReflection?.wasWorthIt);
  const [additionalThoughts, setAdditionalThoughts] = useState(editingReflection?.additionalThoughts || '');
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>([]);
  const [strategyEffectiveness, setStrategyEffectiveness] = useState<{
    strategyId: string;
    worked: boolean;
  }[]>(editingReflection?.strategyEffectiveness || []);
  
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showGainsPicker, setShowGainsPicker] = useState(false);
  const [showLossesPicker, setShowLossesPicker] = useState(false);
  const [showStrategyPicker, setShowStrategyPicker] = useState(false);
  
  const descriptionInputRef = useRef<TextInput>(null);
  const thoughtsInputRef = useRef<TextInput>(null);

  const getCategoryIcon = (category: string) => {
    const iconMap: Record<string, { ios: string; android: string }> = {
      'Action': { ios: 'figure.walk', android: 'directions-walk' },
      'Speech': { ios: 'bubble.left.fill', android: 'chat' },
      'Thought': { ios: 'brain.head.profile', android: 'psychology' },
    };
    return iconMap[category] || { ios: 'circle.fill', android: 'circle' };
  };

  const getDescriptionPlaceholder = () => {
    if (type === 'Restraint') {
      return 'What did you restrain from doing?';
    }
    return 'What proactive action did you take?';
  };

  const handleNext = () => {
    if (step === 1 && !description.trim()) {
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSave = async () => {
    console.log("Saving reflection from AddReflectionModal");
    
    if (!description.trim()) {
      return;
    }

    setLoading(true);
    try {
      const reflectionData = {
        entryDate: selectedDate.toISOString().split('T')[0],
        category: category || undefined,
        type,
        description: description.trim(),
        linkedGoalId: linkedGoalId || undefined,
        outcome: outcome || undefined,
        currencyChange: currencyChange || undefined,
        gainedIds: gainedIds.length > 0 ? gainedIds : undefined,
        lostIds: lostIds.length > 0 ? lostIds : undefined,
        wasWorthIt: wasWorthIt !== undefined ? wasWorthIt : undefined,
        additionalThoughts: additionalThoughts.trim() || undefined,
        strategyEffectiveness: strategyEffectiveness.length > 0 ? strategyEffectiveness : undefined,
      };

      let savedReflection;
      if (editingReflection) {
        savedReflection = await authenticatedPut(`/api/reflections/${editingReflection.id}`, reflectionData);
      } else {
        savedReflection = await authenticatedPost('/api/reflections', reflectionData);
      }

      onSave(savedReflection);
      
      setStep(1);
      setCategory('');
      setType('Restraint');
      setDescription('');
      setLinkedGoalId('');
      setOutcome(undefined);
      setCurrencyChange(undefined);
      setGainedIds([]);
      setLostIds([]);
      setWasWorthIt(undefined);
      setAdditionalThoughts('');
      setSelectedStrategies([]);
      setStrategyEffectiveness([]);
      
      onClose();
    } catch (error: any) {
      console.error("Error saving reflection:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGoal = () => {
    onClose();
    router.push('/create-goal');
  };

  const handleCreateGain = () => {
    onClose();
    router.push({
      pathname: '/(tabs)/settings',
      params: { section: 'gainsLosses', action: 'add', type: 'Gain' },
    });
  };

  const handleCreateLoss = () => {
    onClose();
    router.push({
      pathname: '/(tabs)/settings',
      params: { section: 'gainsLosses', action: 'add', type: 'Loss' },
    });
  };

  const handleCreateStrategy = () => {
    onClose();
    router.push({
      pathname: '/(tabs)/settings',
      params: { section: 'strategies', action: 'add' },
    });
  };

  const toggleStrategy = (strategyId: string) => {
    if (selectedStrategies.includes(strategyId)) {
      setSelectedStrategies(selectedStrategies.filter(id => id !== strategyId));
      setStrategyEffectiveness(strategyEffectiveness.filter(s => s.strategyId !== strategyId));
    } else {
      setSelectedStrategies([...selectedStrategies, strategyId]);
    }
  };

  const setStrategyWorked = (strategyId: string, worked: boolean) => {
    const existing = strategyEffectiveness.find(s => s.strategyId === strategyId);
    if (existing) {
      setStrategyEffectiveness(
        strategyEffectiveness.map(s =>
          s.strategyId === strategyId ? { ...s, worked } : s
        )
      );
    } else {
      setStrategyEffectiveness([...strategyEffectiveness, { strategyId, worked }]);
    }
  };

  const selectedGoal = goals.find(g => g.id === linkedGoalId);
  const selectedCurrency = currencies.find(c => c.id === currencyChange?.currencyId);
  const gains = gainsLosses.filter(gl => gl.type === 'Gain');
  const losses = gainsLosses.filter(gl => gl.type === 'Loss');

  const categoriesEnabled = userPreferences?.reflectionCategoriesEnabled ?? false;
  const availableCategories = userPreferences?.reflectionCategories || ['Action', 'Speech', 'Thought'];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <IconSymbol
              ios_icon_name="xmark"
              android_material_icon_name="close"
              size={24}
              color={colors.text}
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {editingReflection ? 'Edit Reflection' : 'Add Reflection'}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.progressIndicator}>
          {[1, 2, 3, 4].map((s) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                s === step && styles.progressDotActive,
                s < step && styles.progressDotComplete,
              ]}
            />
          ))}
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Basic Information</Text>

              {categoriesEnabled && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Category (Optional)</Text>
                  <View style={styles.categoryButtons}>
                    {availableCategories.map((cat) => {
                      const icon = getCategoryIcon(cat);
                      const isSelected = category === cat;
                      
                      return (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.categoryButton, isSelected && styles.categoryButtonActive]}
                          onPress={() => setCategory(isSelected ? '' : cat)}
                        >
                          <IconSymbol
                            ios_icon_name={icon.ios}
                            android_material_icon_name={icon.android}
                            size={20}
                            color={isSelected ? colors.background : colors.text}
                          />
                          <Text style={[styles.categoryButtonText, isSelected && styles.categoryButtonTextActive]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Type</Text>
                <View style={styles.typeButtons}>
                  <TouchableOpacity
                    style={[styles.typeButton, type === 'Restraint' && styles.typeButtonActive]}
                    onPress={() => setType('Restraint')}
                  >
                    <IconSymbol
                      ios_icon_name="hand.raised.fill"
                      android_material_icon_name="back-hand"
                      size={20}
                      color={type === 'Restraint' ? colors.background : colors.text}
                    />
                    <Text style={[styles.typeButtonText, type === 'Restraint' && styles.typeButtonTextActive]}>
                      Restraint
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeButton, type === 'Proactive' && styles.typeButtonActive]}
                    onPress={() => setType('Proactive')}
                  >
                    <IconSymbol
                      ios_icon_name="bolt.fill"
                      android_material_icon_name="flash-on"
                      size={20}
                      color={type === 'Proactive' ? colors.background : colors.text}
                    />
                    <Text style={[styles.typeButtonText, type === 'Proactive' && styles.typeButtonTextActive]}>
                      Proactive
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Description *</Text>
                <TextInput
                  ref={descriptionInputRef}
                  style={styles.textArea}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={getDescriptionPlaceholder()}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Link to Goal & Outcome</Text>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Linked Goal (Optional)</Text>
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => setShowGoalPicker(true)}
                >
                  <Text style={[styles.pickerText, !selectedGoal && styles.pickerPlaceholder]}>
                    {selectedGoal ? selectedGoal.title : 'Select a goal'}
                  </Text>
                  <IconSymbol
                    ios_icon_name="chevron.down"
                    android_material_icon_name="arrow-downward"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
                {linkedGoalId && (
                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setLinkedGoalId('')}
                  >
                    <Text style={styles.clearButtonText}>Clear Selection</Text>
                  </TouchableOpacity>
                )}
              </View>

              {linkedGoalId && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Outcome</Text>
                  <View style={styles.outcomeButtons}>
                    <TouchableOpacity
                      style={[styles.outcomeButton, outcome === 'success' && styles.outcomeButtonSuccess]}
                      onPress={() => setOutcome(outcome === 'success' ? undefined : 'success')}
                    >
                      <IconSymbol
                        ios_icon_name="checkmark.circle.fill"
                        android_material_icon_name="check-circle"
                        size={20}
                        color={outcome === 'success' ? colors.background : colors.success}
                      />
                      <Text style={[styles.outcomeButtonText, outcome === 'success' && styles.outcomeButtonTextActive]}>
                        Success
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.outcomeButton, outcome === 'struggled' && styles.outcomeButtonStruggle]}
                      onPress={() => setOutcome(outcome === 'struggled' ? undefined : 'struggled')}
                    >
                      <IconSymbol
                        ios_icon_name="xmark.circle.fill"
                        android_material_icon_name="cancel"
                        size={20}
                        color={outcome === 'struggled' ? colors.background : colors.error}
                      />
                      <Text style={[styles.outcomeButtonText, outcome === 'struggled' && styles.outcomeButtonTextActive]}>
                        Struggled
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Gains, Losses & Worth</Text>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Gains (Optional)</Text>
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => setShowGainsPicker(true)}
                >
                  <Text style={[styles.pickerText, gainedIds.length === 0 && styles.pickerPlaceholder]}>
                    {gainedIds.length > 0 ? `${gainedIds.length} selected` : 'Select gains'}
                  </Text>
                  <IconSymbol
                    ios_icon_name="chevron.down"
                    android_material_icon_name="arrow-downward"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Losses (Optional)</Text>
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => setShowLossesPicker(true)}
                >
                  <Text style={[styles.pickerText, lostIds.length === 0 && styles.pickerPlaceholder]}>
                    {lostIds.length > 0 ? `${lostIds.length} selected` : 'Select losses'}
                  </Text>
                  <IconSymbol
                    ios_icon_name="chevron.down"
                    android_material_icon_name="arrow-downward"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {type === 'Restraint' && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Was it worth it?</Text>
                  <View style={styles.worthButtons}>
                    <TouchableOpacity
                      style={[styles.worthButton, wasWorthIt === true && styles.worthButtonYes]}
                      onPress={() => setWasWorthIt(wasWorthIt === true ? undefined : true)}
                    >
                      <IconSymbol
                        ios_icon_name="hand.thumbsup.fill"
                        android_material_icon_name="thumb-up"
                        size={20}
                        color={wasWorthIt === true ? colors.background : colors.success}
                      />
                      <Text style={[styles.worthButtonText, wasWorthIt === true && styles.worthButtonTextActive]}>
                        Yes
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.worthButton, wasWorthIt === false && styles.worthButtonNo]}
                      onPress={() => setWasWorthIt(wasWorthIt === false ? undefined : false)}
                    >
                      <IconSymbol
                        ios_icon_name="hand.thumbsdown.fill"
                        android_material_icon_name="thumb-down"
                        size={20}
                        color={wasWorthIt === false ? colors.background : colors.error}
                      />
                      <Text style={[styles.worthButtonText, wasWorthIt === false && styles.worthButtonTextActive]}>
                        No
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {step === 4 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Strategies & Final Thoughts</Text>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Strategies Used (Optional)</Text>
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => setShowStrategyPicker(true)}
                >
                  <Text style={[styles.pickerText, selectedStrategies.length === 0 && styles.pickerPlaceholder]}>
                    {selectedStrategies.length > 0 ? `${selectedStrategies.length} selected` : 'Select strategies'}
                  </Text>
                  <IconSymbol
                    ios_icon_name="chevron.down"
                    android_material_icon_name="arrow-downward"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>

                {selectedStrategies.length > 0 && (
                  <View style={styles.strategyEffectivenessContainer}>
                    <Text style={styles.strategyEffectivenessTitle}>Did these strategies work?</Text>
                    {selectedStrategies.map((strategyId) => {
                      const strategy = strategies.find(s => s.id === strategyId);
                      if (!strategy) return null;
                      
                      const effectiveness = strategyEffectiveness.find(s => s.strategyId === strategyId);
                      
                      return (
                        <View key={strategyId} style={styles.strategyEffectivenessRow}>
                          <Text style={styles.strategyName}>{strategy.name}</Text>
                          <View style={styles.strategyEffectivenessButtons}>
                            <TouchableOpacity
                              style={[
                                styles.strategyEffectivenessButton,
                                effectiveness?.worked === true && styles.strategyEffectivenessButtonYes,
                              ]}
                              onPress={() => setStrategyWorked(strategyId, true)}
                            >
                              <IconSymbol
                                ios_icon_name="checkmark"
                                android_material_icon_name="check"
                                size={16}
                                color={effectiveness?.worked === true ? colors.background : colors.success}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.strategyEffectivenessButton,
                                effectiveness?.worked === false && styles.strategyEffectivenessButtonNo,
                              ]}
                              onPress={() => setStrategyWorked(strategyId, false)}
                            >
                              <IconSymbol
                                ios_icon_name="xmark"
                                android_material_icon_name="close"
                                size={16}
                                color={effectiveness?.worked === false ? colors.background : colors.error}
                              />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Additional Thoughts (Optional)</Text>
                <TextInput
                  ref={thoughtsInputRef}
                  style={styles.textArea}
                  value={additionalThoughts}
                  onChangeText={setAdditionalThoughts}
                  placeholder="Any additional reflections or insights..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step > 1 && (
            <TouchableOpacity style={styles.footerButton} onPress={handleBack}>
              <IconSymbol
                ios_icon_name="chevron.left"
                android_material_icon_name="arrow-back"
                size={20}
                color={colors.text}
              />
              <Text style={styles.footerButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          {step < 4 ? (
            <TouchableOpacity
              style={[styles.footerButton, styles.footerButtonPrimary, step === 1 && styles.footerButtonFull]}
              onPress={handleNext}
              disabled={step === 1 && !description.trim()}
            >
              <Text style={styles.footerButtonPrimaryText}>Next</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={20}
                color={colors.background}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.footerButton, styles.footerButtonPrimary]}
              onPress={handleSave}
              disabled={loading || !description.trim()}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <IconSymbol
                    ios_icon_name="checkmark"
                    android_material_icon_name="check"
                    size={20}
                    color={colors.background}
                  />
                  <Text style={styles.footerButtonPrimaryText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <Modal visible={showGoalPicker} animationType="slide" transparent={true}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerContent}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Goal</Text>
                <TouchableOpacity onPress={() => setShowGoalPicker(false)}>
                  <IconSymbol
                    ios_icon_name="xmark"
                    android_material_icon_name="close"
                    size={24}
                    color={colors.text}
                  />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.pickerList}>
                {goals.map((goal) => (
                  <TouchableOpacity
                    key={goal.id}
                    style={styles.pickerItem}
                    onPress={() => {
                      setLinkedGoalId(goal.id);
                      setShowGoalPicker(false);
                    }}
                  >
                    <Text style={styles.pickerItemText}>{goal.title}</Text>
                    {linkedGoalId === goal.id && (
                      <IconSymbol
                        ios_icon_name="checkmark"
                        android_material_icon_name="check"
                        size={20}
                        color={colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
                {goals.length === 0 && (
                  <View style={styles.pickerEmpty}>
                    <Text style={styles.pickerEmptyText}>No goals available</Text>
                    <TouchableOpacity style={styles.createButton} onPress={handleCreateGoal}>
                      <IconSymbol
                        ios_icon_name="plus"
                        android_material_icon_name="add"
                        size={20}
                        color={colors.primary}
                      />
                      <Text style={styles.createButtonText}>Create Goal</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={showGainsPicker} animationType="slide" transparent={true}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerContent}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Gains</Text>
                <TouchableOpacity onPress={() => setShowGainsPicker(false)}>
                  <IconSymbol
                    ios_icon_name="xmark"
                    android_material_icon_name="close"
                    size={24}
                    color={colors.text}
                  />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.pickerList}>
                {gains.map((gain) => {
                  const isSelected = gainedIds.includes(gain.id);
                  
                  return (
                    <TouchableOpacity
                      key={gain.id}
                      style={styles.pickerItem}
                      onPress={() => {
                        if (isSelected) {
                          setGainedIds(gainedIds.filter(id => id !== gain.id));
                        } else {
                          setGainedIds([...gainedIds, gain.id]);
                        }
                      }}
                    >
                      <Text style={styles.pickerItemText}>{gain.name}</Text>
                      {isSelected && (
                        <IconSymbol
                          ios_icon_name="checkmark"
                          android_material_icon_name="check"
                          size={20}
                          color={colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
                {gains.length === 0 && (
                  <View style={styles.pickerEmpty}>
                    <Text style={styles.pickerEmptyText}>No gains available</Text>
                    <TouchableOpacity style={styles.createButton} onPress={handleCreateGain}>
                      <IconSymbol
                        ios_icon_name="plus"
                        android_material_icon_name="add"
                        size={20}
                        color={colors.primary}
                      />
                      <Text style={styles.createButtonText}>Create Gain</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
              <TouchableOpacity
                style={styles.pickerDoneButton}
                onPress={() => setShowGainsPicker(false)}
              >
                <Text style={styles.pickerDoneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showLossesPicker} animationType="slide" transparent={true}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerContent}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Losses</Text>
                <TouchableOpacity onPress={() => setShowLossesPicker(false)}>
                  <IconSymbol
                    ios_icon_name="xmark"
                    android_material_icon_name="close"
                    size={24}
                    color={colors.text}
                  />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.pickerList}>
                {losses.map((loss) => {
                  const isSelected = lostIds.includes(loss.id);
                  
                  return (
                    <TouchableOpacity
                      key={loss.id}
                      style={styles.pickerItem}
                      onPress={() => {
                        if (isSelected) {
                          setLostIds(lostIds.filter(id => id !== loss.id));
                        } else {
                          setLostIds([...lostIds, loss.id]);
                        }
                      }}
                    >
                      <Text style={styles.pickerItemText}>{loss.name}</Text>
                      {isSelected && (
                        <IconSymbol
                          ios_icon_name="checkmark"
                          android_material_icon_name="check"
                          size={20}
                          color={colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
                {losses.length === 0 && (
                  <View style={styles.pickerEmpty}>
                    <Text style={styles.pickerEmptyText}>No losses available</Text>
                    <TouchableOpacity style={styles.createButton} onPress={handleCreateLoss}>
                      <IconSymbol
                        ios_icon_name="plus"
                        android_material_icon_name="add"
                        size={20}
                        color={colors.primary}
                      />
                      <Text style={styles.createButtonText}>Create Loss</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
              <TouchableOpacity
                style={styles.pickerDoneButton}
                onPress={() => setShowLossesPicker(false)}
              >
                <Text style={styles.pickerDoneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={showStrategyPicker} animationType="slide" transparent={true}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerContent}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select Strategies</Text>
                <TouchableOpacity onPress={() => setShowStrategyPicker(false)}>
                  <IconSymbol
                    ios_icon_name="xmark"
                    android_material_icon_name="close"
                    size={24}
                    color={colors.text}
                  />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.pickerList}>
                {strategies.map((strategy) => {
                  const isSelected = selectedStrategies.includes(strategy.id);
                  
                  return (
                    <TouchableOpacity
                      key={strategy.id}
                      style={styles.pickerItem}
                      onPress={() => toggleStrategy(strategy.id)}
                    >
                      <View style={styles.strategyItemContent}>
                        <Text style={styles.pickerItemText}>{strategy.name}</Text>
                        {strategy.description && (
                          <Text style={styles.strategyDescription}>{strategy.description}</Text>
                        )}
                      </View>
                      {isSelected && (
                        <IconSymbol
                          ios_icon_name="checkmark"
                          android_material_icon_name="check"
                          size={20}
                          color={colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
                {strategies.length === 0 && (
                  <View style={styles.pickerEmpty}>
                    <Text style={styles.pickerEmptyText}>No strategies available</Text>
                    <TouchableOpacity style={styles.createButton} onPress={handleCreateStrategy}>
                      <IconSymbol
                        ios_icon_name="plus"
                        android_material_icon_name="add"
                        size={20}
                        color={colors.primary}
                      />
                      <Text style={styles.createButtonText}>Create Strategy</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
              <TouchableOpacity
                style={styles.pickerDoneButton}
                onPress={() => setShowStrategyPicker(false)}
              >
                <Text style={styles.pickerDoneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  progressIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  progressDotComplete: {
    backgroundColor: colors.success,
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  categoryButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  categoryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  categoryButtonTextActive: {
    color: colors.background,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  typeButtonTextActive: {
    color: colors.background,
  },
  textArea: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 120,
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerText: {
    fontSize: 16,
    color: colors.text,
  },
  pickerPlaceholder: {
    color: colors.textSecondary,
  },
  clearButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  clearButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  outcomeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  outcomeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  outcomeButtonSuccess: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  outcomeButtonStruggle: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  outcomeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  outcomeButtonTextActive: {
    color: colors.background,
  },
  worthButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  worthButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  worthButtonYes: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  worthButtonNo: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  worthButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  worthButtonTextActive: {
    color: colors.background,
  },
  strategyEffectivenessContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  strategyEffectivenessTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  strategyEffectivenessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  strategyName: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  strategyEffectivenessButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  strategyEffectivenessButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  strategyEffectivenessButtonYes: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  strategyEffectivenessButtonNo: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footerButtonFull: {
    flex: 1,
  },
  footerButtonPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  footerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  footerButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  pickerModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemText: {
    fontSize: 16,
    color: colors.text,
  },
  strategyItemContent: {
    flex: 1,
    marginRight: 12,
  },
  strategyDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  pickerEmpty: {
    padding: 40,
    alignItems: 'center',
  },
  pickerEmptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  pickerDoneButton: {
    margin: 20,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  pickerDoneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
});
