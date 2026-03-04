
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
  LayoutAnimation,
  Dimensions,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedPost, authenticatedPut } from '@/utils/api';
import { useRouter } from 'expo-router';
import { getLocalTimezone } from '@/utils/dateUtils';

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

interface Motivation {
  id: string;
  name: string;
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
  motivationIds?: string[];
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
  motivations: Motivation[];
  prefilledGoalId?: string;
  sourceScreen?: 'express' | 'reflect';
  prefilledGoalData?: {
    id?: string;
    category?: string;
    type?: 'Restraint' | 'Proactive';
    description?: string;
    behaviorCategories?: string[];
    outcome?: 'success' | 'struggled';
    selectedDate?: Date;
  };
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
    height: '92%',
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
  required: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
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
    minHeight: 120,
    maxHeight: 200,
    textAlignVertical: 'top',
  },
  textAreaFixed: {
    height: 120,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  categoryCard: {
    flex: 1,
    minWidth: '45%',
    maxWidth: '48%',
    aspectRatio: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  categoryCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryIconContainer: {
    width: '70%',
    aspectRatio: 1,
    borderRadius: 999,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconContainerSelected: {
    backgroundColor: colors.primary + '30',
  },
  categoryCardText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  categoryCardTextSelected: {
    color: colors.background,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
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
  typeButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    minWidth: 140,
  },
  typeButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  typeButtonTextSelected: {
    color: colors.background,
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
  outcomeButtonSuccessSelected: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  outcomeButtonStruggledSelected: {
    backgroundColor: colors.error,
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
    maxHeight: 240,
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
  worthItRow: {
    flexDirection: 'row',
    gap: 12,
  },
  worthItBox: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  worthItBoxYesSelected: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  worthItBoxNoSelected: {
    backgroundColor: colors.error,
    borderColor: colors.error,
  },
  worthItText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  worthItTextSelected: {
    color: colors.background,
  },
  strategyListItemWithFeedback: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  strategyListItemMain: {
    padding: 14,
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
  strategyFeedbackIcons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  strategyFeedbackIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
  },
  strategyFeedbackIconWorked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  strategyFeedbackIconDidntWork: {
    backgroundColor: colors.error,
    borderColor: colors.error,
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
  motivations,
  prefilledGoalId,
  sourceScreen,
  prefilledGoalData,
}: AddReflectionModalProps) {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const descriptionInputRef = useRef<TextInput>(null);
  const additionalThoughtsInputRef = useRef<TextInput>(null);
  const strategyNameInputRef = useRef<TextInput>(null);
  const strategyDescInputRef = useRef<TextInput>(null);
  
  // If prefilledGoalData is provided (from Express), start at Step 3
  const initialStep = prefilledGoalData ? 3 : 1;
  
  const [step, setStep] = useState(initialStep);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [type, setType] = useState<'Restraint' | 'Proactive'>('Proactive');
  const [description, setDescription] = useState('');
  const [linkedGoalId, setLinkedGoalId] = useState<string | undefined>(undefined);
  const [outcome, setOutcome] = useState<'success' | 'struggled' | undefined>(undefined);
  const [gainedIds, setGainedIds] = useState<string[]>([]);
  const [lostIds, setLostIds] = useState<string[]>([]);
  const [wasWorthIt, setWasWorthIt] = useState<boolean | undefined>(undefined);
  const [additionalThoughts, setAdditionalThoughts] = useState('');
  const [selectedMotivationIds, setSelectedMotivationIds] = useState<string[]>([]);
  const [strategyEffectiveness, setStrategyEffectiveness] = useState<{strategyId: string; worked: boolean | null}[]>([]);
  const [futureStrategyId, setFutureStrategyId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [goalSearchQuery, setGoalSearchQuery] = useState('');
  const [showGainsPicker, setShowGainsPicker] = useState(false);
  const [gainsSearchQuery, setGainsSearchQuery] = useState('');
  const [showLossesPicker, setShowLossesPicker] = useState(false);
  const [lossesSearchQuery, setLossesSearchQuery] = useState('');
  const [showMotivationsPicker, setShowMotivationsPicker] = useState(false);
  const [motivationsSearchQuery, setMotivationsSearchQuery] = useState('');
  const [showStrategyPicker, setShowStrategyPicker] = useState(false);
  const [strategySearchQuery, setStrategySearchQuery] = useState('');
  const [showFutureStrategyPicker, setShowFutureStrategyPicker] = useState(false);
  const [futureStrategySearchQuery, setFutureStrategySearchQuery] = useState('');
  const [showCreateGainModal, setShowCreateGainModal] = useState(false);
  const [showCreateLossModal, setShowCreateLossModal] = useState(false);
  const [showCreateStrategyModal, setShowCreateStrategyModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemDescription, setNewItemDescription] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const categoriesEnabled = userPreferences.reflectionCategoriesEnabled !== false;
  const availableCategories = userPreferences.reflectionCategories || ['Action', 'Speech', 'Thought'];

  // CRITICAL FIX: Update state when props change
  // This effect handles initialization and updates for editing reflections and quick entries
  useEffect(() => {
    console.log('[AddReflectionModal] Props changed, updating state:', {
      editingReflection: editingReflection ? {
        id: editingReflection.id,
        outcome: editingReflection.outcome,
        linkedGoalId: editingReflection.linkedGoalId,
        category: editingReflection.category,
      } : null,
      prefilledGoalId,
      prefilledGoalData,
    });
    
    if (editingReflection) {
      // Editing an existing reflection - populate all fields from the reflection
      console.log('[AddReflectionModal] Editing reflection, setting all fields from editingReflection');
      setOutcome(editingReflection.outcome);
      setLinkedGoalId(editingReflection.linkedGoalId);
      setCategory(editingReflection.category);
      setType(editingReflection.type);
      setDescription(editingReflection.description);
      setGainedIds(editingReflection.gainedIds || []);
      setLostIds(editingReflection.lostIds || []);
      setWasWorthIt(editingReflection.wasWorthIt);
      setAdditionalThoughts(editingReflection.additionalThoughts || '');
      setSelectedMotivationIds(editingReflection.motivationIds || []);
      setStrategyEffectiveness(
        editingReflection.strategyEffectiveness?.map(se => ({ strategyId: se.strategyId, worked: se.worked })) || []
      );
    } else if (prefilledGoalData) {
      // CRITICAL FIX: Quick Entry from Express screen
      // When prefilledGoalData is provided, it means we're creating a new reflection from a Quick Entry
      // The prefilledGoalData contains the goal's behavior category, type, and description
      console.log('[AddReflectionModal] Quick Entry detected, setting category from prefilledGoalData:', prefilledGoalData.category);
      console.log('[AddReflectionModal] Full prefilledGoalData:', prefilledGoalData);
      
      // CRITICAL FIX: Use behaviorCategories array if available, otherwise fall back to category field
      const behaviorCategory = prefilledGoalData.behaviorCategories && prefilledGoalData.behaviorCategories.length > 0
        ? prefilledGoalData.behaviorCategories[0]
        : prefilledGoalData.category;
      
      console.log('[AddReflectionModal] Setting behavior category to:', behaviorCategory);
      setCategory(behaviorCategory);
      setType(prefilledGoalData.type || 'Proactive');
      setDescription(prefilledGoalData.description || '');
      setLinkedGoalId(prefilledGoalData.id || prefilledGoalId);
      setOutcome(prefilledGoalData.outcome); // Pre-fill outcome if provided by quick entry
      // Clear other fields for new reflection
      setGainedIds([]);
      setLostIds([]);
      setWasWorthIt(undefined);
      setAdditionalThoughts('');
      setSelectedMotivationIds([]);
      setStrategyEffectiveness([]);
      setFutureStrategyId(undefined);
    } else if (prefilledGoalId) {
      // CRITICAL FIX: When only prefilledGoalId is provided (without prefilledGoalData),
      // we need to look up the goal's behavior category
      console.log('[AddReflectionModal] prefilledGoalId provided without prefilledGoalData, looking up goal:', prefilledGoalId);
      const goal = goals.find(g => g.id === prefilledGoalId);
      if (goal) {
        console.log('[AddReflectionModal] Found goal, setting category from goal.behaviorCategories:', goal.behaviorCategories);
        if (goal.behaviorCategories && goal.behaviorCategories.length > 0) {
          setCategory(goal.behaviorCategories[0]);
        } else {
          setCategory(undefined);
        }
      }
      setLinkedGoalId(prefilledGoalId);
      setOutcome(undefined);
      // Clear other fields for new reflection
      setType('Proactive');
      setDescription('');
      setGainedIds([]);
      setLostIds([]);
      setWasWorthIt(undefined);
      setAdditionalThoughts('');
      setSelectedMotivationIds([]);
      setStrategyEffectiveness([]);
      setFutureStrategyId(undefined);
    } else {
      // Clear all fields for a new reflection
      console.log('[AddReflectionModal] No prefill data, clearing all fields');
      setOutcome(undefined);
      setLinkedGoalId(undefined);
      setCategory(undefined);
      setType('Proactive');
      setDescription('');
      setGainedIds([]);
      setLostIds([]);
      setWasWorthIt(undefined);
      setAdditionalThoughts('');
      setSelectedMotivationIds([]);
      setStrategyEffectiveness([]);
      setFutureStrategyId(undefined);
    }
  }, [editingReflection, prefilledGoalId, prefilledGoalData, goals]);

  // Keyboard listeners for iOS
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const keyboardWillShowListener = Keyboard.addListener('keyboardWillShow', (e) => {
      console.log('Keyboard will show, height:', e.endCoordinates.height);
      setKeyboardHeight(e.endCoordinates.height);
    });

    const keyboardWillHideListener = Keyboard.addListener('keyboardWillHide', () => {
      console.log('Keyboard will hide');
      setKeyboardHeight(0);
    });

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Auto-scroll to keep Description input visible when focused (Step 2)
  const handleDescriptionFocus = () => {
    console.log('Description input focused on Step 2');
    if (Platform.OS === 'ios' && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 220, animated: true });
      }, 100);
    }
  };

  // Keep cursor visible as user types in Description (Step 2)
  const handleDescriptionContentSizeChange = () => {
    if (Platform.OS === 'ios' && keyboardHeight > 0 && scrollViewRef.current) {
      console.log('Description content size changed, scrolling to keep visible');
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 260, animated: true });
      }, 50);
    }
  };

  // Auto-scroll to keep Additional Thoughts input visible when focused (Step 4)
  const handleAdditionalThoughtsFocus = () => {
    console.log('Additional thoughts input focused on Step 4');
    if (Platform.OS === 'ios' && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 420, animated: true });
      }, 100);
    }
  };

  // Keep cursor visible as user types in Additional Thoughts (Step 4)
  const handleAdditionalThoughtsContentSizeChange = () => {
    if (Platform.OS === 'ios' && keyboardHeight > 0 && scrollViewRef.current) {
      console.log('Additional thoughts content size changed, maintaining scroll position');
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 420, animated: false });
      }, 50);
    }
  };

  // Filter goals by category AND search query
  const filteredGoals = (goals || []).filter(goal => {
    if (goalSearchQuery && !goal.title.toLowerCase().includes(goalSearchQuery.toLowerCase())) {
      return false;
    }
    
    if (!categoriesEnabled) {
      return true;
    }
    
    if (!category) {
      return true;
    }
    
    if (!goal.behaviorCategories || goal.behaviorCategories.length === 0) {
      return true;
    }
    
    return goal.behaviorCategories.includes(category);
  });

  // Filter gains by search query
  const filteredGains = (gainsLosses || []).filter(gl => gl.type === 'Gain').filter(gain => {
    if (!gainsSearchQuery) return true;
    return gain.name.toLowerCase().includes(gainsSearchQuery.toLowerCase());
  });

  // Filter losses by search query
  const filteredLosses = (gainsLosses || []).filter(gl => gl.type === 'Loss').filter(loss => {
    if (!lossesSearchQuery) return true;
    return loss.name.toLowerCase().includes(lossesSearchQuery.toLowerCase());
  });

  // Filter motivations by search query
  const filteredMotivations = (motivations || []).filter(motivation => {
    if (!motivationsSearchQuery) return true;
    return motivation.name.toLowerCase().includes(motivationsSearchQuery.toLowerCase());
  });

  console.log('[AddReflectionModal] Step 4 - Motivations data:', {
    motivationsCount: motivations?.length || 0,
    filteredCount: filteredMotivations.length,
    selectedCount: selectedMotivationIds.length,
    showPicker: showMotivationsPicker,
  });

  // Filter strategies by search query
  const filteredStrategies = (strategies || []).filter(strategy => {
    if (!strategySearchQuery) return true;
    return strategy.name.toLowerCase().includes(strategySearchQuery.toLowerCase());
  });

  // Filter future strategies by search query
  const filteredFutureStrategies = (strategies || []).filter(strategy => {
    if (!futureStrategySearchQuery) return true;
    return strategy.name.toLowerCase().includes(futureStrategySearchQuery.toLowerCase());
  });

  const selectedGoal = (goals || []).find(g => g.id === linkedGoalId);
  
  const currencyBalanceInfo = (() => {
    console.log('[AddReflectionModal] Currency calculation check:', {
      linkedGoalId,
      outcome,
      selectedGoal: selectedGoal ? {
        id: selectedGoal.id,
        title: selectedGoal.title,
        rewardCurrencyId: selectedGoal.rewardCurrencyId,
        rewardAmount: selectedGoal.rewardAmount,
        rewardSuccesses: selectedGoal.rewardSuccesses,
        consequenceCurrencyId: selectedGoal.consequenceCurrencyId,
        consequenceAmount: selectedGoal.consequenceAmount,
        consequenceFailures: selectedGoal.consequenceFailures,
        successCount: selectedGoal.successCount,
        struggleCount: selectedGoal.struggleCount,
      } : null,
      currenciesCount: currencies.length,
      sourceScreen,
    });
    
    if (!linkedGoalId || !outcome || !selectedGoal) return null;
    
    const isSuccess = outcome === 'success';
    const currencyId = isSuccess ? selectedGoal.rewardCurrencyId : selectedGoal.consequenceCurrencyId;
    const amount = isSuccess ? selectedGoal.rewardAmount : selectedGoal.consequenceAmount;
    const threshold = isSuccess ? selectedGoal.rewardSuccesses : selectedGoal.consequenceFailures;
    
    if (!currencyId || !amount) return null;
    
    const currency = (currencies || []).find(c => c.id === currencyId);
    if (!currency) return null;
    
    const operation = isSuccess ? currency.onSuccess : currency.onFailure;
    if (!operation || operation === 'NONE') return null;
    
    const actionText = isSuccess 
      ? (operation === 'ADD' ? 'earn' : 'lose')
      : (operation === 'ADD' ? 'gain' : 'lose');
    
    const displayAmount = amount;
    const displaySymbol = currency.symbol || '';
    const displayThreshold = threshold || 1;
    
    const result = {
      operation: operation === 'ADD' ? 'add' : 'subtract',
      amount: displayAmount,
      symbol: displaySymbol,
      name: currency.name,
      threshold: displayThreshold,
      actionText,
      isSuccess,
    };
    
    console.log('[AddReflectionModal] Currency impact calculated:', result);
    
    return result;
  })();

  const getCategoryIcon = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower === 'action') return { ios: 'figure.walk', android: 'directions-run' };
    if (categoryLower === 'speech') return { ios: 'bubble.left.fill', android: 'chat-bubble' };
    if (categoryLower === 'thought') return { ios: 'brain.head.profile', android: 'psychology' };
    if (categoryLower === 'feeling') return { ios: 'heart.fill', android: 'favorite' };
    return { ios: 'sparkles', android: 'auto-awesome' };
  };

  // Dynamic description placeholder based on Type and Category
  const getDescriptionPlaceholder = () => {
    const categoryLower = category?.toLowerCase();
    
    if (type === 'Proactive') {
      if (categoryLower === 'action') {
        return 'Describe what you chose to do (or didn\'t actively refrain from doing)';
      } else if (categoryLower === 'speech') {
        return 'Describe what you chose to say (or didn\'t actively refrain from saying)';
      } else if (categoryLower === 'thought') {
        return 'Describe what you chose to think (or didn\'t actively refrain from thinking)';
      } else if (categoryLower === 'feeling') {
        return 'Describe what you chose to feel (or didn\'t actively refrain from feeling)';
      } else {
        return 'Describe what you chose to do/say/think/feel (or didn\'t actively refrain from)';
      }
    } else {
      if (categoryLower === 'action') {
        return 'Describe what you refrained from doing (or didn\'t actively do)';
      } else if (categoryLower === 'speech') {
        return 'Describe what you refrained from saying (or didn\'t actively say)';
      } else if (categoryLower === 'thought') {
        return 'Describe what you refrained from thinking (or didn\'t actively think)';
      } else if (categoryLower === 'feeling') {
        return 'Describe what you refrained from feeling (or didn\'t actively feel)';
      } else {
        return 'Describe what you refrained from doing/saying/thinking/feeling (or didn\'t actively do/say/think/feel)';
      }
    }
  };

  // Simplified Notes header - only based on behavior category
  const getNotesHeader = () => {
    const categoryLower = category?.toLowerCase();
    
    if (categoryLower === 'action') {
      return 'Why did/didn\'t I act that way...?';
    } else if (categoryLower === 'speech') {
      return 'Why did/didn\'t I speak that way...?';
    } else if (categoryLower === 'thought') {
      return 'Why did/didn\'t I think that way...?';
    } else if (categoryLower === 'feeling') {
      return 'Why did/didn\'t I feel that way...?';
    } else {
      return 'Why did/didn\'t I do that...?';
    }
  };

  // Simplified Notes placeholder - always the same
  const getNotesPlaceholder = () => {
    return 'What motivated me?';
  };

  // Auto-advance to Step 2 when category is selected in Step 1
  const handleCategorySelect = (selectedCategory: string) => {
    console.log('Category selected:', selectedCategory);
    setCategory(selectedCategory);
    
    setTimeout(() => {
      console.log('Auto-advancing to Step 2');
      Keyboard.dismiss();
      setStep(2);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }, 100);
    }, 300);
  };

  const handleNext = () => {
    if (step === 1 && categoriesEnabled && !category) {
      alert('Please select a category');
      return;
    }
    
    if (step === 2) {
      if (!type) {
        alert('Please select a reflection type (Proactive or Restraint)');
        return;
      }
      if (!description.trim()) {
        alert('Please enter a description');
        return;
      }
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
    if (categoriesEnabled && !category) {
      alert('Please select a category');
      return;
    }
    
    if (!type) {
      alert('Please select a reflection type');
      return;
    }
    
    if (!description.trim()) {
      alert('Please enter a description');
      return;
    }

    console.log('Saving reflection from shared AddReflectionModal, sourceScreen:', sourceScreen);
    setLoading(true);
    try {
      const localZone = getLocalTimezone();
      const localDate = new Intl.DateTimeFormat('en-CA', { 
        timeZone: localZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(selectedDate);
      const dateString = localDate;
      console.log(`[AddReflectionModal] Date string (local ${localZone}): ${dateString} (from UTC: ${selectedDate.toISOString()})`);
      
      const validStrategyEffectiveness = strategyEffectiveness.filter(se => se.worked !== null);
      
      // CRITICAL FIX: Always save category if it's set, regardless of categoriesEnabled
      // This ensures that reflections created from Express screen (with prefilledGoalData)
      // correctly save the goal's behavior category
      const payload = {
        date: dateString,
        category: category || undefined,
        type,
        description,
        linkedGoalId: linkedGoalId || undefined,
        outcome: linkedGoalId ? outcome : undefined,
        gainedIds: gainedIds.length > 0 ? gainedIds : undefined,
        lostIds: lostIds.length > 0 ? lostIds : undefined,
        wasWorthIt: wasWorthIt !== undefined ? wasWorthIt : undefined,
        additionalThoughts: additionalThoughts.trim() || undefined,
        motivationIds: selectedMotivationIds.length > 0 ? selectedMotivationIds : undefined,
        strategyEffectiveness: validStrategyEffectiveness.length > 0 ? validStrategyEffectiveness : undefined,
        futureStrategyId: futureStrategyId || undefined,
      };

      let savedReflection;
      if (editingReflection) {
        savedReflection = await authenticatedPut(`/api/reflections/${editingReflection.id}`, payload);
      } else {
        savedReflection = await authenticatedPost('/api/reflections', payload);
      }

      console.log('[AddReflectionModal] Reflection saved successfully, calling onSave callback');
      onSave(savedReflection?.data || savedReflection);
      
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
    console.log('[AddReflectionModal] Navigating to create goal screen with return params');
    const params = new URLSearchParams({
      returnToAddReflection: 'true',
      reflectionCategory: category || '',
      reflectionType: type,
      reflectionDescription: description,
      reflectionDate: selectedDate.toISOString(),
    });
    
    onClose();
    setTimeout(() => {
      router.push(`/create-goal?${params.toString()}`);
    }, 300);
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
    console.log('[AddReflectionModal] Toggling strategy:', strategyId);
    const existing = strategyEffectiveness.find(se => se.strategyId === strategyId);
    if (existing) {
      console.log('[AddReflectionModal] Removing strategy from selection');
      setStrategyEffectiveness(strategyEffectiveness.filter(se => se.strategyId !== strategyId));
    } else {
      console.log('[AddReflectionModal] Adding strategy with NO default selection (worked: null)');
      setStrategyEffectiveness([...strategyEffectiveness, { strategyId, worked: null }]);
    }
  };

  const setStrategyWorked = (strategyId: string, worked: boolean) => {
    console.log('[AddReflectionModal] Setting strategy worked status:', strategyId, worked);
    setStrategyEffectiveness(strategyEffectiveness.map(se => 
      se.strategyId === strategyId ? { ...se, worked } : se
    ));
  };

  const toggleMotivation = (motivationId: string) => {
    console.log('[AddReflectionModal] Toggling motivation:', motivationId);
    if (selectedMotivationIds.includes(motivationId)) {
      setSelectedMotivationIds(selectedMotivationIds.filter(id => id !== motivationId));
    } else {
      setSelectedMotivationIds([...selectedMotivationIds, motivationId]);
    }
  };

  const modalTitle = editingReflection ? 'Edit Reflection' : 'Add Reflection';
  const totalSteps = 5;
  const progressPercent = (step / totalSteps) * 100;

  const NEXT_BUTTON_HEIGHT = 70;
  const scrollViewBottomPadding = Platform.OS === 'ios' && keyboardHeight > 0 
    ? keyboardHeight + NEXT_BUTTON_HEIGHT + 20
    : NEXT_BUTTON_HEIGHT + 20;

  const screenWidth = Dimensions.get('window').width;
  const categoryIconSize = Math.min(screenWidth * 0.15, 80);

  const notesHeader = getNotesHeader();
  const notesPlaceholder = getNotesPlaceholder();

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
            <TouchableOpacity onPress={onClose} style={styles.backButton}>
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="cancel"
                size={28}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>

          <ScrollView 
            ref={scrollViewRef}
            style={styles.modalBody} 
            contentContainerStyle={[
              styles.modalBodyContent,
              { paddingBottom: scrollViewBottomPadding }
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* STEP 1: Category Selection */}
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
                      <Text style={styles.label}>Choose Behaviour Category</Text>
                      <Text style={styles.required}> *</Text>
                    </View>
                    <Text style={styles.helperText}>
                      Select the category that best describes this reflection
                    </Text>
                    <View style={styles.categoryGrid}>
                      {availableCategories.map((cat, index) => {
                        const isSelected = category === cat;
                        const categoryIcon = getCategoryIcon(cat);
                        
                        return (
                          <React.Fragment key={index}>
                            <TouchableOpacity
                              style={[styles.categoryCard, isSelected && styles.categoryCardSelected]}
                              onPress={() => handleCategorySelect(cat)}
                            >
                              <View style={[styles.categoryIconContainer, isSelected && styles.categoryIconContainerSelected]}>
                                <IconSymbol
                                  ios_icon_name={categoryIcon.ios}
                                  android_material_icon_name={categoryIcon.android}
                                  size={categoryIconSize * 0.5}
                                  color={isSelected ? colors.background : colors.primary}
                                />
                              </View>
                              <Text style={[styles.categoryCardText, isSelected && styles.categoryCardTextSelected]}>
                                {cat}
                              </Text>
                            </TouchableOpacity>
                          </React.Fragment>
                        );
                      })}
                    </View>
                  </View>
                )}
              </React.Fragment>
            )}

            {/* STEP 2: Type and Description */}
            {step === 2 && (
              <React.Fragment>
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <IconSymbol
                      ios_icon_name="arrow.triangle.2.circlepath"
                      android_material_icon_name="sync"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.label}>Type</Text>
                    <Text style={styles.required}> *</Text>
                  </View>
                  <Text style={styles.helperText}>
                    Is this a proactive action or a restraint?
                  </Text>
                  <View style={styles.optionsGrid}>
                    {(['Proactive', 'Restraint'] as const).map((t, index) => {
                      const isSelected = type === t;
                      const proactiveIcon = { ios: 'arrow.up.right.circle.fill', android: 'trending-up' };
                      const restraintIcon = { ios: 'hand.raised.fill', android: 'back-hand' };
                      const icon = t === 'Proactive' ? proactiveIcon : restraintIcon;
                      
                      return (
                        <React.Fragment key={index}>
                          <TouchableOpacity
                            style={[styles.typeButton, isSelected && styles.typeButtonSelected]}
                            onPress={() => setType(t)}
                          >
                            <IconSymbol
                              ios_icon_name={icon.ios}
                              android_material_icon_name={icon.android}
                              size={28}
                              color={isSelected ? colors.background : colors.primary}
                            />
                            <Text style={[styles.typeButtonText, isSelected && styles.typeButtonTextSelected]}>
                              {t}
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
                    <Text style={styles.required}> *</Text>
                  </View>
                  <TextInput
                    ref={descriptionInputRef}
                    style={[styles.input, styles.textArea]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder={getDescriptionPlaceholder()}
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    textAlignVertical="top"
                    blurOnSubmit={false}
                    onFocus={handleDescriptionFocus}
                    onContentSizeChange={handleDescriptionContentSizeChange}
                  />
                </View>
              </React.Fragment>
            )}

            {/* STEP 3: Link to a Goal */}
            {step === 3 && (
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
                              style={[
                                styles.outcomeButton, 
                                isSelected && (o === 'success' ? styles.outcomeButtonSuccessSelected : styles.outcomeButtonStruggledSelected)
                              ]}
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

            {/* STEP 4: Notes, Motivations, Gains, Losses, Was it worth it */}
            {step === 4 && (
              <React.Fragment>
                {/* NOTES SECTION */}
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <IconSymbol
                      ios_icon_name="text.bubble.fill"
                      android_material_icon_name="chat-bubble"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.label}>{notesHeader}</Text>
                  </View>
                  <TextInput
                    ref={additionalThoughtsInputRef}
                    style={[styles.input, styles.textAreaFixed]}
                    value={additionalThoughts}
                    onChangeText={setAdditionalThoughts}
                    placeholder={notesPlaceholder}
                    placeholderTextColor={colors.textSecondary}
                    multiline
                    textAlignVertical="top"
                    blurOnSubmit={false}
                    onFocus={handleAdditionalThoughtsFocus}
                    onContentSizeChange={handleAdditionalThoughtsContentSizeChange}
                  />
                </View>

                {/* MOTIVATIONS SECTION - FIXED FOR iOS */}
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <IconSymbol
                      ios_icon_name="bolt.fill"
                      android_material_icon_name="flash-on"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.label}>Motivations (Optional)</Text>
                  </View>
                  <Text style={styles.helperText}>
                    Select one or more motivations that drove this behavior
                  </Text>
                  <TouchableOpacity
                    style={styles.goalPickerButton}
                    onPress={() => {
                      console.log('[AddReflectionModal] Toggling motivations picker, current state:', showMotivationsPicker);
                      setShowMotivationsPicker(!showMotivationsPicker);
                    }}
                  >
                    <Text style={styles.goalPickerText}>
                      {selectedMotivationIds.length > 0 ? `${selectedMotivationIds.length} motivations selected` : 'Select motivations...'}
                    </Text>
                    <IconSymbol
                      ios_icon_name="chevron.down"
                      android_material_icon_name="arrow-drop-down"
                      size={24}
                      color={colors.text}
                    />
                  </TouchableOpacity>

                  {showMotivationsPicker && (
                    <View style={styles.pickerContainer}>
                      <TextInput
                        style={styles.searchInput}
                        value={motivationsSearchQuery}
                        onChangeText={setMotivationsSearchQuery}
                        placeholder="Search motivations..."
                        placeholderTextColor={colors.textSecondary}
                      />
                      <ScrollView style={styles.pickerList} nestedScrollEnabled={true}>
                        {filteredMotivations.length === 0 ? (
                          <View style={styles.goalItem}>
                            <Text style={styles.goalItemText}>No motivations available</Text>
                          </View>
                        ) : (
                          filteredMotivations.map((motivation, index) => {
                            const isSelected = selectedMotivationIds.includes(motivation.id);
                            
                            return (
                              <React.Fragment key={index}>
                                <TouchableOpacity
                                  style={[styles.goalItem, isSelected && styles.goalItemSelected]}
                                  onPress={() => toggleMotivation(motivation.id)}
                                >
                                  <Text style={[styles.goalItemText, isSelected && styles.goalItemTextSelected]}>
                                    {motivation.name}
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
                          })
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* WHAT WAS GAINED */}
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
                      <TextInput
                        style={styles.searchInput}
                        value={gainsSearchQuery}
                        onChangeText={setGainsSearchQuery}
                        placeholder="Search gains..."
                        placeholderTextColor={colors.textSecondary}
                      />
                      <ScrollView style={styles.pickerList} nestedScrollEnabled={true}>
                        {filteredGains.map((gain, index) => {
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

                {/* WHAT WAS LOST */}
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
                      <TextInput
                        style={styles.searchInput}
                        value={lossesSearchQuery}
                        onChangeText={setLossesSearchQuery}
                        placeholder="Search losses..."
                        placeholderTextColor={colors.textSecondary}
                      />
                      <ScrollView style={styles.pickerList} nestedScrollEnabled={true}>
                        {filteredLosses.map((loss, index) => {
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

                {/* WAS IT WORTH IT */}
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
                  <View style={styles.worthItRow}>
                    <TouchableOpacity
                      style={[styles.worthItBox, wasWorthIt === true && styles.worthItBoxYesSelected]}
                      onPress={() => setWasWorthIt(true)}
                    >
                      <IconSymbol
                        ios_icon_name="hand.thumbsup.fill"
                        android_material_icon_name="thumb-up"
                        size={32}
                        color={wasWorthIt === true ? colors.background : colors.success}
                      />
                      <Text style={[styles.worthItText, wasWorthIt === true && styles.worthItTextSelected]}>
                        Yes
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.worthItBox, wasWorthIt === false && styles.worthItBoxNoSelected]}
                      onPress={() => setWasWorthIt(false)}
                    >
                      <IconSymbol
                        ios_icon_name="hand.thumbsdown.fill"
                        android_material_icon_name="thumb-down"
                        size={32}
                        color={wasWorthIt === false ? colors.background : colors.error}
                      />
                      <Text style={[styles.worthItText, wasWorthIt === false && styles.worthItTextSelected]}>
                        No
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </React.Fragment>
            )}

            {/* STEP 5: Strategies */}
            {step === 5 && (
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
                    Select strategies you used and mark whether they worked
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
                      <TextInput
                        style={styles.searchInput}
                        value={strategySearchQuery}
                        onChangeText={setStrategySearchQuery}
                        placeholder="Search strategies..."
                        placeholderTextColor={colors.textSecondary}
                      />
                      <ScrollView style={styles.pickerList} nestedScrollEnabled={true}>
                        {filteredStrategies.map((strategy, index) => {
                          const effectiveness = strategyEffectiveness.find(se => se.strategyId === strategy.id);
                          const isSelected = !!effectiveness;
                          const successRateText = `${Math.round(strategy.successRate)}%`;
                          const timesUsedText = `${strategy.timesUsed} times`;
                          
                          return (
                            <React.Fragment key={index}>
                              <View style={styles.strategyListItemWithFeedback}>
                                <TouchableOpacity
                                  style={[styles.strategyListItemMain, isSelected && styles.goalItemSelected]}
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
                                    <View style={styles.strategyFeedbackIcons}>
                                      <TouchableOpacity
                                        style={[
                                          styles.strategyFeedbackIcon,
                                          effectiveness?.worked === true && styles.strategyFeedbackIconWorked
                                        ]}
                                        onPress={() => setStrategyWorked(strategy.id, true)}
                                      >
                                        <IconSymbol
                                          ios_icon_name="checkmark.circle.fill"
                                          android_material_icon_name="check-circle"
                                          size={24}
                                          color={effectiveness?.worked === true ? colors.background : colors.success}
                                        />
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={[
                                          styles.strategyFeedbackIcon,
                                          effectiveness?.worked === false && styles.strategyFeedbackIconDidntWork
                                        ]}
                                        onPress={() => setStrategyWorked(strategy.id, false)}
                                      >
                                        <IconSymbol
                                          ios_icon_name="xmark.circle.fill"
                                          android_material_icon_name="cancel"
                                          size={24}
                                          color={effectiveness?.worked === false ? colors.background : colors.error}
                                        />
                                      </TouchableOpacity>
                                    </View>
                                  )}
                                </TouchableOpacity>
                              </View>
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

                {/* FUTURE STRATEGY SECTION */}
                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <IconSymbol
                      ios_icon_name="sparkles"
                      android_material_icon_name="auto-awesome"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.label}>Future Strategy (Optional)</Text>
                  </View>
                  <Text style={styles.helperText}>
                    Select a strategy you think may help you with this in the future
                  </Text>
                  <TouchableOpacity
                    style={styles.goalPickerButton}
                    onPress={() => setShowFutureStrategyPicker(!showFutureStrategyPicker)}
                  >
                    <Text style={styles.goalPickerText}>
                      {futureStrategyId ? (strategies || []).find(s => s.id === futureStrategyId)?.name || 'Select a strategy...' : 'Select a strategy...'}
                    </Text>
                    <IconSymbol
                      ios_icon_name="chevron.down"
                      android_material_icon_name="arrow-drop-down"
                      size={24}
                      color={colors.text}
                    />
                  </TouchableOpacity>

                  {showFutureStrategyPicker && (
                    <View style={styles.pickerContainer}>
                      <TextInput
                        style={styles.searchInput}
                        value={futureStrategySearchQuery}
                        onChangeText={setFutureStrategySearchQuery}
                        placeholder="Search strategies..."
                        placeholderTextColor={colors.textSecondary}
                      />
                      <ScrollView style={styles.pickerList} nestedScrollEnabled={true}>
                        <TouchableOpacity
                          style={styles.goalItem}
                          onPress={() => {
                            setFutureStrategyId(undefined);
                            setShowFutureStrategyPicker(false);
                          }}
                        >
                          <Text style={styles.goalItemText}>None</Text>
                        </TouchableOpacity>
                        {filteredFutureStrategies.map((strategy, index) => {
                          const isSelected = futureStrategyId === strategy.id;
                          const successRateText = `${Math.round(strategy.successRate)}%`;
                          const timesUsedText = `${strategy.timesUsed} times`;
                          
                          return (
                            <React.Fragment key={index}>
                              <TouchableOpacity
                                style={[styles.goalItem, isSelected && styles.goalItemSelected]}
                                onPress={() => {
                                  setFutureStrategyId(strategy.id);
                                  setShowFutureStrategyPicker(false);
                                }}
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
