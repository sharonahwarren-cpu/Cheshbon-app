
import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from "@/utils/api";

interface JournalEntry {
  id: string;
  content: string;
  mood?: string;
  createdAt: string;
  updatedAt: string;
}

interface Goal {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;
  completed: boolean;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export default function HomeScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'journal' | 'goals'>('journal');
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Journal state
  const [journalContent, setJournalContent] = useState('');
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [showJournalModal, setShowJournalModal] = useState(false);
  
  // Goal state
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [showGoalModal, setShowGoalModal] = useState(false);
  
  // Delete confirmation
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'journal' | 'goal', id: string } | null>(null);
  
  // Error/Success feedback
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    console.log("HomeScreen mounted, checking auth status");
    if (!authLoading && !user) {
      console.log("User not authenticated, redirecting to auth screen");
      router.replace('/auth');
    } else if (user) {
      console.log("User authenticated, loading data");
      loadData();
    }
  }, [user, authLoading]);

  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorModalVisible(true);
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setSuccessModalVisible(true);
  };

  const loadData = async () => {
    console.log("Loading journal entries and goals");
    setLoading(true);
    try {
      // Fetch journal entries
      console.log("[API] Fetching journal entries from /api/journal");
      const journalData = await authenticatedGet<JournalEntry[]>("/api/journal");
      console.log("[API] Journal entries received:", journalData);
      setJournalEntries(journalData || []);
      
      // Fetch goals
      console.log("[API] Fetching goals from /api/goals");
      const goalsData = await authenticatedGet<Goal[]>("/api/goals");
      console.log("[API] Goals received:", goalsData);
      setGoals(goalsData || []);
    } catch (error: any) {
      console.error("[API] Error loading data:", error);
      showError(error.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleAddJournalEntry = async () => {
    if (!journalContent.trim()) {
      console.log("Journal content is empty, not submitting");
      showError("Please enter some content for your journal entry");
      return;
    }
    
    console.log("Adding journal entry:", { content: journalContent, mood: selectedMood });
    setLoading(true);
    try {
      const payload = {
        content: journalContent,
        ...(selectedMood && { mood: selectedMood }),
      };
      console.log("[API] Creating journal entry with payload:", payload);
      const newEntry = await authenticatedPost<JournalEntry>("/api/journal", payload);
      console.log("[API] Journal entry created:", newEntry);
      
      setJournalEntries([newEntry, ...journalEntries]);
      showSuccess("Journal entry saved!");
      
      setJournalContent('');
      setSelectedMood('');
      setShowJournalModal(false);
    } catch (error: any) {
      console.error("[API] Error creating journal entry:", error);
      showError(error.message || "Failed to save journal entry");
    } finally {
      setLoading(false);
    }
  };

  const handleAddGoal = async () => {
    if (!goalTitle.trim()) {
      console.log("Goal title is empty, not submitting");
      showError("Please enter a title for your goal");
      return;
    }
    
    console.log("Adding goal:", { title: goalTitle, description: goalDescription });
    setLoading(true);
    try {
      const payload = {
        title: goalTitle,
        ...(goalDescription && { description: goalDescription }),
        progress: 0,
      };
      console.log("[API] Creating goal with payload:", payload);
      const newGoal = await authenticatedPost<Goal>("/api/goals", payload);
      console.log("[API] Goal created:", newGoal);
      
      setGoals([newGoal, ...goals]);
      showSuccess("Goal created!");
      
      setGoalTitle('');
      setGoalDescription('');
      setShowGoalModal(false);
    } catch (error: any) {
      console.error("[API] Error creating goal:", error);
      showError(error.message || "Failed to create goal");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGoalComplete = async (goalId: string) => {
    console.log("Toggling goal completion:", goalId);
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    
    const updatedCompleted = !goal.completed;
    const updatedProgress = updatedCompleted ? 100 : goal.progress;
    
    try {
      const payload = {
        completed: updatedCompleted,
        progress: updatedProgress,
      };
      console.log("[API] Updating goal with payload:", payload);
      const updatedGoal = await authenticatedPut<Goal>(`/api/goals/${goalId}`, payload);
      console.log("[API] Goal updated:", updatedGoal);
      
      setGoals(goals.map(g => g.id === goalId ? updatedGoal : g));
    } catch (error: any) {
      console.error("[API] Error updating goal:", error);
      showError(error.message || "Failed to update goal");
    }
  };

  const handleDeleteItem = async () => {
    if (!itemToDelete) return;
    
    console.log("Deleting item:", itemToDelete);
    
    try {
      if (itemToDelete.type === 'journal') {
        console.log("[API] Deleting journal entry:", itemToDelete.id);
        await authenticatedDelete(`/api/journal/${itemToDelete.id}`);
        console.log("[API] Journal entry deleted");
        setJournalEntries(journalEntries.filter(e => e.id !== itemToDelete.id));
        showSuccess("Journal entry deleted");
      } else {
        console.log("[API] Deleting goal:", itemToDelete.id);
        await authenticatedDelete(`/api/goals/${itemToDelete.id}`);
        console.log("[API] Goal deleted");
        setGoals(goals.filter(g => g.id !== itemToDelete.id));
        showSuccess("Goal deleted");
      }
    } catch (error: any) {
      console.error("[API] Error deleting item:", error);
      showError(error.message || "Failed to delete item");
    } finally {
      setDeleteModalVisible(false);
      setItemToDelete(null);
    }
  };

  const confirmDelete = (type: 'journal' | 'goal', id: string) => {
    console.log("Confirming delete:", type, id);
    setItemToDelete({ type, id });
    setDeleteModalVisible(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const getMoodEmoji = (mood?: string) => {
    const moodMap: Record<string, string> = {
      happy: '😊',
      sad: '😢',
      neutral: '😐',
      excited: '🤩',
      anxious: '😰',
    };
    return mood ? moodMap[mood] || '📝' : '📝';
  };

  if (authLoading || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const tabLabel = activeTab === 'journal' ? 'Journal' : 'Goals';
  const addButtonText = activeTab === 'journal' ? 'New Entry' : 'New Goal';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cheshbon</Text>
        <Text style={styles.headerSubtitle}>Your personal growth companion</Text>
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'journal' && styles.tabActive]}
          onPress={() => {
            console.log("Switching to journal tab");
            setActiveTab('journal');
          }}
        >
          <IconSymbol
            ios_icon_name="book.fill"
            android_material_icon_name="menu-book"
            size={20}
            color={activeTab === 'journal' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'journal' && styles.tabTextActive]}>
            Journal
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'goals' && styles.tabActive]}
          onPress={() => {
            console.log("Switching to goals tab");
            setActiveTab('goals');
          }}
        >
          <IconSymbol
            ios_icon_name="target"
            android_material_icon_name="flag"
            size={20}
            color={activeTab === 'goals' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'goals' && styles.tabTextActive]}>
            Goals
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeTab === 'journal' ? (
          <>
            {journalEntries.length === 0 ? (
              <View style={styles.emptyState}>
                <IconSymbol
                  ios_icon_name="book"
                  android_material_icon_name="menu-book"
                  size={64}
                  color={colors.muted}
                />
                <Text style={styles.emptyStateTitle}>No journal entries yet</Text>
                <Text style={styles.emptyStateText}>
                  Start writing to track your thoughts and feelings
                </Text>
              </View>
            ) : (
              <>
                {journalEntries.map((entry, index) => {
                  const dateText = formatDate(entry.createdAt);
                  const moodEmoji = getMoodEmoji(entry.mood);
                  
                  return (
                    <View key={index} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderLeft}>
                          <Text style={styles.moodEmoji}>{moodEmoji}</Text>
                          <Text style={styles.cardDate}>{dateText}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => confirmDelete('journal', entry.id)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <IconSymbol
                            ios_icon_name="trash"
                            android_material_icon_name="delete"
                            size={20}
                            color={colors.textSecondary}
                          />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.cardContent}>{entry.content}</Text>
                    </View>
                  );
                })}
              </>
            )}
          </>
        ) : (
          <>
            {goals.length === 0 ? (
              <View style={styles.emptyState}>
                <IconSymbol
                  ios_icon_name="target"
                  android_material_icon_name="flag"
                  size={64}
                  color={colors.muted}
                />
                <Text style={styles.emptyStateTitle}>No goals yet</Text>
                <Text style={styles.emptyStateText}>
                  Set your first goal and start tracking your progress
                </Text>
              </View>
            ) : (
              <>
                {goals.map((goal, index) => {
                  const progressText = `${goal.progress}%`;
                  const statusColor = goal.completed ? colors.success : colors.warning;
                  
                  return (
                    <View key={index} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <TouchableOpacity
                          style={styles.checkbox}
                          onPress={() => handleToggleGoalComplete(goal.id)}
                        >
                          {goal.completed && (
                            <IconSymbol
                              ios_icon_name="checkmark"
                              android_material_icon_name="check"
                              size={18}
                              color={colors.success}
                            />
                          )}
                        </TouchableOpacity>
                        <View style={styles.goalContent}>
                          <Text style={[styles.goalTitle, goal.completed && styles.goalTitleCompleted]}>
                            {goal.title}
                          </Text>
                          {goal.description && (
                            <Text style={styles.goalDescription}>{goal.description}</Text>
                          )}
                        </View>
                        <TouchableOpacity
                          onPress={() => confirmDelete('goal', goal.id)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <IconSymbol
                            ios_icon_name="trash"
                            android_material_icon_name="delete"
                            size={20}
                            color={colors.textSecondary}
                          />
                        </TouchableOpacity>
                      </View>
                      
                      {/* Progress Bar */}
                      <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                          <View style={[styles.progressFill, { width: progressText, backgroundColor: statusColor }]} />
                        </View>
                        <Text style={[styles.progressText, { color: statusColor }]}>{progressText}</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Add Button */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            console.log("Add button pressed for:", activeTab);
            if (activeTab === 'journal') {
              setShowJournalModal(true);
            } else {
              setShowGoalModal(true);
            }
          }}
        >
          <IconSymbol
            ios_icon_name="plus"
            android_material_icon_name="add"
            size={28}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>

      {/* Journal Entry Modal */}
      <Modal
        visible={showJournalModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowJournalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Journal Entry</Text>
              <TouchableOpacity onPress={() => setShowJournalModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>How are you feeling?</Text>
            <View style={styles.moodContainer}>
              {['happy', 'sad', 'neutral', 'excited', 'anxious'].map((mood) => {
                const emoji = getMoodEmoji(mood);
                const isSelected = selectedMood === mood;
                
                return (
                  <TouchableOpacity
                    key={mood}
                    style={[styles.moodButton, isSelected && styles.moodButtonSelected]}
                    onPress={() => {
                      console.log("Selected mood:", mood);
                      setSelectedMood(mood);
                    }}
                  >
                    <Text style={styles.moodButtonEmoji}>{emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>What's on your mind?</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Write your thoughts here..."
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={8}
              value={journalContent}
              onChangeText={setJournalContent}
              textAlignVertical="top"
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleAddJournalEntry}>
              <Text style={styles.submitButtonText}>Save Entry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Goal Modal */}
      <Modal
        visible={showGoalModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowGoalModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Goal</Text>
              <TouchableOpacity onPress={() => setShowGoalModal(false)}>
                <IconSymbol
                  ios_icon_name="xmark"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Goal Title</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Exercise 3 times a week"
              placeholderTextColor={colors.muted}
              value={goalTitle}
              onChangeText={setGoalTitle}
            />

            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Add more details about your goal..."
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={4}
              value={goalDescription}
              onChangeText={setGoalDescription}
              textAlignVertical="top"
            />

            <TouchableOpacity style={styles.submitButton} onPress={handleAddGoal}>
              <Text style={styles.submitButtonText}>Create Quick Goal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.advancedButton}
              onPress={() => {
                console.log("Navigating to advanced goal creation form");
                setShowGoalModal(false);
                router.push('/create-goal');
              }}
            >
              <Text style={styles.advancedButtonText}>Create Advanced Goal</Text>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={20}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Delete {itemToDelete?.type === 'journal' ? 'Entry' : 'Goal'}?</Text>
            <Text style={styles.confirmText}>
              This action cannot be undone.
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmButtonCancel]}
                onPress={() => {
                  console.log("Delete cancelled");
                  setDeleteModalVisible(false);
                  setItemToDelete(null);
                }}
              >
                <Text style={styles.confirmButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmButtonDelete]}
                onPress={handleDeleteItem}
              >
                <Text style={styles.confirmButtonTextDelete}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={errorModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setErrorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertModal}>
            <Text style={styles.alertTitle}>Error</Text>
            <Text style={styles.alertMessage}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => setErrorModalVisible(false)}
            >
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={successModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSuccessModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.alertModal}>
            <Text style={styles.alertTitle}>Success</Text>
            <Text style={styles.alertMessage}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.alertButton}
              onPress={() => setSuccessModalVisible(false)}
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
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 8,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moodEmoji: {
    fontSize: 24,
  },
  cardDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  cardContent: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  goalContent: {
    flex: 1,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  goalTitleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  goalDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.cardBorder,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 90,
    right: 20,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.backgroundAlt,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 16,
  },
  moodContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  moodButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.cardBorder,
  },
  moodButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.highlight,
  },
  moodButtonEmoji: {
    fontSize: 28,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  textArea: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 120,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  advancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: 8,
  },
  advancedButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  confirmModal: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 40,
    marginBottom: 200,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  confirmButtonDelete: {
    backgroundColor: '#EF4444',
  },
  confirmButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  confirmButtonTextDelete: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  alertModal: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 40,
    width: '80%',
    maxWidth: 400,
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  alertMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  alertButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 100,
  },
  alertButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
