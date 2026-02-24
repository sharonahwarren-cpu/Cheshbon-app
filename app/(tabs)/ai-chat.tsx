
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { authenticatedGet, authenticatedPost } from '@/utils/api';
import * as Speech from 'expo-speech';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';

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

export default function AIChatScreen() {
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

  // Pulse animation for recording button
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loadConversations();
    return () => {
      Speech.stop();
      if (pulseLoop.current) pulseLoop.current.stop();
    };
  }, []);

  useEffect(() => {
    if (currentConversationId) {
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
  }, [isRecording]);

  const speakText = useCallback(async (text: string) => {
    if (!autoSpeak) return;
    try {
      await Speech.stop();
      setIsSpeaking(true);
      Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.95,
        onDone: () => setIsSpeaking(false),
        onError: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
      });
    } catch (err) {
      console.error('[Voice] Speech error:', err);
      setIsSpeaking(false);
    }
  }, [autoSpeak]);

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
      const response = await authenticatedGet('/api/reflection-chat/conversations');
      const conversationsData = Array.isArray(response) ? response : (response?.data || []);
      setConversations(conversationsData);
      
      if (conversationsData.length > 0 && !currentConversationId) {
        setCurrentConversationId(conversationsData[0].id);
      } else if (conversationsData.length === 0) {
        // Auto-create first conversation for new users
        await createNewConversationInternal(true);
      }
    } catch (error) {
      console.error('[AI Chat] Error loading conversations:', error);
      showError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    console.log('[AI Chat] Loading messages for conversation:', conversationId);
    try {
      setLoading(true);
      const response = await authenticatedGet(`/api/reflection-chat/conversations/${conversationId}/messages`);
      const messagesData = Array.isArray(response) ? response : (response?.data || []);
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
      const response = await authenticatedPost('/api/reflection-chat/conversations', {});
      const newConversation = response?.data || response;
      
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversationId(newConversation.id);
      setShowConversations(false);

      // Handle initial greeting message from backend
      if (newConversation.initialMessage) {
        const greetingMsg: Message = {
          id: `greeting-${Date.now()}`,
          role: 'assistant',
          content: newConversation.initialMessage.content,
          createdAt: new Date().toISOString(),
        };
        setMessages([greetingMsg]);
        // Speak the greeting after a short delay
        setTimeout(() => speakText(greetingMsg.content), 600);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('[AI Chat] Error creating conversation:', error);
      if (!silent) showError('Failed to create new conversation');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const createNewConversation = () => createNewConversationInternal(false);

  const startRecording = async () => {
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
    } catch (err) {
      console.error('[Voice] Failed to start recording:', err);
      showError('Failed to start recording. Please try again.');
    }
  };

  const stopRecordingAndSend = async () => {
    if (!isRecording) return;

    try {
      console.log('[Voice] Stopping recording...');
      setIsRecording(false);
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
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error('[Voice] Failed to stop recording:', err);
      setIsRecording(false);
      showError('Failed to process recording. Please try again.');
    }
  };

  const sendAudioMessage = async (audioBase64: string) => {
    let conversationId = currentConversationId;

    if (!conversationId) {
      try {
        const response = await authenticatedPost('/api/reflection-chat/conversations', {});
        const newConversation = response?.data || response;
        conversationId = newConversation.id;
        setCurrentConversationId(conversationId);
        setConversations(prev => [newConversation, ...prev]);

        if (newConversation.initialMessage) {
          const greetingMsg: Message = {
            id: `greeting-${Date.now()}`,
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
      const apiResponse = await authenticatedPost(
        `/api/reflection-chat/conversations/${conversationId}/messages`,
        { audioBase64 }
      );

      const aiResponse = apiResponse?.data || apiResponse;
      const transcribedText = aiResponse.transcribedText || '(voice message)';
      const aiText = aiResponse.response || aiResponse.content || 'No response';

      setMessages(prev => [
        ...prev.filter(m => m.id !== tempMsg.id),
        {
          id: `user-voice-${Date.now()}`,
          role: 'user',
          content: transcribedText,
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
      await loadConversations();
    } catch (error) {
      console.error('[AI Chat] Error sending audio message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      showError('Failed to process voice message. Try typing instead.');
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    const userMessage = message.trim();
    setMessage('');

    let conversationId = currentConversationId;

    if (!conversationId) {
      try {
        setSending(true);
        const response = await authenticatedPost('/api/reflection-chat/conversations', {});
        const newConversation = response?.data || response;
        conversationId = newConversation.id;
        setCurrentConversationId(conversationId);
        setConversations(prev => [newConversation, ...prev]);

        if (newConversation.initialMessage) {
          const greetingMsg: Message = {
            id: `greeting-${Date.now()}`,
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
      const response = await authenticatedPost(`/api/reflection-chat/conversations/${conversationId}/messages`, {
        message: userMessage,
      });

      const aiResponse = response?.data || response;
      const aiText = aiResponse.response || aiResponse.content || 'No response';
      
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
      await loadConversations();
    } catch (error) {
      console.error('[AI Chat] Error sending message:', error);
      showError('Failed to send message');
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
    setTimeout(() => setShowErrorModal(false), 3500);
  };

  const currentConversation = conversations.find(c => c.id === currentConversationId);
  const conversationTitle = currentConversation?.title || 'AI Coach';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
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

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {conversationTitle}
            </Text>
            {isSpeaking && (
              <View style={styles.speakingBadge}>
                <View style={styles.speakingDot} />
                <Text style={styles.speakingText}>Speaking</Text>
              </View>
            )}
          </View>

          <View style={styles.headerActions}>
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
        </View>

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
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
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
                  Tap the mic to start a voice conversation, or switch to text mode below
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

          {/* Input Area */}
          <View style={styles.inputArea}>
            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              <TouchableOpacity
                style={[styles.modeButton, inputMode === 'voice' && styles.modeButtonActive]}
                onPress={() => setInputMode('voice')}
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

                <Animated.View style={[styles.micButtonWrapper, { transform: [{ scale: pulseAnim }] }]}>
                  <TouchableOpacity
                    style={[
                      styles.micButton,
                      isRecording && styles.micButtonRecording,
                      sending && styles.micButtonDisabled,
                    ]}
                    onPress={isRecording ? stopRecordingAndSend : startRecording}
                    disabled={sending}
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
                  {sending
                    ? 'Processing...'
                    : isRecording
                    ? 'Tap to send'
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
                  placeholder="Ask about your goals, reflections, or progress..."
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  maxLength={1000}
                  editable={!sending}
                />
                <TouchableOpacity
                  style={[styles.sendButton, (!message.trim() || sending) && styles.sendButtonDisabled]}
                  onPress={sendMessage}
                  disabled={!message.trim() || sending}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    padding: 6,
    borderRadius: 8,
  },
  headerButtonActive: {
    backgroundColor: colors.primary + '15',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  speakingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  speakingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  speakingText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '500',
  },
  conversationsPanel: {
    position: 'absolute',
    top: 60,
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
    paddingBottom: Platform.OS === 'ios' ? 8 : 12,
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
  errorToast: {
    position: 'absolute',
    bottom: 110,
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
