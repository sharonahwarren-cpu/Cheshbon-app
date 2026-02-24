
import React, { useState, useEffect, useRef } from 'react';
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
  Keyboard,
  Image,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { AddReflectionModal } from '@/components/AddReflectionModal';
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete, getBearerToken, BACKEND_URL } from '@/utils/api';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Speech from 'expo-speech';
import { AudioRecorder, AudioRecording, RecordingOptions } from 'expo-audio';

interface JournalEntry {
  id: string;
  content: string;
  entryDate: string;
  createdAt: string;
  updatedAt: string;
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
  strategyEffectiveness?: Array<{
    strategyId: string;
    worked: boolean;
  }>;
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ReflectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string; reflectionId?: string; openModal?: string; goalId?: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const journalInputRef = useRef<TextInput>(null);
  const chatScrollRef = useRef<FlatList>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const [journalEntry, setJournalEntry] = useState<JournalEntry | null>(null);
  const [journalContent, setJournalContent] = useState('');
  const [reflections, setReflections] = useState<Reflection[]>([]);

  const [showAddReflectionModal, setShowAddReflectionModal] = useState(false);
  const [editingReflection, setEditingReflection] = useState<Reflection | null>(null);
  const [prefilledGoalId, setPrefilledGoalId] = useState<string | undefined>(undefined);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({});
  const [gainsLosses, setGainsLosses] = useState<GainLoss[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [tempJournalContent, setTempJournalContent] = useState('');

  // AI Chat state
  const [showChatModal, setShowChatModal] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Voice state
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recording, setRecording] = useState<AudioRecording | null>(null);
  const [audioPermission, setAudioPermission] = useState(false);

  useEffect(() => {
    requestAudioPermissions();
    return () => {
      Speech.stop();
    };
  }, []);

  const requestAudioPermissions = async () => {
    console.log('[Voice] Requesting audio permissions...');
    try {
      const { granted } = await AudioRecorder.requestPermissionsAsync();
      setAudioPermission(granted);
      if (granted) {
        console.log('[Voice] Audio permissions granted');
      } else {
        console.log('[Voice] Audio permissions denied');
      }
    } catch (error) {
      console.error('[Voice] Error requesting audio permissions:', error);
    }
  };

