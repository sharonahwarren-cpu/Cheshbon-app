
import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Platform,
  Image,
  TextInput,
  KeyboardAvoidingView,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { authenticatedGet, authenticatedPost, authenticatedDelete, getBearerToken, BACKEND_URL } from "@/utils/api";
import { colors } from "@/styles/commonStyles";
import { AddReflectionModal } from "@/components/AddReflectionModal";
import { IconSymbol } from "@/components/IconSymbol";
import { DatePickerModal } from "@/components/DatePickerModal";
import { DateTime } from 'luxon';
import { getLocalTimezone } from '@/utils/dateUtils';
import * as Speech from 'expo-speech';
import { AudioRecorder, AudioRecording, RecordingOptions } from 'expo-audio';

interface DailyEntry {
  id: string;
  type: 'success' | 'struggle';
  timestamp: string;
}

interface ActivatedGoal {
  id: string;
  title: string;
  description?: string;
  type: 'RESTRAINING' | 'PROACTIVE';
  lifeArea?: { id: string; name: string; parentId?: string; level: number; icon?: string; color?: string };
  subCategory?: string;
  behaviorCategories: string[];
  todaySuccessCount: number;
  todayStruggleCount: number;
  dailyEntries?: DailyEntry[];
  successCount: number;
  struggleCount: number;
  streak?: number;
  rewardCurrencyId?: string;
  rewardSuccesses?: number;
  rewardAmount?: number;
  consequenceCurrencyId?: string;
  consequenceFailures?: number;
  consequenceAmount?: number;
}

interface LifeAreaNode {
  id: string;
  name: string;
  parentId?: string | null;
  icon?: string;
  color?: string;
  displayOrder: number;
  showProgress: boolean;
  children: LifeAreaNode[];
  goals: ActivatedGoal[];
}

interface Currency {
  id: string;
  name: string;
  symbol?: string;
  type?: 'reward' | 'consequence';
  onSuccess?: 'ADD' | 'SUBTRACT' | 'NONE';
  onFailure?: 'ADD' | 'SUBTRACT' | 'NONE';
}

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

interface UserPreferences {
  reflectionCategoriesEnabled?: boolean;
  reflectionCategories?: string[];
}

