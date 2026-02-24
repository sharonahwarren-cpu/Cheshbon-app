
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { authenticatedGet, authenticatedPost } from '@/utils/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
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

  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);

  useEffect(() => {
    loadConversations();
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

  const loadConversations = async () => {
    console.log('Loading conversations...');
    try {
      setLoading(true);
      const response = await authenticatedGet('/api/reflection-chat/conversations');
      const conversationsData = Array.isArray(response) ? response : (response?.data || []);
      setConversations(conversationsData);
      
      if (conversationsData.length > 0 && !currentConversationId) {
        setCurrentConversationId(conversationsData[0].id);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      showError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    console.log('Loading messages for conversation:', conversationId);
    try {
      setLoading(true);
      const response = await authenticatedGet(`/api/reflection-chat/conversations/${conversationId}/messages`);
      const messagesData = Array.isArray(response) ? response : (response?.data || []);
      setMessages(messagesData);
    } catch (error) {
      console.error('Error loading messages:', error);
      showError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const createNewConversation = async () => {
    console.log('Creating new conversation...');
    try {
      setLoading(true);
      const response = await authenticatedPost('/api/reflection-chat/conversations', {});
      const newConversation = response?.data || response;
      
      setConversations([newConversation, ...conversations]);
      setCurrentConversationId(newConversation.id);
      setMessages([]);
      setShowConversations(false);
    } catch (error) {
      console.error('Error creating conversation:', error);
      showError('Failed to create new conversation');
    } finally {
      setLoading(false);
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
        setConversations([newConversation, ...conversations]);
      } catch (error) {
        console.error('Error creating conversation:', error);
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
      const response = await authenticatedPost(`/api/reflection-chat/conversations/${conversationId}/messages`, {
        message: userMessage,
      });

      const aiResponse = response?.data || response;
      
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
          content: aiResponse.response || aiResponse.content || 'No response',
          createdAt: new Date().toISOString(),
        },
      ]);

      await loadConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      showError('Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
    } finally {
      setSending(false);
    }
  };

  const switchConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    setShowConversations(false);
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setShowErrorModal(true);
    setTimeout(() => setShowErrorModal(false), 3000);
  };

  const currentConversation = conversations.find(c => c.id === currentConversationId);
  const conversationTitle = currentConversation?.title || 'New Conversation';

  const welcomeMessage = "Hello! I'm your AI reflection coach. I'm here to help you with:\n\n• Reflecting on your goals and progress\n• Setting meaningful goals\n• Monitoring your achievements\n• Providing insights and guidance\n\nHow can I help you today?";

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
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
          <Text style={styles.headerTitle} numberOfLines={1}>
            {conversationTitle}
          </Text>
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
          behavior="padding"
          keyboardVerticalOffset={90}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 && !loading && (
              <View style={styles.welcomeContainer}>
                <View style={styles.welcomeIconContainer}>
                  <IconSymbol
                    ios_icon_name="sparkles"
                    android_material_icon_name="auto-awesome"
                    size={64}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.welcomeTitle}>AI Reflection Coach</Text>
                <Text style={styles.welcomeMessage}>{welcomeMessage}</Text>
              </View>
            )}

            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              
              return (
                <View
                  key={index}
                  style={[
                    styles.messageContainer,
                    isUser ? styles.userMessageContainer : styles.aiMessageContainer,
                  ]}
                >
                  {!isUser && (
                    <View style={styles.aiAvatar}>
                      <IconSymbol
                        ios_icon_name="sparkles"
                        android_material_icon_name="auto-awesome"
                        size={20}
                        color={colors.background}
                      />
                    </View>
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
              <View style={styles.messageContainer}>
                <View style={styles.aiAvatar}>
                  <IconSymbol
                    ios_icon_name="sparkles"
                    android_material_icon_name="auto-awesome"
                    size={20}
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
              </View>
            )}
          </ScrollView>

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
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  welcomeIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  welcomeMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  aiMessageContainer: {
    justifyContent: 'flex-start',
  },
  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
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
    fontSize: 16,
    lineHeight: 22,
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 12,
    fontSize: 16,
    color: colors.text,
    maxHeight: 120,
    marginRight: 8,
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
  errorToast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: colors.error,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  errorToastText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
});
