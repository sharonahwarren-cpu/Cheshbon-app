
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { authenticatedGet, authenticatedPost, authenticatedPut } from '@/utils/api';
import { COLOR_PALETTE } from '@/utils/colorPalette';
import { ConfirmModal } from '@/components/ConfirmModal';

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
  }>;
}

interface Goal {
  id: string;
  title: string;
  status?: 'ACTIVE' | 'DEACTIVATED';
  lifeAreaId?: string;
}

export default function LifeAreaWizardScreen() {
  const router = useRouter();
  const { id: editingLifeAreaId } = useLocalSearchParams<{ id?: string }>();

  // Step state
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1 form data
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState(true);
  
  // Step 2 state
  const [linkedGoalIds, setLinkedGoalIds] = useState<string[]>([]);
  const [savedLifeAreaId, setSavedLifeAreaId] = useState<string | null>(null);
  
  // Data from backend
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showParentPicker, setShowParentPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColorInput, setCustomColorInput] = useState('');
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [showCreateAnotherGoalPrompt, setShowCreateAnotherGoalPrompt] = useState(false);
  
  // Modal state
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    console.log('[LifeAreaWizard] Loading data...');
    setLoading(true);
    try {
      const [lifeAreasRes, goalsRes] = await Promise.all([
        authenticatedGet('/api/life-areas'),
        authenticatedGet('/api/goals'),
      ]);

      const lifeAreasData = Array.isArray(lifeAreasRes) ? lifeAreasRes : (lifeAreasRes?.data || []);
      const goalsData = Array.isArray(goalsRes) ? goalsRes : (goalsRes?.data || []);
      
      setLifeAreas(lifeAreasData);
      setGoals(goalsData);

      // If editing, load the life area details
      if (editingLifeAreaId) {
        console.log('[LifeAreaWizard] Loading life area for editing:', editingLifeAreaId);
        const lifeAreaRes = await authenticatedGet(`/api/life-areas/${editingLifeAreaId}`);
        const lifeAreaData = lifeAreaRes?.data || lifeAreaRes;
        
        setName(lifeAreaData.name || '');
        setParentId(lifeAreaData.parentId || null);
        setIcon(lifeAreaData.icon || '');
        setColor(lifeAreaData.color || null);
        setShowProgress(lifeAreaData.showProgress !== false);
        setSavedLifeAreaId(editingLifeAreaId);
        
        // Extract linked goal IDs
        const linkedIds = (lifeAreaData.goals || []).map((g: any) => g.id);
        setLinkedGoalIds(linkedIds);
        
        // If editing, start at step 2 (goal linking)
        setCurrentStep(2);
      }
    } catch (error: any) {
      console.error('[LifeAreaWizard] Error loading data:', error);
      showError(error.message || 'Failed to load data');
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

  const handleStep1Save = async () => {
    console.log('[LifeAreaWizard] Saving Step 1...');
    
    if (!name.trim()) {
      showError('Life Area name is required');
      return;
    }

    setSubmitting(true);
    try {
      const lifeAreaData = {
        name: name.trim(),
        parentId,
        icon: icon || undefined,
        color: color || undefined,
        displayOrder: lifeAreas.length,
        showProgress,
      };

      let result;
      if (savedLifeAreaId) {
        // Update existing life area
        console.log('[API] Updating life area:', savedLifeAreaId);
        result = await authenticatedPut(`/api/life-areas/${savedLifeAreaId}`, lifeAreaData);
      } else {
        // Create new life area
        console.log('[API] Creating life area:', lifeAreaData);
        result = await authenticatedPost('/api/life-areas', lifeAreaData);
        const createdId = result?.id || result?.data?.id;
        setSavedLifeAreaId(createdId);
      }

      showSuccess('Life Area saved! Now you can link goals.');
      
      // Move to step 2 after a brief delay
      setTimeout(() => {
        setShowSuccessModal(false);
        setCurrentStep(2);
      }, 1500);
    } catch (error: any) {
      console.error('[API] Error saving life area:', error);
      showError(error.message || 'Failed to save Life Area');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkGoal = async (goalId: string) => {
    if (!savedLifeAreaId) return;
    
    try {
      console.log('[API] Linking goal to life area:', { goalId, lifeAreaId: savedLifeAreaId });
      await authenticatedPost(`/api/life-areas/${savedLifeAreaId}/goals`, { goalId });
      
      // Update local state
      setLinkedGoalIds([...linkedGoalIds, goalId]);
      showSuccess('Goal linked successfully!');
      
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 1000);
    } catch (error: any) {
      console.error('[API] Error linking goal:', error);
      showError(error.message || 'Failed to link goal');
    }
  };

  const handleUnlinkGoal = async (goalId: string) => {
    if (!savedLifeAreaId) return;
    
    try {
      console.log('[API] Unlinking goal from life area:', { goalId, lifeAreaId: savedLifeAreaId });
      await authenticatedPut(`/api/life-areas/${savedLifeAreaId}/goals/${goalId}`, {});
      
      // Update local state
      setLinkedGoalIds(linkedGoalIds.filter(id => id !== goalId));
      showSuccess('Goal unlinked successfully!');
      
      setTimeout(() => {
        setShowSuccessModal(false);
      }, 1000);
    } catch (error: any) {
      console.error('[API] Error unlinking goal:', error);
      showError(error.message || 'Failed to unlink goal');
    }
  };

  const handleCreateNewGoal = () => {
    console.log('[LifeAreaWizard] Creating new goal for life area:', savedLifeAreaId);
    // Navigate to create goal with prefilled life area
    router.push(`/create-goal?lifeAreaId=${savedLifeAreaId}&returnToLifeAreaWizard=true`);
  };

  const handleFinish = () => {
    console.log('[LifeAreaWizard] Finishing wizard, returning to settings');
    showSuccess('Life Area saved successfully!');
    
    setTimeout(() => {
      router.back();
    }, 1500);
  };

  const addCustomColor = () => {
    const hexPattern = /^#[0-9A-F]{6}$/i;
    if (customColorInput && hexPattern.test(customColorInput)) {
      setColor(customColorInput.toUpperCase());
      setCustomColorInput('');
      setShowColorPicker(false);
      showSuccess('Custom color added');
      setTimeout(() => setShowSuccessModal(false), 1000);
    } else {
      showError('Please enter a valid hex color (e.g., #FF5733)');
    }
  };

  const flattenLifeAreas = (areas: LifeArea[], depth: number = 0): Array<LifeArea & { depth: number }> => {
    let result: Array<LifeArea & { depth: number }> = [];
    areas.forEach(area => {
      // Don't show the current life area as a parent option
      if (area.id !== savedLifeAreaId) {
        result.push({ ...area, depth });
        if (area.children && area.children.length > 0) {
          result = result.concat(flattenLifeAreas(area.children, depth + 1));
        }
      }
    });
    return result;
  };

  const availableGoals = goals.filter(g => !linkedGoalIds.includes(g.id));
  const linkedGoals = goals.filter(g => linkedGoalIds.includes(g.id));

  const screenTitle = editingLifeAreaId ? 'Edit Life Area' : 'Create Life Area';
  const stepTitle = currentStep === 1 ? 'Step 1: Basic Information' : 'Step 2: Link Goals';

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: screenTitle, headerShown: true }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: screenTitle, headerShown: true }} />
      
      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, currentStep >= 1 && styles.stepDotActive]}>
          <Text style={[styles.stepDotText, currentStep >= 1 && styles.stepDotTextActive]}>1</Text>
        </View>
        <View style={[styles.stepLine, currentStep >= 2 && styles.stepLineActive]} />
        <View style={[styles.stepDot, currentStep >= 2 && styles.stepDotActive]}>
          <Text style={[styles.stepDotText, currentStep >= 2 && styles.stepDotTextActive]}>2</Text>
        </View>
      </View>

      <Text style={styles.stepTitle}>{stepTitle}</Text>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {currentStep === 1 && (
          <>
            {/* Name */}
            <View style={styles.section}>
              <Text style={styles.label}>
                Name
                <Text style={styles.required}> *</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter life area name"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {/* Parent Life Area */}
            <View style={styles.section}>
              <Text style={styles.label}>Parent Life Area</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowParentPicker(true)}
              >
                <Text style={styles.pickerText}>
                  {parentId 
                    ? flattenLifeAreas(lifeAreas).find(a => a.id === parentId)?.name || 'None'
                    : 'None (Top Level)'}
                </Text>
                <IconSymbol
                  ios_icon_name="chevron.down"
                  android_material_icon_name="arrow-drop-down"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            {/* Icon */}
            <View style={styles.section}>
              <Text style={styles.label}>Icon</Text>
              <Text style={styles.helperText}>Enter an emoji or symbol from your keyboard</Text>
              <TextInput
                style={styles.input}
                value={icon}
                onChangeText={setIcon}
                placeholder="e.g., 📚, 🏃‍♀️, ✨"
                placeholderTextColor={colors.textSecondary}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {icon && (
                <View style={styles.iconPreviewContainer}>
                  <Text style={styles.iconPreviewText}>Preview:</Text>
                  <Text style={styles.iconPreview}>{icon}</Text>
                </View>
              )}
            </View>

            {/* Color */}
            <View style={styles.section}>
              <Text style={styles.label}>Color</Text>
              <TouchableOpacity
                style={styles.colorPickerButton}
                onPress={() => setShowColorPicker(!showColorPicker)}
              >
                <View style={styles.colorPreview}>
                  {color ? (
                    <View style={[styles.colorSwatch, { backgroundColor: color }]} />
                  ) : (
                    <Text style={styles.colorPreviewText}>No color selected</Text>
                  )}
                </View>
                <IconSymbol
                  ios_icon_name={showColorPicker ? "chevron.up" : "chevron.down"}
                  android_material_icon_name={showColorPicker ? "arrow-drop-up" : "arrow-drop-down"}
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
              {showColorPicker && (
                <View style={styles.colorPickerContainer}>
                  <Text style={styles.colorPickerTitle}>Select a Color</Text>
                  <View style={styles.colorGrid}>
                    {COLOR_PALETTE.map((paletteColor, index) => {
                      const isSelected = color === paletteColor;
                      
                      return (
                        <TouchableOpacity
                          key={index}
                          style={[
                            styles.colorSquare,
                            { backgroundColor: paletteColor },
                            isSelected && styles.colorSquareSelected
                          ]}
                          onPress={() => {
                            setColor(paletteColor);
                            setShowColorPicker(false);
                          }}
                        >
                          {isSelected && (
                            <IconSymbol
                              ios_icon_name="checkmark"
                              android_material_icon_name="check"
                              size={16}
                              color={paletteColor === '#FFFFFF' || paletteColor === '#E0E0E0' ? '#000000' : '#FFFFFF'}
                            />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.customColorInputContainer}>
                    <TextInput
                      style={styles.customColorInput}
                      value={customColorInput}
                      onChangeText={setCustomColorInput}
                      placeholder="#RRGGBB"
                      placeholderTextColor={colors.textSecondary}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      maxLength={7}
                    />
                    <TouchableOpacity
                      style={styles.addCustomColorButton}
                      onPress={addCustomColor}
                    >
                      <Text style={styles.addCustomColorButtonText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* Show Progress Toggle */}
            <View style={styles.section}>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Show Progress Percentage</Text>
                <Switch
                  value={showProgress}
                  onValueChange={setShowProgress}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>
              <Text style={styles.helperText}>
                Display success percentage based on active goals in this life area
              </Text>
            </View>

            {/* Save and Continue Button */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleStep1Save}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {savedLifeAreaId ? 'Update & Continue' : 'Save & Continue'}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {currentStep === 2 && (
          <>
            {/* Linked Goals Section */}
            <View style={styles.section}>
              <Text style={styles.label}>Linked Goals</Text>
              {linkedGoals.length === 0 ? (
                <Text style={styles.emptyText}>No goals linked yet</Text>
              ) : (
                <View style={styles.linkedGoalsList}>
                  {linkedGoals.map((goal) => {
                    const statusText = goal.status === 'ACTIVE' ? 'Active' : 'Deactivated';
                    const statusColor = goal.status === 'ACTIVE' ? colors.success : colors.textSecondary;
                    
                    return (
                      <View key={goal.id} style={styles.linkedGoalItem}>
                        <View style={styles.linkedGoalInfo}>
                          <Text style={styles.linkedGoalTitle}>{goal.title}</Text>
                          <Text style={[styles.linkedGoalStatus, { color: statusColor }]}>{statusText}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleUnlinkGoal(goal.id)}
                          style={styles.unlinkButton}
                        >
                          <IconSymbol
                            ios_icon_name="xmark.circle.fill"
                            android_material_icon_name="cancel"
                            size={24}
                            color={colors.error}
                          />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Add Existing Goal */}
            <View style={styles.section}>
              <Text style={styles.label}>Add Existing Goal</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowGoalPicker(true)}
              >
                <Text style={styles.pickerText}>Select a goal to link...</Text>
                <IconSymbol
                  ios_icon_name="chevron.down"
                  android_material_icon_name="arrow-drop-down"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            {/* Create New Goal Button */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={handleCreateNewGoal}
            >
              <IconSymbol
                ios_icon_name="plus.circle.fill"
                android_material_icon_name="add-circle"
                size={20}
                color={colors.primary}
              />
              <Text style={styles.secondaryButtonText}>Create New Goal</Text>
            </TouchableOpacity>

            {/* Navigation Buttons */}
            <View style={styles.navigationButtons}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setCurrentStep(1)}
              >
                <Text style={styles.backButtonText}>Back to Step 1</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.finishButton}
                onPress={handleFinish}
              >
                <Text style={styles.finishButtonText}>Finish</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Parent Picker Modal */}
      <Modal
        visible={showParentPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowParentPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Parent Life Area</Text>
              <TouchableOpacity onPress={() => setShowParentPicker(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <TouchableOpacity
                style={[styles.pickerItem, !parentId && styles.pickerItemSelected]}
                onPress={() => {
                  setParentId(null);
                  setShowParentPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, !parentId && styles.pickerItemTextSelected]}>
                  None (Top Level)
                </Text>
              </TouchableOpacity>
              {flattenLifeAreas(lifeAreas).map((area) => {
                const isSelected = parentId === area.id;
                const paddingLeft = 20 + area.depth * 20;
                
                return (
                  <TouchableOpacity
                    key={area.id}
                    style={[styles.pickerItem, { paddingLeft }, isSelected && styles.pickerItemSelected]}
                    onPress={() => {
                      setParentId(area.id);
                      setShowParentPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                      {area.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Goal Picker Modal */}
      <Modal
        visible={showGoalPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGoalPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Goal to Link</Text>
              <TouchableOpacity onPress={() => setShowGoalPicker(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {availableGoals.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No available goals to link</Text>
                </View>
              ) : (
                availableGoals.map((goal) => (
                  <TouchableOpacity
                    key={goal.id}
                    style={styles.pickerItem}
                    onPress={() => {
                      handleLinkGoal(goal.id);
                      setShowGoalPicker(false);
                    }}
                  >
                    <Text style={styles.pickerItemText}>{goal.title}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
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

      {/* Success Modal */}
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  stepDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stepDotTextActive: {
    color: colors.background,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  required: {
    color: '#ff4444',
  },
  helperText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
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
  picker: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerText: {
    fontSize: 16,
    color: colors.text,
  },
  iconPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    padding: 12,
    backgroundColor: colors.card,
    borderRadius: 8,
  },
  iconPreviewText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  iconPreview: {
    fontSize: 32,
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
  colorPickerContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colorPickerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  colorSquare: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorSquareSelected: {
    borderColor: colors.text,
    borderWidth: 3,
  },
  customColorInputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  customColorInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addCustomColorButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCustomColorButtonText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  linkedGoalsList: {
    gap: 8,
    marginTop: 8,
  },
  linkedGoalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 8,
  },
  linkedGoalInfo: {
    flex: 1,
    marginRight: 8,
  },
  linkedGoalTitle: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 2,
  },
  linkedGoalStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  unlinkButton: {
    padding: 4,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  navigationButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  backButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  finishButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  finishButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  modalScroll: {
    maxHeight: 400,
  },
  pickerItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemSelected: {
    backgroundColor: colors.card,
  },
  pickerItemText: {
    fontSize: 16,
    color: colors.text,
  },
  pickerItemTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  alertModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    margin: 20,
    alignItems: 'center',
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
    textAlign: 'center',
    marginBottom: 20,
  },
  alertButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  alertButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
});