  const speakText = async (text: string) => {
    console.log('[Voice] Speaking text:', text.substring(0, 80) + '...');
    await Speech.stop();
    setIsSpeaking(true);
    try {
      Speech.speak(text, {
        rate: 0.95,
        pitch: 1.0,
        onDone: () => {
          console.log('[Voice] Speech finished');
          setIsSpeaking(false);
        },
        onError: (error) => {
          console.error('[Voice] Speech error:', error);
          setIsSpeaking(false);
        },
        onStopped: () => {
          setIsSpeaking(false);
        },
      });
    } catch (error) {
      console.error('[Voice] Error speaking text:', error);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = async () => {
    console.log('[Voice] Stopping speech...');
    await Speech.stop();
    setIsSpeaking(false);
  };

  const startRecording = async () => {
    if (!audioPermission) {
      const { granted } = await AudioRecorder.requestPermissionsAsync();
      if (!granted) {
        showError('Microphone permission is required for voice input');
        return;
      }
      setAudioPermission(true);
    }

    await stopSpeaking();

    console.log('[Voice] Starting recording...');
    try {
      const recordingOptions: RecordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: 'mpeg4',
          audioEncoder: 'aac',
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: 'mpeg4aac',
          audioQuality: 'high',
          sampleRate: 44100,
          numberOfChannels: 1,
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
      const newRecording = await AudioRecorder.recordAsync(recordingOptions);
      setRecording(newRecording);
      setIsRecording(true);
      console.log('[Voice] Recording started');
    } catch (error) {
      console.error('[Voice] Failed to start recording:', error);
      showError('Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    console.log('[Voice] Stopping recording...');
    setIsRecording(false);
    
    try {
      const uri = await recording.stopAsync();
      console.log('[Voice] Recording stopped, URI:', uri);
      setRecording(null);
      
      if (uri) {
        await transcribeAndSend(uri);
      }
    } catch (error) {
      console.error('[Voice] Error stopping recording:', error);
      showError('Failed to process recording');
      setRecording(null);
    }
  };

  const transcribeAndSend = async (audioUri: string) => {
    console.log('[Voice] Transcribing audio...');
    setSendingMessage(true);
    
    try {
      const token = await getBearerToken();
      const formData = new FormData();
      const ext = audioUri.split('.').pop() || 'm4a';
      const mimeType = ext === 'webm' ? 'audio/webm' : ext === 'wav' ? 'audio/wav' : 'audio/m4a';

      formData.append('audio', {
        uri: audioUri,
        type: mimeType,
        name: `recording.${ext}`,
      } as any);

      const response = await fetch(`${BACKEND_URL}/api/cheshbon/transcribe`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        console.warn('[Voice] Transcription endpoint not available, status:', response.status);
        showError('Voice transcription is not available. Please type your message.');
        setSendingMessage(false);
        return;
      }

      const data = await response.json();
      const transcribedText = data.transcription || data.text || '';
      console.log('[Voice] Transcription result:', transcribedText);
      
      if (transcribedText.trim()) {
        await sendMessageWithText(transcribedText);
      } else {
        showError('Could not understand the audio. Please try again or type your message.');
        setSendingMessage(false);
      }
    } catch (error) {
      console.error('[Voice] Transcription error:', error);
      showError('Failed to transcribe audio. Please type your message instead.');
      setSendingMessage(false);
    }
  };

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
      console.log('[Reflect] openModal parameter detected, opening AddReflectionModal');
      if (params.goalId) {
        console.log('[Reflect] Pre-filling with goalId:', params.goalId);
        setPrefilledGoalId(params.goalId);
      }
      setTimeout(() => {
        setShowAddReflectionModal(true);
      }, 500);
    }
  }, [params.openModal, params.goalId]);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  useEffect(() => {
    if (params.reflectionId && reflections.length > 0) {
      const reflection = reflections.find(r => r.id === params.reflectionId);
      if (reflection) {
        console.log('Opening reflection from history:', reflection.id);
        openEditReflectionModal(reflection);
      }
    }
  }, [params.reflectionId, reflections]);

  useEffect(() => {
    if (showSuccessModal) {
      const timer = setTimeout(() => {
        setShowSuccessModal(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessModal]);

  const loadData = async () => {
    const dateString = formatDateLocal(selectedDate);
    console.log('Loading reflect data for date (local):', dateString);
    setLoading(true);
    try {
      const [journalRes, reflectionsRes, goalsRes, currenciesRes, prefsRes, gainsLossesRes, strategiesRes] = await Promise.all([
        authenticatedGet(`/api/journals/by-date?date=${dateString}`),
        authenticatedGet(`/api/reflections/by-date?date=${dateString}`),
        authenticatedGet('/api/goals'),
        authenticatedGet('/api/currencies'),
        authenticatedGet('/api/user-preferences'),
        authenticatedGet('/api/gains-losses'),
        authenticatedGet('/api/strategies'),
      ]);

      const journalData = journalRes?.data || journalRes || null;
      const reflectionsData = Array.isArray(reflectionsRes) ? reflectionsRes : (reflectionsRes?.data || []);
      const goalsData = Array.isArray(goalsRes) ? goalsRes : (goalsRes?.data || []);
      const currenciesData = Array.isArray(currenciesRes) ? currenciesRes : (currenciesRes?.data || []);
      const prefsData = prefsRes?.data || prefsRes || {};
      const gainsLossesData = Array.isArray(gainsLossesRes) ? gainsLossesRes : (gainsLossesRes?.data || []);
      const strategiesData = Array.isArray(strategiesRes) ? strategiesRes : (strategiesRes?.data || []);

      setJournalEntry(journalData);
      setJournalContent(journalData?.content || '');
      setReflections(reflectionsData);
      setGoals(goalsData);
      setCurrencies(currenciesData);
      setUserPreferences(prefsData);
      setGainsLosses(gainsLossesData);
      setStrategies(strategiesData);

      console.log('Reflect data loaded successfully');
    } catch (error) {
      console.error('Error loading reflect data:', error);
      showError('Failed to load reflect data');
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async () => {
    console.log('[API] Requesting /api/reflection-chat/conversations...');
    setLoadingConversations(true);
    try {
      const response = await authenticatedGet('/api/reflection-chat/conversations');
      const conversationsData = Array.isArray(response) ? response : (response?.data || []);
      setConversations(conversationsData);
      console.log('Loaded conversations:', conversationsData.length);
    } catch (error) {
      console.error('Error loading conversations:', error);
      showError('Failed to load conversations');
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    console.log(`[API] Requesting /api/reflection-chat/conversations/${conversationId}/messages...`);
    try {
      const response = await authenticatedGet(`/api/reflection-chat/conversations/${conversationId}/messages`);
      const messagesData = Array.isArray(response) ? response : (response?.data || []);
      setMessages(messagesData);
      console.log('Loaded messages:', messagesData.length);
      
      // Scroll to bottom after loading messages
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
      showError('Failed to load messages');
    }
  };

  const startNewConversation = async () => {
    console.log('[API] Requesting POST /api/reflection-chat/conversations...');
    try {
      const response = await authenticatedPost('/api/reflection-chat/conversations', {});
      const newConversation = response?.data || response;
      
      setCurrentConversationId(newConversation.id);
      setMessages([]);
      setConversations(prev => [newConversation, ...prev]);
      
      console.log('New conversation created:', newConversation.id);

      // Trigger AI to initiate the conversation with a greeting
      setSendingMessage(true);
      try {
        console.log('[API] Requesting AI greeting for new conversation...');
        const greetingResponse = await authenticatedPost(
          `/api/reflection-chat/conversations/${newConversation.id}/messages`,
          { message: 'Please start our session by greeting me warmly and asking how my day has been. Keep it short and conversational, like a friendly life coach checking in.' }
        );
        const aiGreeting = greetingResponse?.data || greetingResponse;
        
        if (aiGreeting && aiGreeting.content) {
          const greetingMsg: ChatMessage = {
            id: aiGreeting.id || 'greeting-' + Date.now(),
            role: 'assistant',
            content: aiGreeting.content,
            createdAt: aiGreeting.createdAt || new Date().toISOString(),
          };
          setMessages([greetingMsg]);
          
          // Speak the greeting
          await speakText(greetingMsg.content);
          console.log('[Voice] AI greeting spoken');
        }
      } catch (greetingError: any) {
        console.error('[Voice] Error getting AI greeting:', greetingError);
        // Show user-friendly error message
        const errorMsg = greetingError?.message || String(greetingError);
        if (errorMsg.includes('API key') || errorMsg.includes('service')) {
          showError('AI service is temporarily unavailable. The administrator needs to configure the API key. Please try again later.');
        } else {
          showError('Failed to start AI conversation. Please try again.');
        }
        // Close the conversation since it failed
        setCurrentConversationId(null);
        setMessages([]);
      } finally {
        setSendingMessage(false);
      }

      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error('Error creating conversation:', error);
      const errorMsg = error?.message || String(error);
      if (errorMsg.includes('API key') || errorMsg.includes('service')) {
        showError('AI service is temporarily unavailable. The administrator needs to configure the API key. Please try again later.');
      } else {
        showError('Failed to create conversation. Please try again.');
      }
      setSendingMessage(false);
    }
  };

  const sendMessageWithText = async (text: string) => {
    const trimmedMessage = text.trim();
    if (!trimmedMessage || !currentConversationId) {
      console.log('Cannot send empty message or no conversation selected');
      return;
    }

    const isInitTrigger = trimmedMessage.startsWith('Please start our session by greeting me warmly');

    console.log('Sending message to AI:', isInitTrigger ? '[INIT]' : trimmedMessage);
    setSendingMessage(true);

    const tempUserMessage: ChatMessage | null = isInitTrigger ? null : {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: trimmedMessage,
      createdAt: new Date().toISOString(),
    };

    if (tempUserMessage) {
      setMessages(prev => [...prev, tempUserMessage]);
      setMessageInput('');
    }

    setTimeout(() => {
      chatScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      console.log(`[API] Requesting POST /api/reflection-chat/conversations/${currentConversationId}/messages...`);
      const response = await authenticatedPost(
        `/api/reflection-chat/conversations/${currentConversationId}/messages`,
        { message: trimmedMessage }
      );
      
      const aiMessage = response?.data || response;
      
      if (isInitTrigger) {
        if (aiMessage && aiMessage.content) {
          const greetingMsg: ChatMessage = {
            id: aiMessage.id || 'greeting-' + Date.now(),
            role: 'assistant',
            content: aiMessage.content,
            createdAt: aiMessage.createdAt || new Date().toISOString(),
          };
          setMessages([greetingMsg]);
          await speakText(greetingMsg.content);
        }
      } else {
        setMessages(prev => {
          const withoutTemp = prev.filter(m => m.id !== tempUserMessage?.id);
          const updatedUserMessage = tempUserMessage ? { 
            ...tempUserMessage, 
            id: aiMessage.userMessageId || tempUserMessage.id 
          } : null;
          return updatedUserMessage 
            ? [...withoutTemp, updatedUserMessage, aiMessage]
            : [...withoutTemp, aiMessage];
        });

        // Speak the AI response
        if (aiMessage && aiMessage.content) {
          await speakText(aiMessage.content);
        }
      }

      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);

      console.log('AI response received and spoken');
    } catch (error) {
      console.error('Error sending message:', error);
      showError('Failed to send message');
      if (tempUserMessage) {
        setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
        setMessageInput(trimmedMessage);
      }
    } finally {
      setSendingMessage(false);
    }
  };

  const sendMessage = async () => {
    await sendMessageWithText(messageInput);
  };

  const deleteConversation = async (conversationId: string) => {
    console.log(`[API] Requesting DELETE /api/reflection-chat/conversations/${conversationId}...`);
    try {
      await authenticatedDelete(`/api/reflection-chat/conversations/${conversationId}`);
      
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      
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
    console.log('[Voice] Opening AI chat modal');
    setShowChatModal(true);
    await loadConversations();
  };

  const closeChatModal = () => {
    console.log('Closing AI chat modal');
    setShowChatModal(false);
    setCurrentConversationId(null);
    setMessages([]);
    setMessageInput('');
    stopSpeaking();
  };

  const selectConversation = async (conversationId: string) => {
    console.log('Selecting conversation:', conversationId);
    setCurrentConversationId(conversationId);
    await loadMessages(conversationId);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessModal(true);
  };

  const handleOpenJournalModal = () => {
    console.log('Opening journal modal');
    setTempJournalContent(journalContent);
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
        setJournalContent('');
        showSuccess('Journal entry deleted');
      } else if (savedEntry) {
        console.log('Journal entry saved');
        setJournalEntry(savedEntry);
        setJournalContent(tempJournalContent);
        showSuccess('Journal saved successfully');
      } else {
        console.log('No journal entry (content was empty and no existing entry)');
        setJournalEntry(null);
        setJournalContent('');
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
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
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
    setPrefilledGoalId(undefined);
    setShowAddReflectionModal(true);
  };

  const openEditReflectionModal = (reflection: Reflection) => {
    setEditingReflection(reflection);
    setPrefilledGoalId(undefined);
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
    loadData();
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const getCategoryIcon = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower === 'action') return { ios: 'figure.walk', android: 'directions-run' };
    if (categoryLower === 'speech') return { ios: 'bubble.left.fill', android: 'chat-bubble' };
    if (categoryLower === 'thought') return { ios: 'cloud.fill', android: 'cloud' };
    if (categoryLower === 'feeling') return { ios: 'heart.fill', android: 'favorite' };
    return { ios: 'sparkles', android: 'auto-awesome' };
  };

  const renderChatMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';
    const messageTime = new Date(item.createdAt).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });

    return (
      <View style={[styles.messageContainer, isUser ? styles.userMessageContainer : styles.aiMessageContainer]}>
        <View style={[styles.messageBubble, isUser ? styles.userMessageBubble : styles.aiMessageBubble]}>
          {isUser ? (
            <Text style={styles.userMessageText}>{item.content}</Text>
          ) : (
            <View>
              <Text style={styles.aiMessageText}>{item.content}</Text>
              <TouchableOpacity 
                style={styles.speakAgainButton}
                onPress={() => isSpeaking ? stopSpeaking() : speakText(item.content)}
              >
                <IconSymbol
                  ios_icon_name={isSpeaking ? "stop.circle.fill" : "speaker.wave.2.fill"}
                  android_material_icon_name={isSpeaking ? "stop" : "volume-up"}
                  size={16}
                  color={colors.primary}
                />
                <Text style={styles.speakAgainText}>
                  {isSpeaking ? 'Stop speaking' : 'Speak again'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <Text style={[styles.messageTime, isUser ? styles.userMessageTime : styles.aiMessageTime]}>
            {messageTime}
          </Text>
        </View>
      </View>
    );
  };

  const dateDisplay = formatDate(selectedDate);

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

  const hasJournalContent = journalContent && journalContent.trim().length > 0;
  const journalPreview = hasJournalContent ? journalContent.substring(0, 100) + (journalContent.length > 100 ? '...' : '') : '';

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
              size={20}
              color={colors.text}
            />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateDisplay}>
            <Text style={styles.dateText}>{dateDisplay}</Text>
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
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="inline"
            onChange={handleDateChange}
          />
        )}

        <ScrollView 
          ref={scrollViewRef}
          style={styles.content} 
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* AI Chat Card */}
          <TouchableOpacity 
            style={styles.aiChatCard}
            onPress={openChatModal}
            activeOpacity={0.7}
          >
            <View style={styles.aiChatHeader}>
              <View style={styles.aiChatIconContainer}>
                <IconSymbol
                  ios_icon_name="brain.head.profile"
                  android_material_icon_name="psychology"
                  size={32}
                  color="#9B59B6"
                />
              </View>
              <View style={styles.aiChatTextContainer}>
                <Text style={styles.aiChatTitle}>AI Reflection Coach</Text>
                <Text style={styles.aiChatSubtitle}>
                  Chat about your goals, successes, and growth
                </Text>
              </View>
              <IconSymbol
                ios_icon_name="chevron.right"
                android_material_icon_name="arrow-forward"
                size={20}
                color={colors.textSecondary}
              />
            </View>
          </TouchableOpacity>

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
                  {journalPreview}
                </Text>
                {journalEntry && (
                  <Text style={styles.journalTimestamp}>
                    Last saved: {new Date(journalEntry.updatedAt).toLocaleString()}
                  </Text>
                )}
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderRow}>
                <IconSymbol
                  ios_icon_name="sparkles"
                  android_material_icon_name="auto-awesome"
                  size={22}
                  color="#9B59B6"
                />
                <Text style={styles.sectionTitle}>Reflections</Text>
              </View>
              <TouchableOpacity onPress={openAddReflectionModal} style={styles.addButton}>
                <IconSymbol
                  ios_icon_name="plus.circle.fill"
                  android_material_icon_name="add-circle"
                  size={28}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>

            {reflections.length === 0 ? (
              <View style={styles.emptyState}>
                <IconSymbol
                  ios_icon_name="sparkles"
                  android_material_icon_name="auto-awesome"
                  size={48}
                  color={colors.textSecondary}
                />
                <Text style={styles.emptyStateText}>
                  No reflections for this day. Tap + to add one.
                </Text>
              </View>
            ) : (
              Object.entries(groupedReflections).map(([category, categoryReflections], catIndex) => {
                if (categoryReflections.length === 0) return null;
                
                const categoryIcon = getCategoryIcon(category);
                const isCollapsed = collapsedCategories[category];
                
                return (
                  <React.Fragment key={catIndex}>
                    {categoriesEnabled && category !== 'All' && (
                      <TouchableOpacity 
                        style={styles.categoryHeader}
                        onPress={() => toggleCategory(category)}
                      >
                        <IconSymbol
                          ios_icon_name={isCollapsed ? 'chevron.right' : 'chevron.down'}
                          android_material_icon_name={isCollapsed ? 'arrow-forward' : 'arrow-downward'}
                          size={20}
                          color={colors.text}
                        />
                        <IconSymbol
                          ios_icon_name={categoryIcon.ios}
                          android_material_icon_name={categoryIcon.android}
                          size={20}
                          color={colors.primary}
                        />
                        <Text style={styles.categoryTitle}>{category}</Text>
                        <View style={styles.categoryBadge}>
                          <Text style={styles.categoryBadgeText}>{categoryReflections.length}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    
                    {!isCollapsed && categoryReflections.map((reflection, index) => {
                      const typeText = reflection.type;
                      const outcomeText = reflection.outcome ? 
                        (reflection.outcome === 'success' ? 'Success' : 'Struggled') : 
                        null;
                      
                      return (
                        <React.Fragment key={index}>
                          <View style={styles.reflectionCard}>
                            <View style={styles.reflectionHeader}>
                              <View style={styles.reflectionBadges}>
                                <View style={[styles.badge, reflection.type === 'Proactive' ? styles.badgeProactive : styles.badgeRestraint]}>
                                  <Text style={styles.badgeText}>{typeText}</Text>
                                </View>
                                {reflection.outcome && (
                                  <View style={[styles.badge, reflection.outcome === 'success' ? styles.badgeSuccess : styles.badgeStruggle]}>
                                    <Text style={styles.badgeText}>{outcomeText}</Text>
                                  </View>
                                )}
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
                              <View style={styles.linkedGoalSection}>
                                <View style={styles.linkedGoalHeader}>
                                  <IconSymbol
                                    ios_icon_name="target"
                                    android_material_icon_name="flag"
                                    size={16}
                                    color={colors.primary}
                                  />
                                  <Text style={styles.linkedGoalLabel}>Linked Goal</Text>
                                </View>
                                <Text style={styles.linkedGoalTitle}>
                                  {reflection.linkedGoalTitle || goals.find(g => g.id === reflection.linkedGoalId)?.title || 'Unknown Goal'}
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

                            {(reflection.gainedIds && reflection.gainedIds.length > 0) && (
                              <View style={styles.gainsLossesSection}>
                                <View style={styles.gainsLossesHeader}>
                                  <IconSymbol
                                    ios_icon_name="arrow.up.circle.fill"
                                    android_material_icon_name="trending-up"
                                    size={16}
                                    color={colors.success}
                                  />
                                  <Text style={styles.gainsLossesTitle}>Gained</Text>
                                </View>
                                <View style={styles.gainsLossesList}>
                                  {reflection.gainedIds.map((gainId, idx) => {
                                    const gain = gainsLosses.find(gl => gl.id === gainId);
                                    const gainName = gain?.name || 'Unknown';
                                    return gain ? (
                                      <View key={idx} style={styles.gainLossBadge}>
                                        <Text style={styles.gainLossBadgeText}>{gainName}</Text>
                                      </View>
                                    ) : null;
                                  })}
                                </View>
                              </View>
                            )}

                            {(reflection.lostIds && reflection.lostIds.length > 0) && (
                              <View style={styles.gainsLossesSection}>
                                <View style={styles.gainsLossesHeader}>
                                  <IconSymbol
                                    ios_icon_name="arrow.down.circle.fill"
                                    android_material_icon_name="trending-down"
                                    size={16}
                                    color={colors.error}
                                  />
                                  <Text style={styles.gainsLossesTitle}>Lost</Text>
                                </View>
                                <View style={styles.gainsLossesList}>
                                  {reflection.lostIds.map((lossId, idx) => {
                                    const loss = gainsLosses.find(gl => gl.id === lossId);
                                    const lossName = loss?.name || 'Unknown';
                                    return loss ? (
                                      <View key={idx} style={[styles.gainLossBadge, styles.lossBadge]}>
                                        <Text style={styles.gainLossBadgeText}>{lossName}</Text>
                                      </View>
                                    ) : null;
                                  })}
                                </View>
                              </View>
                            )}

                            {reflection.wasWorthIt !== undefined && (
                              <View style={styles.worthItSection}>
                                <IconSymbol
                                  ios_icon_name={reflection.wasWorthIt ? "checkmark.circle.fill" : "xmark.circle.fill"}
                                  android_material_icon_name={reflection.wasWorthIt ? "check-circle" : "cancel"}
                                  size={16}
                                  color={reflection.wasWorthIt ? colors.success : colors.error}
                                />
                                <Text style={[styles.worthItValue, reflection.wasWorthIt ? styles.worthItYes : styles.worthItNo]}>
                                  {reflection.wasWorthIt ? 'Worth it' : 'Not worth it'}
                                </Text>
                              </View>
                            )}

                            {reflection.additionalThoughts && (
                              <View style={styles.additionalThoughtsSection}>
                                <Text style={styles.additionalThoughtsLabel}>Notes on weighing up gains and losses</Text>
                                <Text style={styles.additionalThoughtsText}>{reflection.additionalThoughts}</Text>
                              </View>
                            )}

                            {(reflection.strategyEffectiveness && reflection.strategyEffectiveness.length > 0) && (
                              <View style={styles.strategiesSection}>
                                <View style={styles.strategiesHeader}>
                                  <IconSymbol
                                    ios_icon_name="lightbulb.fill"
                                    android_material_icon_name="lightbulb"
                                    size={16}
                                    color={colors.primary}
                                  />
                                  <Text style={styles.strategiesTitle}>Strategies</Text>
                                </View>
                                <View style={styles.strategiesList}>
                                  {reflection.strategyEffectiveness.map((se, idx) => {
                                    const strategy = strategies.find(s => s.id === se.strategyId);
                                    const strategyName = strategy?.name || 'Unknown Strategy';
                                    
                                    return (
                                      <View key={idx} style={styles.strategyBadge}>
                                        <Text style={styles.strategyBadgeText}>{strategyName}</Text>
                                        <View style={[styles.strategyStatusDot, se.worked ? styles.strategyWorkedDot : styles.strategyDidntWorkDot]} />
                                      </View>
                                    );
                                  })}
                                </View>
                              </View>
                            )}
                          </View>
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })
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
            <TouchableOpacity onPress={closeChatModal} style={styles.chatBackButton}>
              <IconSymbol
                ios_icon_name="chevron.left"
                android_material_icon_name="arrow-back"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
            <View style={styles.chatModalTitleContainer}>
              <IconSymbol
                ios_icon_name="brain.head.profile"
                android_material_icon_name="psychology"
                size={24}
                color="#9B59B6"
              />
              <Text style={styles.chatModalTitle}>AI Reflection Coach</Text>
            </View>
            <TouchableOpacity onPress={startNewConversation} style={styles.newChatButton}>
              <IconSymbol
                ios_icon_name="plus.circle.fill"
                android_material_icon_name="add-circle"
                size={28}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

          {!currentConversationId ? (
            <View style={styles.conversationsListContainer}>
              {loadingConversations ? (
                <ActivityIndicator size="large" color={colors.primary} style={styles.loadingIndicator} />
              ) : conversations.length === 0 ? (
                <View style={styles.emptyConversationsState}>
                  <IconSymbol
                    ios_icon_name="brain.head.profile"
                    android_material_icon_name="psychology"
                    size={64}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.emptyConversationsTitle}>Start Your First Conversation</Text>
                  <Text style={styles.emptyConversationsText}>
                    Chat with your AI reflection coach about your goals, successes, and personal growth journey.
                  </Text>
                  <TouchableOpacity style={styles.startChatButton} onPress={startNewConversation}>
                    <IconSymbol
                      ios_icon_name="plus.circle.fill"
                      android_material_icon_name="add-circle"
                      size={24}
                      color={colors.background}
                    />
                    <Text style={styles.startChatButtonText}>Start Conversation</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView style={styles.conversationsList} contentContainerStyle={styles.conversationsListContent}>
                  {conversations.map((conversation, index) => {
                    const conversationDate = new Date(conversation.updatedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    });
                    const conversationTime = new Date(conversation.updatedAt).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit'
                    });

                    return (
                      <React.Fragment key={index}>
                        <TouchableOpacity
                          style={styles.conversationItem}
                          onPress={() => selectConversation(conversation.id)}
                        >
                          <View style={styles.conversationIconContainer}>
                            <IconSymbol
                              ios_icon_name="bubble.left.and.bubble.right.fill"
                              android_material_icon_name="chat"
                              size={24}
                              color={colors.primary}
                            />
                          </View>
                          <View style={styles.conversationInfo}>
                            <Text style={styles.conversationTitle} numberOfLines={1}>
                              {conversation.title || 'Reflection Chat'}
                            </Text>
                            <Text style={styles.conversationMeta}>
                              {conversation.messageCount} messages • {conversationDate} at {conversationTime}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.deleteConversationButton}
                            onPress={() => deleteConversation(conversation.id)}
                          >
                            <IconSymbol
                              ios_icon_name="trash"
                              android_material_icon_name="delete"
                              size={20}
                              color={colors.error}
                            />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      </React.Fragment>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          ) : (
            <KeyboardAvoidingView 
              style={styles.chatContainer}
              behavior="padding"
              keyboardVerticalOffset={90}
            >
              <FlatList
                ref={chatScrollRef}
                data={messages}
                renderItem={renderChatMessage}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.messagesContainer}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.emptyChatState}>
                    {sendingMessage ? (
                      <>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.emptyChatText}>
                          Cheshbon is preparing your session...
                        </Text>
                      </>
                    ) : (
                      <>
                        <IconSymbol
                          ios_icon_name="microphone.fill"
                          android_material_icon_name="mic"
                          size={48}
                          color={colors.textSecondary}
                        />
                        <Text style={styles.emptyChatText}>
                          Cheshbon will greet you shortly. Tap the mic to speak or type below.
                        </Text>
                      </>
                    )}
                  </View>
                }
              />

              <View style={styles.chatInputContainer}>
                <TextInput
                  style={styles.chatInput}
                  value={messageInput}
                  onChangeText={setMessageInput}
                  placeholder="Type or speak your message..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  maxLength={1000}
                  editable={!sendingMessage && !isRecording}
                />

                <TouchableOpacity
                  style={[styles.voiceButton, isRecording && styles.voiceButtonActive]}
                  onPress={isRecording ? stopRecording : startRecording}
                  disabled={sendingMessage}
                >
                  <IconSymbol
                    ios_icon_name={isRecording ? "stop.circle.fill" : "microphone.fill"}
                    android_material_icon_name={isRecording ? "stop" : "mic"}
                    size={24}
                    color={colors.background}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.sendButton, (!messageInput.trim() || sendingMessage || isRecording) && styles.sendButtonDisabled]}
                  onPress={sendMessage}
                  disabled={!messageInput.trim() || sendingMessage || isRecording}
                >
                  {sendingMessage ? (
                    <ActivityIndicator size="small" color={colors.background} />
                  ) : (
                    <IconSymbol
                      ios_icon_name="arrow.up.circle.fill"
                      android_material_icon_name="send"
                      size={32}
                      color={colors.background}
                    />
                  )}
                </TouchableOpacity>
              </View>

              {isSpeaking && (
                <View style={styles.speakingIndicator}>
                  <IconSymbol
                    ios_icon_name="speaker.wave.2.fill"
                    android_material_icon_name="volume-up"
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={styles.speakingText}>Cheshbon is speaking...</Text>
                  <TouchableOpacity onPress={stopSpeaking} style={styles.stopSpeakingButton}>
                    <Text style={styles.stopSpeakingText}>Stop</Text>
                  </TouchableOpacity>
                </View>
              )}
            </KeyboardAvoidingView>
          )}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showJournalModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseJournalModal}
      >
        <SafeAreaView style={styles.journalModalContainer} edges={['top', 'bottom']}>
          <KeyboardAvoidingView 
            style={styles.journalModalContent}
            behavior="padding"
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

      {showAddReflectionModal && (
        <AddReflectionModal
          visible={showAddReflectionModal}
          onClose={() => {
            setShowAddReflectionModal(false);
            setPrefilledGoalId(undefined);
          }}
          onSave={handleReflectionSaved}
          selectedDate={selectedDate}
          goals={goals}
          currencies={currencies}
          userPreferences={userPreferences}
          editingReflection={editingReflection}
          gainsLosses={gainsLosses}
          strategies={strategies}
          prefilledGoalId={prefilledGoalId}
          sourceScreen="reflect"
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
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.card,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  dateNavButton: {
    padding: 8,
  },
  dateDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  aiChatCard: {
    backgroundColor: '#9B59B6',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#9B59B6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  aiChatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  aiChatIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiChatTextContainer: {
    flex: 1,
  },
  aiChatTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  aiChatSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
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
  journalTimestamp: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  addButton: {
    padding: 4,
  },
  emptyState: {
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.background,
  },
  reflectionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  reflectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reflectionBadges: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeProactive: {
    backgroundColor: colors.primary + '20',
  },
  badgeRestraint: {
    backgroundColor: colors.secondary + '20',
  },
  badgeSuccess: {
    backgroundColor: colors.success + '20',
  },
  badgeStruggle: {
    backgroundColor: colors.error + '20',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
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
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
    lineHeight: 22,
  },
  linkedGoalSection: {
    backgroundColor: colors.primary + '10',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  linkedGoalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  linkedGoalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  linkedGoalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  currencyChange: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  currencyChangeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.success,
  },
  gainsLossesSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  gainsLossesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  gainsLossesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  gainsLossesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  gainLossBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lossBadge: {
    backgroundColor: colors.error + '20',
  },
  gainLossBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  worthItSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  worthItValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  worthItYes: {
    color: colors.success,
  },
  worthItNo: {
    color: colors.error,
  },
  additionalThoughtsSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  additionalThoughtsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  additionalThoughtsText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  strategiesSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  strategiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  strategiesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  strategiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  strategyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary + '10',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  strategyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  strategyStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  strategyWorkedDot: {
    backgroundColor: colors.success,
  },
  strategyDidntWorkDot: {
    backgroundColor: colors.error,
  },
  chatModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  chatModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chatBackButton: {
    padding: 4,
  },
  chatModalTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  chatModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  newChatButton: {
    padding: 4,
  },
  conversationsListContainer: {
    flex: 1,
  },
  loadingIndicator: {
    marginTop: 40,
  },
  emptyConversationsState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyConversationsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyConversationsText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  startChatButton: {
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
  startChatButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.background,
  },
  conversationsList: {
    flex: 1,
  },
  conversationsListContent: {
    padding: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colors.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  conversationIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationInfo: {
    flex: 1,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  conversationMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  deleteConversationButton: {
    padding: 8,
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
    flexGrow: 1,
  },
  emptyChatState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyChatText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userMessageBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  aiMessageBubble: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userMessageText: {
    fontSize: 15,
    color: colors.background,
    lineHeight: 22,
  },
  aiMessageText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  userMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  aiMessageTime: {
    color: colors.textSecondary,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  chatInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButtonActive: {
    backgroundColor: colors.error,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  speakAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
  },
  speakAgainText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  speakingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primary + '20',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  speakingText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    flex: 1,
  },
  stopSpeakingButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  stopSpeakingText: {
    fontSize: 12,
    color: colors.background,
    fontWeight: '600',
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
  closeButton: {
    padding: 4,
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
    padding: 24,
    margin: 20,
    minWidth: 280,
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
