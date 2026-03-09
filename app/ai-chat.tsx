
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import * as supabaseApi from '@/utils/supabaseApi';
import * as Speech from 'expo-speech';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  isTranscribed?: boolean;
}

interface Conversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VoiceSettings {
  voice: string;
  rate: number;
  pitch: number;
}

interface HealthStatus {
  status: string;
  features: {
    aiChat: boolean;
    voiceTranscription: boolean;
  };
}

const AVAILABLE_VOICES: { id: string; name: string; language: string }[] = [
  { id: 'default', name: 'Default', language: 'en-US' },
  { id: 'en-GB', name: 'British English', language: 'en-GB' },
  { id: 'en-AU', name: 'Australian English', language: 'en-AU' },
  { id: 'en-IN', name: 'Indian English', language: 'en-IN' },
];

const VOICE_SETTINGS_KEY = '@ai_voice_settings';
const CONTINUOUS_MODE_KEY = '@ai_continuous_mode';

export default function AIChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showConversations, setShowConversations] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);

  // Health check state
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [showConfigWarning, setShowConfigWarning] = useState(false);

  // Voice settings
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    voice: 'default',
    rate: 0.95,
    pitch: 1.0,
  });
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);

  // Continuous listening mode
  const [continuousMode, setContinuousMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const continuousModeTimeout = useRef<NodeJS.Timeout | null>(null);

  // Pulse animation for recording button
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    console.log('[AI Chat] Screen mounted, checking health and loading data...');
    checkHealth();
    loadConversations();
    loadVoiceSettings();
    loadContinuousMode();
    return () => {
      Speech.stop();
      if (pulseLoop.current) pulseLoop.current.stop();
      if (continuousModeTimeout.current) clearTimeout(continuousModeTimeout.current);
    };
  }, []);

  // Check backend health to see if AI features are available
  const checkHealth = async () => {
    try {
      console.log('[AI Chat] Checking backend health...');
      const { data: health, error } = await supabaseApi.getHealthStatus();
      if (error) throw error;
      console.log('[AI Chat] Health status:', health);
      setHealthStatus(health);
      
      // Show warning if AI features are not available
      if (!health.features.aiChat || !health.features.voiceTranscription) {
        setShowConfigWarning(true);
      }
    } catch (error) {
      console.error('[AI Chat] Health check failed:', error);
      // If health endpoint doesn't exist yet, assume features are unavailable
      setShowConfigWarning(true);
    }
  };

  // Track if we just created a new conversation (to avoid reloading messages)
  const justCreatedConversation = useRef<string | null>(null);

  useEffect(() => {
    if (currentConversationId) {
      // If we just created this conversation, messages are already set from the response
      if (justCreatedConversation.current === currentConversationId) {
        justCreatedConversation.current = null;
        return;
      }
      loadMessages(currentConversationId);
    }
  }, [currentConversationId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  useEffect(() => {
    if (isRecording) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.current.start();
    } else {
      if (pulseLoop.current) pulseLoop.current.stop();
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  // Load voice settings from storage
  const loadVoiceSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(VOICE_SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored);
        setVoiceSettings(settings);
        console.log('[Voice Settings] Loaded:', settings);
      }
    } catch (err) {
      console.error('[Voice Settings] Failed to load:', err);
    }
  };

  // Save voice settings to storage
  const saveVoiceSettings = async (settings: VoiceSettings) => {
    try {
      await AsyncStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(settings));
      setVoiceSettings(settings);
      console.log('[Voice Settings] Saved:', settings);
    } catch (err) {
      console.error('[Voice Settings] Failed to save:', err);
    }
  };

  // Load continuous mode setting
  const loadContinuousMode = async () => {
    try {
      const stored = await AsyncStorage.getItem(CONTINUOUS_MODE_KEY);
      if (stored) {
        const enabled = JSON.parse(stored);
        setContinuousMode(enabled);
        console.log('[Continuous Mode] Loaded:', enabled);
      }
    } catch (err) {
      console.error('[Continuous Mode] Failed to load:', err);
    }
  };

  // Save continuous mode setting
  const saveContinuousMode = async (enabled: boolean) => {
    try {
      await AsyncStorage.setItem(CONTINUOUS_MODE_KEY, JSON.stringify(enabled));
      setContinuousMode(enabled);
      console.log('[Continuous Mode] Saved:', enabled);
    } catch (err) {
      console.error('[Continuous Mode] Failed to save:', err);
    }
  };

  const speakText = useCallback(async (text: string) => {
    if (!autoSpeak) return;
    try {
      await Speech.stop();
      setIsSpeaking(true);
      
      const selectedVoice = AVAILABLE_VOICES.find(v => v.id === voiceSettings.voice);
      const language = selectedVoice?.language || 'en-US';

      console.log('[Voice] Speaking with settings:', { language, rate: voiceSettings.rate, pitch: voiceSettings.pitch });

      Speech.speak(text, {
        language,
        pitch: voiceSettings.pitch,
        rate: voiceSettings.rate,
        onDone: () => {
          setIsSpeaking(false);
          // If continuous mode is enabled, start listening again after AI finishes speaking
          if (continuousMode && inputMode === 'voice') {
            console.log('[Continuous Mode] AI finished speaking, starting to listen...');
            setTimeout(() => {
              startContinuousListening();
            }, 500);
          }
        },
        onError: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
      });
    } catch (err) {
      console.error('[Voice] Speech error:', err);
      setIsSpeaking(false);
    }
  }, [autoSpeak, voiceSettings, continuousMode, inputMode]);

  const stopSpeaking = async () => {
    try {
      await Speech.stop();
      setIsSpeaking(false);
    } catch (err) {
      console.error('[Voice] Stop speech error:', err);
    }
  };

  const loadConversations = async () => {
    console.log('[AI Chat] Loading conversations...');
    try {
      setLoading(true);
      const { data: conversationsData, error } = await supabaseApi.getConversations();
      if (error) throw error;
      console.log('[AI Chat] Loaded conversations:', conversationsData.length);
      setConversations(conversationsData);
      
      if (conversationsData.length > 0 && !currentConversationId) {
        setCurrentConversationId(conversationsData[0].id);
      } else if (conversationsData.length === 0) {
        // Auto-create first conversation for new users
        console.log('[AI Chat] No conversations found, creating first conversation...');
        await createNewConversationInternal(true);
      }
    } catch (error) {
      console.error('[AI Chat] Error loading conversations:', error);
      // Don't show error on initial load - just create a new conversation
      try {
        await createNewConversationInternal(true);
      } catch (createError) {
        console.error('[AI Chat] Error creating initial conversation:', createError);
        showError('Failed to start conversation. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    console.log('[AI Chat] Loading messages for conversation:', conversationId);
    try {
      setLoading(true);
      const { data: messagesData, error } = await supabaseApi.getConversationMessages(conversationId);
      if (error) throw error;
      console.log('[AI Chat] Loaded messages:', messagesData.length);
      setMessages(messagesData);
    } catch (error) {
      console.error('[AI Chat] Error loading messages:', error);
      showError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const createNewConversationInternal = async (silent = false) => {
    console.log('[AI Chat] Creating new conversation...');
    try {
      if (!silent) setLoading(true);
      const { data: newConversation, error } = await supabaseApi.createConversation();
      if (error) throw error;
      console.log('[AI Chat] New conversation created:', newConversation);
      
      setConversations(prev => {
        // Avoid duplicates
        const exists = prev.some(c => c.id === newConversation.id);
        if (exists) return prev;
        return [newConversation, ...prev];
      });
      setShowConversations(false);

      // Handle initial greeting message from backend
      // Set messages immediately from the response (greeting is also saved to DB)
      if (newConversation.initialMessage) {
        const greetingMsg: Message = {
          id: `greeting-${newConversation.id}`,
          role: 'assistant',
          content: newConversation.initialMessage.content,
          createdAt: new Date().toISOString(),
        };
        setMessages([greetingMsg]);
        // Mark this conversation as just created so loadMessages doesn't overwrite
        justCreatedConversation.current = newConversation.id;
        setCurrentConversationId(newConversation.id);
        // Speak the greeting after a short delay
        setTimeout(() => speakText(greetingMsg.content), 600);
      } else {
        setMessages([]);
        setCurrentConversationId(newConversation.id);
      }
    } catch (error) {
      console.error('[AI Chat] Error creating conversation:', error);
      if (!silent) showError('Failed to create conversation');
      throw error;
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const createNewConversation = () => createNewConversationInternal(false);

  const startRecording = async () => {
    // Check if voice transcription is available
    if (healthStatus && !healthStatus.features.voiceTranscription) {
      showError('Voice transcription is not available. The administrator needs to configure the Google API key. Please use text mode instead.');
      return;
    }

    try {
      console.log('[Voice] Requesting audio permissions...');
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        showError('Microphone permission is required for voice input');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      console.log('[Voice] Starting recording...');
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      setIsListening(false);
    } catch (err) {
      console.error('[Voice] Failed to start recording:', err);
      showError('Failed to start recording. Please try again.');
    }
  };

  // Continuous listening mode - auto-start recording after AI speaks
  const startContinuousListening = async () => {
    if (!continuousMode || isRecording || sending || isSpeaking) {
      return;
    }

    try {
      console.log('[Continuous Mode] Starting to listen...');
      setIsListening(true);

      // Wait a moment before starting recording
      await new Promise(resolve => setTimeout(resolve, 800));

      if (!continuousMode || isSpeaking) {
        setIsListening(false);
        return;
      }

      await startRecording();

      // Auto-stop recording after 10 seconds of silence detection
      // (In a production app, you'd use voice activity detection)
      continuousModeTimeout.current = setTimeout(() => {
        if (isRecording && continuousMode) {
          console.log('[Continuous Mode] Auto-stopping recording after timeout');
          stopRecordingAndSend();
        }
      }, 10000);
    } catch (err) {
      console.error('[Continuous Mode] Failed to start listening:', err);
      setIsListening(false);
    }
  };

  const stopRecordingAndSend = async () => {
    if (!isRecording) return;

    if (continuousModeTimeout.current) {
      clearTimeout(continuousModeTimeout.current);
      continuousModeTimeout.current = null;
    }

    try {
      console.log('[Voice] Stopping recording...');
      setIsRecording(false);
      setIsListening(false);
      await audioRecorder.stop();

      const uri = audioRecorder.uri;

      if (!uri) {
        showError('Recording failed. Please try again.');
        return;
      }

      console.log('[Voice] Recording saved to:', uri);

      // Convert audio to base64
      const fetchResponse = await fetch(uri);
      const blob = await fetchResponse.blob();
      const reader = new FileReader();

      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        await sendAudioMessage(base64Data);
      };
      reader.onerror = () => {
        console.error('[Voice] Failed to read audio file');
        showError('Failed to process recording. Please try again.');
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('[Voice] Failed to stop recording:', err);
      setIsRecording(false);
      setIsListening(false);
      showError('Failed to process recording. Please try again.');
    }
  };

  const sendAudioMessage = async (audioBase64: string) => {
    let conversationId = currentConversationId;

    if (!conversationId) {
      try {
        const { data: newConversation, error: createError } = await supabaseApi.createConversation();
        if (createError) throw createError;
        conversationId = newConversation.id;
        justCreatedConversation.current = newConversation.id;
        setCurrentConversationId(conversationId);
        setConversations(prev => {
          const exists = prev.some(c => c.id === newConversation.id);
          if (exists) return prev;
          return [newConversation, ...prev];
        });

        if (newConversation.initialMessage) {
          const greetingMsg: Message = {
            id: `greeting-${newConversation.id}`,
            role: 'assistant',
            content: newConversation.initialMessage.content,
            createdAt: new Date().toISOString(),
          };
          setMessages([greetingMsg]);
        }
      } catch (error) {
        console.error('[AI Chat] Error creating conversation:', error);
        showError('Failed to create conversation');
        return;
      }
    }

    // Show a "processing voice..." placeholder
    const tempMsg: Message = {
      id: `temp-voice-${Date.now()}`,
      role: 'user',
      content: '🎤 Processing voice...',
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setSending(true);

    try {
      console.log('[AI Chat] Sending audio message to backend...');
      const { data: apiResponse, error: sendError } = await supabaseApi.sendAudioMessage(conversationId, audioBase64);
      if (sendError) throw sendError;

      // Backend returns: { response, transcribedText? }
      const transcribedText = apiResponse.transcribedText || '(voice message)';
      const aiText = apiResponse.response || 'No response';

      console.log('[AI Chat] Audio response received:', { transcribedText: transcribedText.substring(0, 50), aiText: aiText.substring(0, 50) });

      setMessages(prev => [
        ...prev.filter(m => m.id !== tempMsg.id),
        {
          id: `user-voice-${Date.now()}`,
          role: 'user',
          content: transcribedText,
          createdAt: new Date().toISOString(),
          isTranscribed: true,
        },
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: aiText,
          createdAt: new Date().toISOString(),
        },
      ]);

      // Speak the AI response
      speakText(aiText);
      // Refresh conversations list to update titles
      supabaseApi.getConversations()
        .then(({ data }) => {
          if (data) setConversations(data);
        })
        .catch(err => console.warn('[AI Chat] Failed to refresh conversations:', err));
    } catch (error: any) {
      console.error('[AI Chat] Error sending audio message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      // Show the specific error message from the backend if available
      const errorMsg = error?.message || 'Failed to process voice message. Try typing instead.';
      showError(errorMsg);
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    // Check if AI chat is available
    if (healthStatus && !healthStatus.features.aiChat) {
      showError('AI chat is not available. The administrator needs to configure the Google API key.');
      return;
    }

    const userMessage = message.trim();
    setMessage('');

    let conversationId = currentConversationId;

    if (!conversationId) {
      try {
        setSending(true);
        const response = await authenticatedPost('/api/reflection-chat/conversations', {});
        const newConversation = response?.data || response;
        conversationId = newConversation.id;
        justCreatedConversation.current = newConversation.id;
        setCurrentConversationId(conversationId);
        setConversations(prev => {
          const exists = prev.some(c => c.id === newConversation.id);
          if (exists) return prev;
          return [newConversation, ...prev];
        });

        if (newConversation.initialMessage) {
          const greetingMsg: Message = {
            id: `greeting-${newConversation.id}`,
            role: 'assistant',
            content: newConversation.initialMessage.content,
            createdAt: new Date().toISOString(),
          };
          setMessages([greetingMsg]);
        }
      } catch (error) {
        console.error('[AI Chat] Error creating conversation:', error);
        showError('Failed to create conversation');
        setSending(false);
        return;
      }
    }

    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      setSending(true);
      console.log('[AI Chat] Sending text message...');
      const { data: response, error: sendError } = await supabaseApi.sendTextMessage(conversationId, userMessage);
      if (sendError) throw sendError;

      // Backend returns: { response }
      const aiText = response.response || 'No response';

      console.log('[AI Chat] Text response received:', aiText.substring(0, 80));
      
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempUserMessage.id),
        {
          id: `user-${Date.now()}`,
          role: 'user',
          content: userMessage,
          createdAt: new Date().toISOString(),
        },
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: aiText,
          createdAt: new Date().toISOString(),
        },
      ]);

      // Speak the AI response
      speakText(aiText);
      // Refresh conversations list to update titles
      supabaseApi.getConversations()
        .then(({ data }) => {
          if (data) setConversations(data);
        })
        .catch(err => console.warn('[AI Chat] Failed to refresh conversations:', err));
    } catch (error: any) {
      console.error('[AI Chat] Error sending message:', error);
      const errorMsg = error?.message || 'Failed to send message. Please try again.';
      showError(errorMsg);
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
    } finally {
      setSending(false);
    }
  };

  const switchConversation = (conversationId: string) => {
    Speech.stop();
    setIsSpeaking(false);
    setCurrentConversationId(conversationId);
    setShowConversations(false);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setShowErrorModal(true);
    setTimeout(() => setShowErrorModal(false), 4500);
  };

  const currentConversation = conversations.find(c => c.id === currentConversationId);
  const conversationTitle = currentConversation?.title || 'AI Coach';

  const ratePercentage = Math.round(voiceSettings.rate * 100);
  const pitchPercentage = Math.round(voiceSettings.pitch * 100);

  const aiChatAvailable = healthStatus?.features.aiChat !== false;
  const voiceAvailable = healthStatus?.features.voiceTranscription !== false;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: conversationTitle,
          headerBackTitle: 'Back',
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => setShowConversations(!showConversations)}
                style={styles.headerButton}
              >
                <IconSymbol
                  ios_icon_name="line.3.horizontal"
                  android_material_icon_name="menu"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowVoiceSettings(true)}
                style={styles.headerButton}
              >
                <IconSymbol
                  ios_icon_name="slider.horizontal.3"
                  android_material_icon_name="tune"
                  size={20}
                  color={colors.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAutoSpeak(!autoSpeak)}
                style={[styles.headerButton, autoSpeak && styles.headerButtonActive]}
              >
                <IconSymbol
                  ios_icon_name={autoSpeak ? 'speaker.wave.2.fill' : 'speaker.slash.fill'}
                  android_material_icon_name={autoSpeak ? 'volume-up' : 'volume-off'}
                  size={20}
                  color={autoSpeak ? colors.primary : colors.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={createNewConversation}
                style={styles.headerButton}
              >
                <IconSymbol
                  ios_icon_name="plus.circle.fill"
                  android_material_icon_name="add-circle"
                  size={24}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
          ),
        }} 
      />

      <View style={styles.container}>
        {/* Configuration Warning Banner */}
        {showConfigWarning && (!aiChatAvailable || !voiceAvailable) && (
          <View style={styles.warningBanner}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="warning"
              size={20}
              color={colors.warning}
            />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>AI Features Not Configured</Text>
              <Text style={styles.warningText}>
                {!aiChatAvailable && !voiceAvailable
                  ? 'AI chat and voice transcription require configuration. Please contact the administrator to enable these features.'
                  : !aiChatAvailable
                  ? 'AI chat requires configuration. Please contact the administrator.'
                  : 'Voice transcription requires configuration. Please use text mode.'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowConfigWarning(false)}>
              <IconSymbol
                ios_icon_name="xmark"
                android_material_icon_name="close"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        )}

        {showConversations && (
          <View style={styles.conversationsPanel}>
            <View style={styles.conversationsPanelHeader}>
              <Text style={styles.conversationsPanelTitle}>Conversations</Text>
              <TouchableOpacity onPress={() => setShowConversations(false)}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={24}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.conversationsList}>
              {conversations.map((conv, index) => {
                const isActive = conv.id === currentConversationId;
                const displayTitle = conv.title || `Conversation ${conversations.length - index}`;
                
                return (
                  <TouchableOpacity
                    key={conv.id}
                    style={[styles.conversationItem, isActive && styles.conversationItemActive]}
                    onPress={() => switchConversation(conv.id)}
                  >
                    <IconSymbol
                      ios_icon_name="bubble.left.fill"
                      android_material_icon_name="chat-bubble"
                      size={20}
                      color={isActive ? colors.primary : colors.textSecondary}
                    />
                    <Text 
                      style={[styles.conversationItemText, isActive && styles.conversationItemTextActive]}
                      numberOfLines={1}
                    >
                      {displayTitle}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <KeyboardAvoidingView 
          style={styles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.length === 0 && !loading && (
              <View style={styles.welcomeContainer}>
                <View style={styles.welcomeIconContainer}>
                  <IconSymbol
                    ios_icon_name="mic.fill"
                    android_material_icon_name="mic"
                    size={56}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.welcomeTitle}>AI Reflection Coach</Text>
                <Text style={styles.welcomeMessage}>
                  {!aiChatAvailable
                    ? 'AI chat is currently unavailable. Please contact the administrator to enable this feature.'
                    : continuousMode 
                    ? 'Continuous mode enabled - I\'ll listen automatically after speaking'
                    : 'Tap the mic to start a voice conversation, or switch to text mode below'}
                </Text>
              </View>
            )}

            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              
              return (
                <View
                  key={msg.id || index}
                  style={[
                    styles.messageContainer,
                    isUser ? styles.userMessageContainer : styles.aiMessageContainer,
                  ]}
                >
                  {!isUser && (
                    <TouchableOpacity
                      style={styles.aiAvatar}
                      onPress={() => speakText(msg.content)}
                      activeOpacity={0.7}
                    >
                      <IconSymbol
                        ios_icon_name="sparkles"
                        android_material_icon_name="auto-awesome"
                        size={18}
                        color={colors.background}
                      />
                    </TouchableOpacity>
                  )}
                  <View
                    style={[
                      styles.messageBubble,
                      isUser ? styles.userMessageBubble : styles.aiMessageBubble,
                    ]}
                  >
                    <Text style={[styles.messageText, isUser ? styles.userMessageText : styles.aiMessageText]}>
                      {msg.content}
                    </Text>
                  </View>
                </View>
              );
            })}

            {sending && (
              <View style={[styles.messageContainer, styles.aiMessageContainer]}>
                <View style={styles.aiAvatar}>
                  <IconSymbol
                    ios_icon_name="sparkles"
                    android_material_icon_name="auto-awesome"
                    size={18}
                    color={colors.background}
                  />
                </View>
                <View style={styles.typingIndicator}>
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                </View>
              </View>
            )}

            {loading && messages.length === 0 && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Starting conversation...</Text>
              </View>
            )}
          </ScrollView>

          {/* Input Area - Extra bottom padding to clear the floating tab bar */}
          <View style={[styles.inputArea, { paddingBottom: Math.max(insets.bottom + 80, 100) }]}>
            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeButton, inputMode === 'voice' && styles.modeButtonActive]}
                onPress={() => setInputMode('voice')}
                disabled={!voiceAvailable}
              >
                <IconSymbol
                  ios_icon_name="mic.fill"
                  android_material_icon_name="mic"
                  size={14}
                  color={inputMode === 'voice' ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.modeButtonText, inputMode === 'voice' && styles.modeButtonTextActive]}>
                  Voice
                </Text>
                {!voiceAvailable && (
                  <IconSymbol
                    ios_icon_name="exclamationmark.circle"
                    android_material_icon_name="error"
                    size={12}
                    color={colors.error}
                  />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, inputMode === 'text' && styles.modeButtonActive]}
                onPress={() => setInputMode('text')}
              >
                <IconSymbol
                  ios_icon_name="keyboard"
                  android_material_icon_name="keyboard"
                  size={14}
                  color={inputMode === 'text' ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.modeButtonText, inputMode === 'text' && styles.modeButtonTextActive]}>
                  Type
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, continuousMode && styles.modeButtonActive]}
                onPress={() => saveContinuousMode(!continuousMode)}
                disabled={!voiceAvailable}
              >
                <IconSymbol
                  ios_icon_name={continuousMode ? 'infinity' : 'infinity.circle'}
                  android_material_icon_name={continuousMode ? 'all-inclusive' : 'all-inclusive'}
                  size={14}
                  color={continuousMode ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.modeButtonText, continuousMode && styles.modeButtonTextActive]}>
                  Auto
                </Text>
              </TouchableOpacity>
            </View>

            {inputMode === 'voice' ? (
              /* Voice Input */
              <View style={styles.voiceInputContainer}>
                {isSpeaking && (
                  <TouchableOpacity style={styles.stopSpeakButton} onPress={stopSpeaking}>
                    <IconSymbol
                      ios_icon_name="stop.circle.fill"
                      android_material_icon_name="stop-circle"
                      size={18}
                      color={colors.error}
                    />
                    <Text style={styles.stopSpeakText}>Stop Speaking</Text>
                  </TouchableOpacity>
                )}

                {isListening && !isRecording && (
                  <View style={styles.listeningIndicator}>
                    <IconSymbol
                      ios_icon_name="waveform"
                      android_material_icon_name="graphic-eq"
                      size={18}
                      color={colors.primary}
                    />
                    <Text style={styles.listeningText}>Listening...</Text>
                  </View>
                )}

                <Animated.View style={[styles.micButtonWrapper, { transform: [{ scale: pulseAnim }] }]}>
                  <TouchableOpacity
                    style={[
                      styles.micButton,
                      isRecording && styles.micButtonRecording,
                      (sending || !voiceAvailable) && styles.micButtonDisabled,
                    ]}
                    onPress={isRecording ? stopRecordingAndSend : startRecording}
                    disabled={sending || !voiceAvailable}
                    activeOpacity={0.8}
                  >
                    {sending ? (
                      <ActivityIndicator size="large" color={colors.background} />
                    ) : (
                      <IconSymbol
                        ios_icon_name={isRecording ? 'stop.fill' : 'mic.fill'}
                        android_material_icon_name={isRecording ? 'stop' : 'mic'}
                        size={34}
                        color={colors.background}
                      />
                    )}
                  </TouchableOpacity>
                </Animated.View>

                <Text style={styles.micHint}>
                  {!voiceAvailable
                    ? 'Voice unavailable - use text mode'
                    : sending
                    ? 'Processing...'
                    : isRecording
                    ? 'Tap to send'
                    : continuousMode
                    ? 'Auto mode - I\'ll listen after speaking'
                    : 'Tap to speak'}
                </Text>
              </View>
            ) : (
              /* Text Input */
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  value={message}
                  onChangeText={setMessage}
                  placeholder={aiChatAvailable ? "Ask about your goals, reflections, or progress..." : "AI chat is currently unavailable"}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  maxLength={1000}
                  editable={!sending && aiChatAvailable}
                />
                <TouchableOpacity
                  style={[styles.sendButton, (!message.trim() || sending || !aiChatAvailable) && styles.sendButtonDisabled]}
                  onPress={sendMessage}
                  disabled={!message.trim() || sending || !aiChatAvailable}
                >
                  {sending ? (
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
            )}
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Voice Settings Modal */}
      <Modal
        visible={showVoiceSettings}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVoiceSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Voice Settings</Text>
              <TouchableOpacity onPress={() => setShowVoiceSettings(false)}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="close"
                  size={28}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Voice Selection */}
              <Text style={styles.settingLabel}>AI Voice</Text>
              {AVAILABLE_VOICES.map((voice) => {
                const isSelected = voiceSettings.voice === voice.id;
                return (
                  <TouchableOpacity
                    key={voice.id}
                    style={[styles.voiceOption, isSelected && styles.voiceOptionSelected]}
                    onPress={() => saveVoiceSettings({ ...voiceSettings, voice: voice.id })}
                  >
                    <View style={styles.voiceOptionContent}>
                      <Text style={[styles.voiceOptionName, isSelected && styles.voiceOptionNameSelected]}>
                        {voice.name}
                      </Text>
                      <Text style={styles.voiceOptionLanguage}>{voice.language}</Text>
                    </View>
                    {isSelected && (
                      <IconSymbol
                        ios_icon_name="checkmark.circle.fill"
                        android_material_icon_name="check-circle"
                        size={24}
                        color={colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}

              {/* Speed Control */}
              <Text style={styles.settingLabel}>Speaking Speed: {ratePercentage}%</Text>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>Slow</Text>
                <View style={styles.sliderTrack}>
                  <View style={[styles.sliderFill, { width: `${ratePercentage}%` }]} />
                  <View style={styles.sliderButtons}>
                    <TouchableOpacity
                      style={styles.sliderButton}
                      onPress={() => saveVoiceSettings({ ...voiceSettings, rate: Math.max(0.5, voiceSettings.rate - 0.1) })}
                    >
                      <IconSymbol
                        ios_icon_name="minus"
                        android_material_icon_name="remove"
                        size={16}
                        color={colors.text}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.sliderButton}
                      onPress={() => saveVoiceSettings({ ...voiceSettings, rate: Math.min(1.5, voiceSettings.rate + 0.1) })}
                    >
                      <IconSymbol
                        ios_icon_name="plus"
                        android_material_icon_name="add"
                        size={16}
                        color={colors.text}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.sliderLabel}>Fast</Text>
              </View>

              {/* Pitch Control */}
              <Text style={styles.settingLabel}>Voice Pitch: {pitchPercentage}%</Text>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>Low</Text>
                <View style={styles.sliderTrack}>
                  <View style={[styles.sliderFill, { width: `${pitchPercentage}%` }]} />
                  <View style={styles.sliderButtons}>
                    <TouchableOpacity
                      style={styles.sliderButton}
                      onPress={() => saveVoiceSettings({ ...voiceSettings, pitch: Math.max(0.5, voiceSettings.pitch - 0.1) })}
                    >
                      <IconSymbol
                        ios_icon_name="minus"
                        android_material_icon_name="remove"
                        size={16}
                        color={colors.text}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.sliderButton}
                      onPress={() => saveVoiceSettings({ ...voiceSettings, pitch: Math.min(1.5, voiceSettings.pitch + 0.1) })}
                    >
                      <IconSymbol
                        ios_icon_name="plus"
                        android_material_icon_name="add"
                        size={16}
                        color={colors.text}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.sliderLabel}>High</Text>
              </View>

              {/* Test Voice Button */}
              <TouchableOpacity
                style={styles.testVoiceButton}
                onPress={() => speakText('Hello! This is how I sound with your current settings.')}
              >
                <IconSymbol
                  ios_icon_name="speaker.wave.2.fill"
                  android_material_icon_name="volume-up"
                  size={20}
                  color={colors.background}
                />
                <Text style={styles.testVoiceButtonText}>Test Voice</Text>
              </TouchableOpacity>

              {/* Reset Button */}
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => saveVoiceSettings({ voice: 'default', rate: 0.95, pitch: 1.0 })}
              >
                <Text style={styles.resetButtonText}>Reset to Default</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {showErrorModal && (
        <View style={styles.errorToast}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="error"
            size={20}
            color={colors.background}
          />
          <Text style={styles.errorToastText}>{errorMessage}</Text>
        </View>
      )}
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
  headerButton: {
    padding: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  headerButtonActive: {
    backgroundColor: colors.primary + '15',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.warning + '15',
    borderBottomWidth: 1,
    borderBottomColor: colors.warning + '30',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.warning,
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: colors.text,
    lineHeight: 16,
  },
  conversationsPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    zIndex: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  conversationsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  conversationsPanelTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  conversationItemActive: {
    backgroundColor: colors.primary + '10',
  },
  conversationItemText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  conversationItemTextActive: {
    fontWeight: '600',
    color: colors.primary,
  },
  content: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  welcomeIconContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  welcomeMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 14,
    alignItems: 'flex-end',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  aiMessageContainer: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userMessageBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  aiMessageBubble: {
    backgroundColor: colors.card,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  userMessageText: {
    color: colors.background,
  },
  aiMessageText: {
    color: colors.text,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.textSecondary,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  inputArea: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  modeToggle: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  modeButtonActive: {
    backgroundColor: colors.primary + '18',
  },
  modeButtonText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  modeButtonTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  voiceInputContainer: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  stopSpeakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.error + '15',
  },
  stopSpeakText: {
    fontSize: 13,
    color: colors.error,
    fontWeight: '600',
  },
  listeningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.primary + '15',
  },
  listeningText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  micButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  micButtonRecording: {
    backgroundColor: colors.error,
    shadowColor: colors.error,
  },
  micButtonDisabled: {
    opacity: 0.6,
  },
  micHint: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    fontSize: 15,
    color: colors.text,
    maxHeight: 110,
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
    opacity: 0.45,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  modalBody: {
    padding: 20,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 20,
    marginBottom: 12,
  },
  voiceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.card,
    marginBottom: 10,
  },
  voiceOptionSelected: {
    backgroundColor: colors.primary + '15',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  voiceOptionContent: {
    flex: 1,
  },
  voiceOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  voiceOptionNameSelected: {
    color: colors.primary,
  },
  voiceOptionLanguage: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    width: 40,
  },
  sliderTrack: {
    flex: 1,
    height: 40,
    backgroundColor: colors.card,
    borderRadius: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.primary + '30',
  },
  sliderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: '100%',
  },
  sliderButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testVoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  testVoiceButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.background,
  },
  resetButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 12,
    marginBottom: 20,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  errorToast: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: colors.error,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  errorToastText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});