interface JournalEntry {
  id: string;
  content: string;
  entryDate: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

// Helper function to format date as YYYY-MM-DD in local timezone
function formatDateLocal(date: Date): string {
  try {
    const localZone = getLocalTimezone();
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: localZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
    console.log(`[Home] formatDateLocal: ${date.toISOString()} -> ${formatted} (${localZone})`);
    return formatted;
  } catch (error) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

// Helper function to format alternative calendar date
function formatAlternativeDate(date: Date, calendarType: string): string {
  if (!calendarType || calendarType === 'gregorian') return '';
  
  try {
    if (calendarType === 'hebrew') {
      const hebrewDate = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
      return hebrewDate;
    } else if (calendarType === 'islamic') {
      const islamicDate = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
      return islamicDate;
    } else if (calendarType === 'chinese') {
      const chineseDate = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
      return chineseDate;
    }
  } catch (error) {
    console.error('Error formatting alternative calendar date:', error);
  }
  
  return '';
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ date?: string; openModal?: string; goalId?: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [lifeAreas, setLifeAreas] = useState<LifeAreaNode[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [gainsLosses, setGainsLosses] = useState<GainLoss[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({});
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [expandedLifeAreas, setExpandedLifeAreas] = useState<Record<string, boolean>>({});
  const [expandedReflectionCategories, setExpandedReflectionCategories] = useState<Record<string, boolean>>({});

  const [showAddReflectionModal, setShowAddReflectionModal] = useState(false);
  const [editingReflection, setEditingReflection] = useState<Reflection | null>(null);

  const [showJournalModal, setShowJournalModal] = useState(false);
  const [tempJournalContent, setTempJournalContent] = useState('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [alternativeCalendar, setAlternativeCalendar] = useState<string>('gregorian');

  const [lifetimeTotals, setLifetimeTotals] = useState({ successes: 0, struggles: 0 });

  // AI Chat state
  const [showChatModal, setShowChatModal] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioRecording, setAudioRecording] = useState<AudioRecording | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (params.date) {
      const dateFromParam = new Date(params.date);
      if (!isNaN(dateFromParam.getTime())) {
        setSelectedDate(dateFromParam);
      }
    }
  }, [params.date]);

  useEffect(() => {
    if (params.openModal === 'true') {
      openAddReflectionModal();
    }
  }, [params.openModal, params.goalId]);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  useEffect(() => {
    if (showSuccessModal) {
      const timer = setTimeout(() => {
        setShowSuccessModal(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessModal]);

  const showError = (message: string) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessModal(true);
  };

  const loadData = async () => {
    const dateString = formatDateLocal(selectedDate);
    console.log('Loading home data for date (local):', dateString);
    setLoading(true);
    try {
      const [
        lifeAreasRes,
        currenciesRes,
        gainsLossesRes,
        strategiesRes,
        prefsRes,
        reflectionsRes,
        journalRes,
      ] = await Promise.all([
        authenticatedGet(`/api/goals/activated?date=${dateString}`),
        authenticatedGet('/api/currencies'),
        authenticatedGet('/api/gains-losses'),
        authenticatedGet('/api/strategies'),
        authenticatedGet('/api/user-preferences'),
        authenticatedGet(`/api/reflections/by-date?date=${dateString}`),
        authenticatedGet(`/api/journals/by-date?date=${dateString}`),
      ]);

      const lifeAreasData = Array.isArray(lifeAreasRes) ? lifeAreasRes : (lifeAreasRes?.data || []);
      const currenciesData = Array.isArray(currenciesRes) ? currenciesRes : (currenciesRes?.data || []);
      const gainsLossesData = Array.isArray(gainsLossesRes) ? gainsLossesRes : (gainsLossesRes?.data || []);
      const strategiesData = Array.isArray(strategiesRes) ? strategiesRes : (strategiesRes?.data || []);
      const prefsData = prefsRes?.data || prefsRes || {};
      const reflectionsData = Array.isArray(reflectionsRes) ? reflectionsRes : (reflectionsRes?.data || []);
      const journalData = journalRes?.data || journalRes || null;

      setLifeAreas(lifeAreasData);
      setCurrencies(currenciesData);
      setGainsLosses(gainsLossesData);
      setStrategies(strategiesData);
      setUserPreferences(prefsData);
      setReflections(reflectionsData);
      setJournalEntry(journalData);
      setAlternativeCalendar(prefsData.alternativeCalendar || 'gregorian');

      calculateLifetimeTotals();

      console.log('Home data loaded successfully');
    } catch (error) {
      console.error('Error loading home data:', error);
      showError('Failed to load home data');
    } finally {
      setLoading(false);
    }
  };

  // AI Chat functions
  const requestAudioPermissions = async () => {
    try {
      const { granted } = await AudioRecorder.requestPermissionsAsync();
      if (!granted) {
        showError('Microphone permission is required for voice input');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
      return false;
    }
  };

  const speakText = async (text: string) => {
    try {
      setIsSpeaking(true);
      await Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.9,
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
      });
    } catch (error) {
      console.error('Error speaking text:', error);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = async () => {
    try {
      await Speech.stop();
      setIsSpeaking(false);
    } catch (error) {
      console.error('Error stopping speech:', error);
    }
  };

  const startRecording = async () => {
    const hasPermission = await requestAudioPermissions();
    if (!hasPermission) return;

    try {
      await stopSpeaking();
      
      const options: RecordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: 2,
          audioEncoder: 3,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          audioQuality: 127,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      };

      const recording = await AudioRecorder.recordAsync(options);
      setAudioRecording(recording);
      setIsRecording(true);
      console.log('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      showError('Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!audioRecording) return;

    try {
      setIsRecording(false);
      const uri = await audioRecording.stopAsync();
      setAudioRecording(null);
      console.log('Recording stopped, URI:', uri);
      
      if (uri) {
        await transcribeAndSend(uri);
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      showError('Failed to stop recording');
    }
  };

  const transcribeAndSend = async (audioUri: string) => {
    try {
      setSendingMessage(true);
      
      const token = await getBearerToken();
      if (!token) {
        showError('Authentication required');
        return;
      }

      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);

      const response = await fetch(`${BACKEND_URL}/api/reflection-chat/transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      const transcribedText = data.text || data.transcription;
      
      if (transcribedText) {
        setMessageInput(transcribedText);
        await sendMessageWithText(transcribedText);
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      showError('Failed to transcribe audio');
    } finally {
      setSendingMessage(false);
    }
  };

  const loadConversations = async () => {
    try {
      const response = await authenticatedGet('/api/reflection-chat/conversations');
      const conversationsData = Array.isArray(response) ? response : (response?.data || []);
      setConversations(conversationsData);
      console.log('Loaded conversations:', conversationsData.length);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const response = await authenticatedGet(`/api/reflection-chat/conversations/${conversationId}/messages`);
      const messagesData = Array.isArray(response) ? response : (response?.data || []);
      setMessages(messagesData);
      console.log('Loaded messages:', messagesData.length);
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
      showError('Failed to load messages');
    }
  };

  const startNewConversation = async () => {
    try {
      const response = await authenticatedPost('/api/reflection-chat/conversations', {});
      const newConversation = response?.data || response;
      
      if (newConversation && newConversation.id) {
        setCurrentConversationId(newConversation.id);
        setMessages([]);
        await loadConversations();
        await loadMessages(newConversation.id);
        console.log('Started new conversation:', newConversation.id);
      }
    } catch (error) {
      console.error('Error starting new conversation:', error);
      showError('Failed to start new conversation');
    }
  };

  const sendMessageWithText = async (text: string) => {
    if (!text.trim()) return;
    
    if (!currentConversationId) {
      await startNewConversation();
      return;
    }

    try {
      setSendingMessage(true);
      
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMessage]);
      setMessageInput('');

      const response = await authenticatedPost(
        `/api/reflection-chat/conversations/${currentConversationId}/messages`,
        { message: text }
      );

      const aiResponse = response?.data || response;
      
      if (aiResponse && aiResponse.response) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: aiResponse.response,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        await speakText(aiResponse.response);
        
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showError('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const sendMessage = async () => {
    await sendMessageWithText(messageInput);
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      await authenticatedDelete(`/api/reflection-chat/conversations/${conversationId}`);
      await loadConversations();
      
      if (currentConversationId === conversationId) {
        setCurrentConversationId(null);
        setMessages([]);
      }
      
      showSuccess('Conversation deleted');
    } catch (error) {
      console.error('Error deleting conversation:', error);
      showError('Failed to delete conversation');
    }
  };

  const openChatModal = async () => {
    setShowChatModal(true);
    await loadConversations();
    
    if (conversations.length > 0 && !currentConversationId) {
      const latestConversation = conversations[0];
      setCurrentConversationId(latestConversation.id);
      await loadMessages(latestConversation.id);
    } else if (conversations.length === 0) {
      await startNewConversation();
    }
  };

  const closeChatModal = () => {
    setShowChatModal(false);
    stopSpeaking();
  };

  const selectConversation = async (conversationId: string) => {
    setCurrentConversationId(conversationId);
    await loadMessages(conversationId);
  };

  const handleGoalSuccess = async (goalId: string) => {
    console.log('Recording success for goal:', goalId);
    try {
      const dateString = formatDateLocal(selectedDate);
      await authenticatedPost(`/api/goals/${goalId}/success`, { date: dateString });
      showSuccess('Success recorded!');
      await loadData();
    } catch (error) {
      console.error('Error recording success:', error);
      showError('Failed to record success');
    }
  };

  const handleGoalStruggle = async (goalId: string) => {
    console.log('Recording struggle for goal:', goalId);
    try {
      const dateString = formatDateLocal(selectedDate);
      await authenticatedPost(`/api/goals/${goalId}/struggle`, { date: dateString });
      showSuccess('Struggle recorded');
      await loadData();
    } catch (error) {
      console.error('Error recording struggle:', error);
      showError('Failed to record struggle');
    }
  };

  const handleDeleteEntry = async (goalId: string, entryId: string) => {
    console.log('Deleting entry:', entryId, 'for goal:', goalId);
    try {
      await authenticatedDelete(`/api/goals/${goalId}/entries/${entryId}`);
      showSuccess('Entry deleted');
      await loadData();
    } catch (error) {
      console.error('Error deleting entry:', error);
      showError('Failed to delete entry');
    }
  };

  const handleEditGoal = (goalId: string) => {
    console.log('Navigating to edit goal:', goalId);
    router.push(`/create-goal?id=${goalId}`);
  };

  const handleCreateGoal = () => {
    console.log('Navigating to create goal');
    router.push('/create-goal');
  };

  const openAddReflectionModal = () => {
    const prefilledGoalId = params.goalId as string | undefined;
    setEditingReflection(null);
    setShowAddReflectionModal(true);
  };

  const openEditReflectionModal = (reflection: Reflection) => {
    setEditingReflection(reflection);
    setShowAddReflectionModal(true);
  };

  const handleReflectionSaved = (reflection: Reflection) => {
    console.log('Reflection saved, updating list');
    if (editingReflection) {
      setReflections(reflections.map(r => r.id === reflection.id ? reflection : r));
    } else {
      setReflections([...reflections, reflection]);
    }
    setShowAddReflectionModal(false);
    setEditingReflection(null);
    showSuccess('Reflection saved successfully');
  };

  const handleDeleteReflection = async (id: string) => {
    console.log('Deleting reflection:', id);
    try {
      await authenticatedDelete(`/api/reflections/${id}`);
      setReflections(reflections.filter(r => r.id !== id));
      showSuccess('Reflection deleted successfully');
    } catch (error) {
      console.error('Error deleting reflection:', error);
      showError('Failed to delete reflection');
    }
  };

  const handleOpenJournalModal = () => {
    console.log('Opening journal modal');
    setTempJournalContent(journalEntry?.content || '');
    setShowJournalModal(true);
  };

  const handleCloseJournalModal = () => {
    console.log('Closing journal modal without saving');
    setShowJournalModal(false);
    setTempJournalContent('');
  };

  const handleSaveJournal = async () => {
    console.log('Saving journal entry...');
    try {
      setLoading(true);
      const dateString = formatDateLocal(selectedDate);
      
      const response = await authenticatedPost('/api/journals/by-date', {
        date: dateString,
        content: tempJournalContent,
      });

      const savedEntry = response?.data || response;
      
      if (savedEntry && savedEntry.deleted) {
        console.log('Journal entry deleted (content was empty)');
        setJournalEntry(null);
        showSuccess('Journal entry deleted');
      } else if (savedEntry) {
        console.log('Journal entry saved');
        setJournalEntry(savedEntry);
        showSuccess('Journal saved successfully');
      } else {
        console.log('No journal entry (content was empty and no existing entry)');
        setJournalEntry(null);
      }
      
      setShowJournalModal(false);
      setTempJournalContent('');
    } catch (error) {
      console.error('Error saving journal:', error);
      showError('Failed to save journal entry');
    } finally {
      setLoading(false);
    }
  };

  const toggleLifeArea = (areaId: string) => {
    setExpandedLifeAreas(prev => ({
      ...prev,
      [areaId]: !prev[areaId],
    }));
  };

  const toggleReflectionCategory = (category: string) => {
    setExpandedReflectionCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
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

  const formatDateDisplay = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    };
    return date.toLocaleDateString('en-US', options);
  };

  const calculateDailyCurrencyTallies = (goal: ActivatedGoal) => {
    const rewardTally = goal.todaySuccessCount || 0;
    const consequenceTally = goal.todayStruggleCount || 0;
    return { rewardTally, consequenceTally };
  };

  const getCategoryIcon = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower === 'action') return { ios: 'figure.walk', android: 'directions-run' };
    if (categoryLower === 'speech') return { ios: 'bubble.left.fill', android: 'chat-bubble' };
    if (categoryLower === 'thought') return { ios: 'brain.head.profile', android: 'psychology' };
    if (categoryLower === 'feeling') return { ios: 'heart.fill', android: 'favorite' };
    return { ios: 'sparkles', android: 'auto-awesome' };
  };

  const countTotalGoals = (area: LifeAreaNode): number => {
    let count = area.goals.length;
    area.children.forEach(child => {
      count += countTotalGoals(child);
    });
    return count;
  };

  const hasActiveGoalsInHierarchy = (area: LifeAreaNode): boolean => {
    if (area.goals.length > 0) return true;
    return area.children.some(child => hasActiveGoalsInHierarchy(child));
  };

  const getGoalsForArea = (areaId: string): ActivatedGoal[] => {
    const findGoals = (areas: LifeAreaNode[]): ActivatedGoal[] => {
      for (const area of areas) {
        if (area.id === areaId) {
          return area.goals;
        }
        const childGoals = findGoals(area.children);
        if (childGoals.length > 0) return childGoals;
      }
      return [];
    };
    return findGoals(lifeAreas);
  };

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    console.log('Scroll offset:', offsetY);
  };

  const calculateLifetimeTotals = async () => {
    try {
      const response = await authenticatedGet('/api/goals/lifetime-totals');
      const data = response?.data || response || { successes: 0, struggles: 0 };
      setLifetimeTotals(data);
    } catch (error) {
      console.error('Error loading lifetime totals:', error);
    }
  };

  const renderConciseGoalCard = (goal: ActivatedGoal) => {
    return (
      <View key={goal.id} style={styles.conciseGoalCard}>
        <View style={styles.conciseGoalHeader}>
          <Text style={styles.conciseGoalTitle} numberOfLines={1}>{goal.title}</Text>
          <TouchableOpacity onPress={() => handleEditGoal(goal.id)} style={styles.editButton}>
            <IconSymbol
              ios_icon_name="pencil"
              android_material_icon_name="edit"
              size={16}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.conciseGoalActions}>
          <TouchableOpacity
            style={styles.conciseActionButton}
            onPress={() => handleGoalSuccess(goal.id)}
          >
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={20}
              color={colors.success}
            />
          </TouchableOpacity>
          <Text style={styles.conciseGoalStats}>
            {goal.todaySuccessCount || 0} / {goal.todayStruggleCount || 0}
          </Text>
          <TouchableOpacity
            style={styles.conciseActionButton}
            onPress={() => handleGoalStruggle(goal.id)}
          >
            <IconSymbol
              ios_icon_name="xmark.circle.fill"
              android_material_icon_name="cancel"
              size={20}
              color={colors.error}
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderLifeAreaNode = (area: LifeAreaNode, depth: number) => {
    const isExpanded = expandedLifeAreas[area.id];
    const hasGoals = area.goals.length > 0;
    const hasChildren = area.children.length > 0;
    const totalGoals = countTotalGoals(area);
    const hasAnyGoals = hasActiveGoalsInHierarchy(area);

    if (!hasAnyGoals) return null;

    const areaIconName = area.icon || 'folder';
    const areaColor = area.color || colors.primary;

    return (
      <View key={area.id} style={[styles.lifeAreaContainer, { marginLeft: depth * 16 }]}>
        <TouchableOpacity
          style={styles.lifeAreaHeader}
          onPress={() => toggleLifeArea(area.id)}
        >
          <View style={styles.lifeAreaTitleRow}>
            <IconSymbol
              ios_icon_name={isExpanded ? 'chevron.down' : 'chevron.right'}
              android_material_icon_name={isExpanded ? 'arrow-downward' : 'arrow-forward'}
              size={20}
              color={colors.text}
            />
            <View style={[styles.lifeAreaIconContainer, { backgroundColor: areaColor + '20' }]}>
              <Text style={styles.lifeAreaIconText}>{areaIconName}</Text>
            </View>
            <Text style={styles.lifeAreaName}>{area.name}</Text>
          </View>
          <View style={styles.lifeAreaBadge}>
            <Text style={styles.lifeAreaBadgeText}>{totalGoals}</Text>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.lifeAreaContent}>
            {hasGoals && area.goals.map(goal => renderConciseGoalCard(goal))}
            {hasChildren && area.children.map(child => renderLifeAreaNode(child, depth + 1))}
          </View>
        )}
      </View>
    );
  };

  const renderChatMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    const messageTime = new Date(item.createdAt).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });

    return (
      <View style={[styles.chatMessageContainer, isUser ? styles.userMessageContainer : styles.assistantMessageContainer]}>
        <View style={[styles.chatMessageBubble, isUser ? styles.userMessageBubble : styles.assistantMessageBubble]}>
          <Text style={[styles.chatMessageText, isUser ? styles.userMessageText : styles.assistantMessageText]}>
            {item.content}
          </Text>
          <Text style={[styles.chatMessageTime, isUser ? styles.userMessageTime : styles.assistantMessageTime]}>
            {messageTime}
          </Text>
        </View>
      </View>
    );
  };

  const dateDisplay = formatDateDisplay(selectedDate);
  const alternativeDateDisplay = formatAlternativeDate(selectedDate, alternativeCalendar);
  const isToday = formatDateLocal(selectedDate) === formatDateLocal(new Date());

  const allGoals = lifeAreas.flatMap(area => {
    const collectGoals = (node: LifeAreaNode): ActivatedGoal[] => {
      return [...node.goals, ...node.children.flatMap(collectGoals)];
    };
    return collectGoals(area);
  });

  const categoriesEnabled = userPreferences.reflectionCategoriesEnabled !== false;
  const availableCategories = userPreferences.reflectionCategories || ['Action', 'Speech', 'Thought'];

  const groupedReflections: Record<string, Reflection[]> = {};
  if (categoriesEnabled) {
    availableCategories.forEach(cat => {
      groupedReflections[cat] = reflections.filter(r => r.category === cat);
    });
    groupedReflections['Other'] = reflections.filter(r => !r.category || !availableCategories.includes(r.category));
  } else {
    groupedReflections['All'] = reflections;
  }

  const hasJournalContent = journalEntry && journalEntry.content && journalEntry.content.trim().length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Image 
              source={require('@/assets/images/Chesbon_app_Logo.png')} 
              style={styles.appLogo}
            />
            <Text style={styles.appName}>Cheshbon</Text>
          </View>
          
          <View style={styles.quickActionsRow}>
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={openChatModal}
            >
              <IconSymbol
                ios_icon_name="pencil"
                android_material_icon_name="edit"
                size={20}
                color={colors.background}
              />
              <Text style={styles.quickActionText}>Reflect</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={openAddReflectionModal}
            >
              <IconSymbol
                ios_icon_name="bolt.fill"
                android_material_icon_name="flash-on"
                size={20}
                color={colors.background}
              />
              <Text style={styles.quickActionText}>Express</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.dateNavigator}>
          <TouchableOpacity onPress={handlePreviousDay} style={styles.dateNavButton}>
            <IconSymbol
              ios_icon_name="chevron.left"
              android_material_icon_name="arrow-back"
              size={20}
              color={colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateDisplay}>
            <View style={styles.dateTextContainer}>
              <Text style={styles.dateText}>{dateDisplay}</Text>
              {alternativeDateDisplay && (
                <Text style={styles.alternativeDateText}>{alternativeDateDisplay}</Text>
              )}
            </View>
            {isToday && (
              <View style={styles.todayBadge}>
                <Text style={styles.todayBadgeText}>14</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleNextDay} style={styles.dateNavButton}>
            <IconSymbol
              ios_icon_name="chevron.right"
              android_material_icon_name="arrow-forward"
              size={20}
              color={colors.text}
            />
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DatePickerModal
            visible={showDatePicker}
            date={selectedDate}
            onConfirm={(date) => {
              setSelectedDate(date);
              setShowDatePicker(false);
            }}
            onCancel={() => setShowDatePicker(false)}
          />
        )}

        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          <TouchableOpacity 
            style={styles.journalCard}
            onPress={handleOpenJournalModal}
            activeOpacity={0.7}
          >
            <View style={styles.journalCardHeader}>
              <View style={styles.journalCardTitleRow}>
                <Image 
                  source={require('@/assets/images/Chesbon_app_Logo.png')} 
                  style={styles.journalAppIcon}
                />
                <Text style={styles.journalCardTitle}>Daily Journal</Text>
              </View>
            </View>
            
            {!hasJournalContent ? (
              <View style={styles.journalPlaceholder}>
                <Image 
                  source={require('@/assets/images/Chesbon_app_Logo.png')} 
                  style={styles.journalPlaceholderIcon}
                />
                <Text style={styles.journalPlaceholderText}>Tap to write about your day…</Text>
              </View>
            ) : (
              <View style={styles.journalPreviewContainer}>
                <Text style={styles.journalPreviewText} numberOfLines={3}>
                  {journalEntry.content.substring(0, 100)}{journalEntry.content.length > 100 ? '...' : ''}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.conciseSection}>
            <View style={styles.conciseSectionHeader}>
              <IconSymbol
                ios_icon_name="list.bullet"
                android_material_icon_name="list"
                size={20}
                color={colors.text}
              />
              <Text style={styles.conciseSectionTitle}>Concise</Text>
            </View>
            
            {allGoals.length === 0 ? (
              <View style={styles.emptyGoalsState}>
                <IconSymbol
                  ios_icon_name="target"
                  android_material_icon_name="flag"
                  size={64}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyGoalsTitle}>No Active Goals</Text>
                <Text style={styles.emptyGoalsText}>
                  Create your first goal to start tracking your progress
                </Text>
                <TouchableOpacity style={styles.createGoalButton} onPress={handleCreateGoal}>
                  <IconSymbol
                    ios_icon_name="plus.circle.fill"
                    android_material_icon_name="add-circle"
                    size={24}
                    color={colors.background}
                  />
                  <Text style={styles.createGoalButtonText}>Create Goal</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {lifeAreas.map(area => renderLifeAreaNode(area, 0))}
              </>
            )}
          </View>
        </ScrollView>
      </View>

      {/* AI Chat Modal */}
      <Modal
        visible={showChatModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeChatModal}
      >
        <SafeAreaView style={styles.chatModalContainer} edges={['top', 'bottom']}>
          <View style={styles.chatModalHeader}>
            <View style={styles.chatModalTitleRow}>
              <Image 
                source={require('@/assets/images/Chesbon_app_Logo.png')} 
                style={styles.chatModalIcon}
              />
              <Text style={styles.chatModalTitle}>AI Reflection Coach</Text>
            </View>
            <TouchableOpacity onPress={closeChatModal} style={styles.closeButton}>
              <IconSymbol
                ios_icon_name="xmark.circle.fill"
                android_material_icon_name="close"
                size={28}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderChatMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatMessagesContainer}
            showsVerticalScrollIndicator={false}
          />

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.chatInputContainer}
          >
            <View style={styles.chatInputRow}>
              <TouchableOpacity
                style={styles.voiceButton}
                onPress={isRecording ? stopRecording : startRecording}
                disabled={sendingMessage}
              >
                <IconSymbol
                  ios_icon_name={isRecording ? 'stop.circle.fill' : 'mic.circle.fill'}
                  android_material_icon_name={isRecording ? 'stop-circle' : 'mic'}
                  size={32}
                  color={isRecording ? colors.error : colors.primary}
                />
              </TouchableOpacity>

              <TextInput
                style={styles.chatInput}
                value={messageInput}
                onChangeText={setMessageInput}
                placeholder="Type your message..."
                placeholderTextColor={colors.textSecondary}
                multiline
                maxLength={500}
                editable={!sendingMessage}
              />

              <TouchableOpacity
                style={styles.sendButton}
                onPress={sendMessage}
                disabled={!messageInput.trim() || sendingMessage}
              >
                {sendingMessage ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <IconSymbol
                    ios_icon_name="arrow.up.circle.fill"
                    android_material_icon_name="send"
                    size={32}
                    color={messageInput.trim() ? colors.primary : colors.textSecondary}
                  />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Journal Modal */}
      <Modal
        visible={showJournalModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseJournalModal}
      >
        <SafeAreaView style={styles.journalModalContainer} edges={['top', 'bottom']}>
          <KeyboardAvoidingView 
            style={styles.journalModalContent}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.journalModalHeader}>
              <View style={styles.journalModalTitleRow}>
                <Image 
                  source={require('@/assets/images/Chesbon_app_Logo.png')} 
                  style={styles.journalModalIcon}
                />
                <Text style={styles.journalModalTitle}>Daily Journal</Text>
              </View>
              <TouchableOpacity onPress={handleCloseJournalModal} style={styles.closeButton}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={28}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.journalModalInput}
              value={tempJournalContent}
              onChangeText={setTempJournalContent}
              placeholder="Write your thoughts for today..."
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
              autoFocus
            />

            <TouchableOpacity
              style={styles.saveJournalButton}
              onPress={handleSaveJournal}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <React.Fragment>
                  <IconSymbol
                    ios_icon_name="checkmark.circle.fill"
                    android_material_icon_name="check-circle"
                    size={24}
                    color={colors.background}
                  />
                  <Text style={styles.saveJournalButtonText}>Save & Close</Text>
                </React.Fragment>
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Add Reflection Modal */}
      {showAddReflectionModal && (
        <AddReflectionModal
          visible={showAddReflectionModal}
          onClose={() => {
            setShowAddReflectionModal(false);
            setEditingReflection(null);
          }}
          onSave={handleReflectionSaved}
          selectedDate={selectedDate}
          goals={allGoals}
          currencies={currencies}
          userPreferences={userPreferences}
          editingReflection={editingReflection}
          gainsLosses={gainsLosses}
          strategies={strategies}
          prefilledGoalId={params.goalId as string | undefined}
          sourceScreen="express"
        />
      )}

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
          <View style={styles.successFlashModal}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={48}
              color={colors.success}
            />
            <Text style={styles.successFlashTitle}>{successMessage}</Text>
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
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.background,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  appLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  dateNavButton: {
    padding: 8,
  },
  dateDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  dateTextContainer: {
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  alternativeDateText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  todayBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  todayBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  journalCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  journalCardHeader: {
    marginBottom: 16,
  },
  journalCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  journalAppIcon: {
    width: 42,
    height: 42,
    borderRadius: 9,
  },
  journalCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  journalPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  journalPlaceholderIcon: {
    width: 72,
    height: 72,
    borderRadius: 15,
    opacity: 0.6,
  },
  journalPlaceholderText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  journalPreviewContainer: {
    gap: 8,
  },
  journalPreviewText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  conciseSection: {
    marginBottom: 24,
  },
  conciseSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  conciseSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  emptyGoalsState: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    marginTop: 20,
  },
  emptyGoalsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyGoalsText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  createGoalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createGoalButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.background,
  },
  lifeAreaContainer: {
    marginBottom: 12,
  },
  lifeAreaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: 14,
    borderRadius: 12,
  },
  lifeAreaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  lifeAreaIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifeAreaIconText: {
    fontSize: 16,
  },
  lifeAreaName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  lifeAreaBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lifeAreaBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.background,
  },
  lifeAreaContent: {
    marginTop: 8,
    gap: 8,
  },
  conciseGoalCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  conciseGoalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  conciseGoalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  editButton: {
    padding: 4,
  },
  conciseGoalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conciseActionButton: {
    padding: 4,
  },
  conciseGoalStats: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginHorizontal: 12,
  },
  chatModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  chatModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chatModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chatModalIcon: {
    width: 32,
    height: 32,
    borderRadius: 7,
  },
  chatModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  chatMessagesContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  chatMessageContainer: {
    marginBottom: 16,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  assistantMessageContainer: {
    alignItems: 'flex-start',
  },
  chatMessageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userMessageBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  assistantMessageBubble: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
  },
  chatMessageText: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  userMessageText: {
    color: colors.background,
  },
  assistantMessageText: {
    color: colors.text,
  },
  chatMessageTime: {
    fontSize: 11,
  },
  userMessageTime: {
    color: colors.background,
    opacity: 0.7,
  },
  assistantMessageTime: {
    color: colors.textSecondary,
  },
  chatInputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  voiceButton: {
    padding: 4,
  },
  chatInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    padding: 4,
  },
  journalModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  journalModalContent: {
    flex: 1,
    padding: 20,
  },
  journalModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  journalModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  journalModalIcon: {
    width: 24,
    height: 24,
    borderRadius: 5,
  },
  journalModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  journalModalInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  saveJournalButton: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveJournalButtonText: {
    color: colors.background,
    fontSize: 18,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    margin: 20,
    minWidth: 280,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  alertMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  alertButton: {
    backgroundColor: colors.primary,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  alertButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '600',
  },
  successFlashModal: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 32,
    margin: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  successFlashTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
});
