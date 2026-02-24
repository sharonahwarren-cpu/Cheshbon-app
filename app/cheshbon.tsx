
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { authenticatedGet, authenticatedPost, authenticatedDelete, BACKEND_URL, getBearerToken } from '@/utils/api';
import { ConfirmModal } from '@/components/ConfirmModal';
import { AudioRecorder, AudioRecording, RecordingOptions } from 'expo-audio';
import * as FileSystem from 'expo-file-system';

interface CheshbonSession {
  id: string;
  sessionDate: string;
  transcription?: string;
  aiSuggestions?: AiSuggestion[];
  createdAt: string;
}

interface AiSuggestion {
  category: string;
  reason: string;
  status: 'upheld' | 'lapsed';
}

interface CheshbonMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface MitzvahCategory {
  id: string;
  name: string;
}

export default function CheshbonScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<CheshbonSession[]>([]);
  const [activeSession, setActiveSession] = useState<CheshbonSession | null>(null);
  const [messages, setMessages] = useState<CheshbonMessage[]>([]);
  const [categories, setCategories] = useState<MitzvahCategory[]>([]);

  // Recording state
  const [recording, setRecording] = useState<AudioRecording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);

  // Chat state
  const [chatMessage, setChatMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [expandedSuggestions, setExpandedSuggestions] = useState<Record<number, boolean>>({});

  // UI state
  const [currentView, setCurrentView] = useState<'sessions' | 'record' | 'chat'>('sessions');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);

  useFocusEffect(useCallback(() => {
    loadSessions();
    loadCategories();
  }, []));

  const loadSessions = async () => {
    console.log('[Cheshbon] Loading sessions...');
    try {
      const res = await authenticatedGet('/api/cheshbon/sessions');
      const data = Array.isArray(res) ? res : (res?.data || []);
      setSessions(data);
    } catch (error) {
      console.error('[Cheshbon] Error loading sessions:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await authenticatedGet('/api/mitzvot-categories');
      setCategories(Array.isArray(res) ? res : (res?.data || []));
    } catch (error) {
      console.error('[Cheshbon] Error loading categories:', error);
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    console.log('[Cheshbon] Loading session messages:', sessionId);
    try {
      const res = await authenticatedGet(`/api/cheshbon/sessions/${sessionId}`);
      const sessionData = res?.data || res;
      if (sessionData?.messages) {
        setMessages(sessionData.messages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('[Cheshbon] Error loading messages:', error);
      setMessages([]);
    }
  };

  const showError = (msg: string) => { 
    console.log('[Cheshbon] Showing error:', msg);
    setErrorMessage(msg); 
    setShowErrorModal(true); 
  };

  const startRecording = async () => {
    try {
      console.log('[Cheshbon] Requesting audio permissions...');
      const { granted } = await AudioRecorder.requestPermissionsAsync();
      if (!granted) {
        showError('Microphone permission is required for voice recording.');
        return;
      }

      console.log('[Cheshbon] Starting recording...');
      const recordingOptions: RecordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: 'mpeg4',
          audioEncoder: 'aac',
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: 'mpeg4aac',
          audioQuality: 'high',
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

      const newRecording = await AudioRecorder.recordAsync(recordingOptions);
      setRecording(newRecording);
      setIsRecording(true);
      setTranscription('');
      setSuggestions([]);
    } catch (error: any) {
      console.error('[Cheshbon] Error starting recording:', error);
      showError(error.message || 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      console.log('[Cheshbon] Stopping recording...');
      setIsRecording(false);
      const uri = await recording.stopAsync();
      setRecording(null);

      if (uri) {
        await transcribeAudio(uri);
      }
    } catch (error: any) {
      console.error('[Cheshbon] Error stopping recording:', error);
      showError(error.message || 'Failed to stop recording');
      setIsRecording(false);
      setRecording(null);
    }
  };

  const transcribeAudio = async (audioUri: string) => {
    console.log('[Cheshbon] Transcribing audio:', audioUri);
    setTranscribing(true);
    try {
      const token = await getBearerToken();
      const formData = new FormData();

      // Determine file extension
      const ext = audioUri.split('.').pop() || 'm4a';
      const mimeType = ext === 'mp4' ? 'audio/mp4' : ext === 'wav' ? 'audio/wav' : 'audio/m4a';

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
        let errorMessage = `Transcription failed with status ${response.status}`;
        
        try {
          const errorData = await response.json();
          console.log('[Cheshbon] Error response:', errorData);
          
          // Handle specific error cases
          if (response.status === 503) {
            errorMessage = errorData.error || 'The transcription service is temporarily unavailable. Please try again later or contact support.';
          } else if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          console.error('[Cheshbon] Failed to parse error response:', parseError);
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('[Cheshbon] Transcription result:', data);
      setTranscription(data.transcription || '');

      if (data.sessionId) {
        setActiveSession({ 
          id: data.sessionId, 
          sessionDate: new Date().toISOString(), 
          transcription: data.transcription, 
          createdAt: new Date().toISOString() 
        });
      }
    } catch (error: any) {
      console.error('[Cheshbon] Transcription error:', error);
      showError(error.message || 'Failed to transcribe audio. Please try again.');
    } finally {
      setTranscribing(false);
    }
  };

  const analyzeTranscription = async () => {
    if (!transcription.trim() || !activeSession) {
      showError('Please record and transcribe audio first');
      return;
    }

    console.log('[Cheshbon] Analyzing transcription...');
    setAnalyzing(true);
    try {
      const res = await authenticatedPost('/api/cheshbon/analyze', {
        sessionId: activeSession.id,
        transcription: transcription,
      });

      const data = res?.data || res;
      const suggestionsList = data?.suggestions || [];
      setSuggestions(suggestionsList);

      // Update active session with suggestions
      setActiveSession(prev => prev ? { ...prev, aiSuggestions: suggestionsList } : null);

      console.log('[Cheshbon] Analysis complete:', suggestionsList.length, 'suggestions');
    } catch (error: any) {
      console.error('[Cheshbon] Analysis error:', error);
      showError(error.message || 'Failed to analyze transcription');
    } finally {
      setAnalyzing(false);
    }
  };

  const openSession = async (session: CheshbonSession) => {
    setActiveSession(session);
    setSuggestions(session.aiSuggestions || []);
    setTranscription(session.transcription || '');
    await loadSessionMessages(session.id);
    setCurrentView('chat');
  };

  const sendChatMessage = async () => {
    if (!chatMessage.trim() || !activeSession) return;

    const messageText = chatMessage.trim();
    setChatMessage('');
    setSendingMessage(true);

    // Optimistic update
    const tempMessage: CheshbonMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: messageText,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      console.log('[Cheshbon] Sending message to session:', activeSession.id);
      const res = await authenticatedPost(`/api/cheshbon/sessions/${activeSession.id}/messages`, {
        message: messageText,
      });

      const data = res?.data || res;
      const aiResponse: CheshbonMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.response || 'I understand. Please continue.',
        createdAt: new Date().toISOString(),
      };

      setMessages(prev => [...prev.filter(m => m.id !== tempMessage.id), { ...tempMessage, id: `user-${Date.now()}` }, aiResponse]);

      // Scroll to bottom
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error: any) {
      console.error('[Cheshbon] Error sending message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      showError(error.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const confirmDeleteSession = (id: string) => {
    setDeleteSessionId(id);
    setShowConfirmDelete(true);
  };

  const handleDeleteSession = async () => {
    try {
      setShowConfirmDelete(false);
      await authenticatedDelete(`/api/cheshbon/sessions/${deleteSessionId}`);
      setSessions(prev => prev.filter(s => s.id !== deleteSessionId));
      if (activeSession?.id === deleteSessionId) {
        setActiveSession(null);
        setCurrentView('sessions');
      }
    } catch (error: any) {
      showError(error.message || 'Failed to delete session');
    }
  };

  const startNewSession = () => {
    setActiveSession(null);
    setTranscription('');
    setSuggestions([]);
    setMessages([]);
    setCurrentView('record');
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const renderSessionsList = () => (
    <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
      <TouchableOpacity style={styles.newSessionButton} onPress={startNewSession}>
        <IconSymbol ios_icon_name="mic.fill" android_material_icon_name="mic" size={24} color={colors.background} />
        <Text style={styles.newSessionButtonText}>Start New Cheshbon</Text>
      </TouchableOpacity>

      {sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol ios_icon_name="mic.fill" android_material_icon_name="mic" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyStateTitle}>No Sessions Yet</Text>
          <Text style={styles.emptyStateText}>
            Start a new Cheshbon session to reflect on your mitzvot with AI assistance.
          </Text>
        </View>
      ) : (
        sessions.map((session) => (
          <TouchableOpacity key={session.id} style={styles.sessionCard} onPress={() => openSession(session)}>
            <View style={styles.sessionCardContent}>
              <View style={styles.sessionCardHeader}>
                <IconSymbol ios_icon_name="mic.fill" android_material_icon_name="mic" size={18} color={colors.primary} />
                <Text style={styles.sessionDate}>{formatDate(session.sessionDate)}</Text>
              </View>
              {session.transcription ? (
                <Text style={styles.sessionPreview} numberOfLines={2}>{session.transcription}</Text>
              ) : null}
              {session.aiSuggestions && session.aiSuggestions.length > 0 && (
                <Text style={styles.sessionSuggestions}>{session.aiSuggestions.length} AI suggestions</Text>
              )}
            </View>
            <View style={styles.sessionCardActions}>
              <TouchableOpacity onPress={() => confirmDeleteSession(session.id)} style={styles.iconButton}>
                <IconSymbol ios_icon_name="trash" android_material_icon_name="delete" size={18} color={colors.error} />
              </TouchableOpacity>
              <IconSymbol ios_icon_name="chevron.right" android_material_icon_name="arrow-forward" size={18} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );

  const renderRecordView = () => (
    <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
      <View style={styles.recordSection}>
        <Text style={styles.recordTitle}>Voice Reflection</Text>
        <Text style={styles.recordSubtitle}>
          Speak about your day, your actions, and your spiritual journey. The AI will help identify relevant mitzvot.
        </Text>

        <TouchableOpacity
          style={[styles.micButton, isRecording && styles.micButtonRecording]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={transcribing}
        >
          {transcribing ? (
            <ActivityIndicator size="large" color={colors.background} />
          ) : (
            <IconSymbol
              ios_icon_name={isRecording ? 'stop.fill' : 'mic.fill'}
              android_material_icon_name={isRecording ? 'stop' : 'mic'}
              size={48}
              color={colors.background}
            />
          )}
        </TouchableOpacity>

        <Text style={styles.micLabel}>
          {transcribing ? 'Transcribing...' : isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
        </Text>

        {transcription ? (
          <View style={styles.transcriptionCard}>
            <Text style={styles.transcriptionLabel}>Transcription:</Text>
            <TextInput
              style={styles.transcriptionInput}
              value={transcription}
              onChangeText={setTranscription}
              multiline
              placeholder="Your transcription will appear here..."
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity
              style={[styles.analyzeButton, analyzing && styles.analyzeButtonDisabled]}
              onPress={analyzeTranscription}
              disabled={analyzing}
            >
              {analyzing ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <IconSymbol ios_icon_name="sparkles" android_material_icon_name="auto-awesome" size={20} color={colors.background} />
                  <Text style={styles.analyzeButtonText}>Analyze with AI</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {suggestions.length > 0 && (
          <View style={styles.suggestionsSection}>
            <Text style={styles.suggestionsTitle}>AI Suggestions</Text>
            {suggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={index}
                style={styles.suggestionCard}
                onPress={() => setExpandedSuggestions(prev => ({ ...prev, [index]: !prev[index] }))}
              >
                <View style={styles.suggestionHeader}>
                  <View style={styles.suggestionTitleRow}>
                    <View style={[styles.statusDot, suggestion.status === 'upheld' ? styles.statusDotUpheld : styles.statusDotLapsed]} />
                    <Text style={styles.suggestionCategory}>{suggestion.category}</Text>
                  </View>
                  <View style={[styles.statusBadge, suggestion.status === 'upheld' ? styles.statusBadgeUpheld : styles.statusBadgeLapsed]}>
                    <Text style={styles.statusBadgeText}>{suggestion.status === 'upheld' ? 'Upheld' : 'Lapsed'}</Text>
                  </View>
                </View>
                {expandedSuggestions[index] && (
                  <Text style={styles.suggestionReason}>{suggestion.reason}</Text>
                )}
              </TouchableOpacity>
            ))}

            {activeSession && (
              <TouchableOpacity
                style={styles.continueButton}
                onPress={() => {
                  loadSessionMessages(activeSession.id);
                  setCurrentView('chat');
                }}
              >
                <IconSymbol ios_icon_name="bubble.left.fill" android_material_icon_name="chat" size={20} color={colors.background} />
                <Text style={styles.continueButtonText}>Continue with AI Chat</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );

  const renderChatView = () => (
    <View style={styles.chatContainer}>
      {activeSession?.transcription && (
        <View style={styles.transcriptionSummary}>
          <Text style={styles.transcriptionSummaryLabel}>Your reflection:</Text>
          <Text style={styles.transcriptionSummaryText} numberOfLines={2}>{activeSession.transcription}</Text>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={styles.chatEmptyState}>
            <IconSymbol ios_icon_name="bubble.left.and.bubble.right.fill" android_material_icon_name="chat" size={40} color={colors.textSecondary} />
            <Text style={styles.chatEmptyText}>
              Ask the AI questions about your mitzvot, or discuss your reflection in depth.
            </Text>
          </View>
        )}
        {messages.map((msg, index) => (
          <View key={index} style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={[styles.messageText, msg.role === 'user' ? styles.userMessageText : styles.aiMessageText]}>
              {msg.content}
            </Text>
          </View>
        ))}
        {sendingMessage && (
          <View style={[styles.messageBubble, styles.aiBubble]}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </ScrollView>

      <View style={styles.chatInputContainer}>
        <TextInput
          style={styles.chatInput}
          value={chatMessage}
          onChangeText={setChatMessage}
          placeholder="Ask about your mitzvot..."
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!chatMessage.trim() || sendingMessage) && styles.sendButtonDisabled]}
          onPress={sendChatMessage}
          disabled={!chatMessage.trim() || sendingMessage}
        >
          <IconSymbol ios_icon_name="arrow.up.circle.fill" android_material_icon_name="send" size={32} color={!chatMessage.trim() ? colors.textSecondary : colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            if (currentView !== 'sessions') {
              setCurrentView('sessions');
              loadSessions();
            } else {
              router.back();
            }
          }}>
            <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {currentView === 'sessions' ? 'Cheshbon Sessions' : currentView === 'record' ? 'New Cheshbon' : 'AI Conversation'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Tab Bar */}
        {currentView !== 'sessions' && (
          <View style={styles.tabBar}>
            <TouchableOpacity style={[styles.tab, currentView === 'record' && styles.tabActive]} onPress={() => setCurrentView('record')}>
              <IconSymbol ios_icon_name="mic.fill" android_material_icon_name="mic" size={18} color={currentView === 'record' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.tabText, currentView === 'record' && styles.tabTextActive]}>Record</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, currentView === 'chat' && styles.tabActive]}
              onPress={() => activeSession ? setCurrentView('chat') : showError('Start a recording first')}
            >
              <IconSymbol ios_icon_name="bubble.left.fill" android_material_icon_name="chat" size={18} color={currentView === 'chat' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.tabText, currentView === 'chat' && styles.tabTextActive]}>Chat</Text>
            </TouchableOpacity>
          </View>
        )}

        {currentView === 'sessions' && renderSessionsList()}
        {currentView === 'record' && renderRecordView()}
        {currentView === 'chat' && renderChatView()}
      </View>

      <ConfirmModal
        visible={showConfirmDelete}
        title="Delete Session"
        message="Are you sure you want to delete this Cheshbon session? This cannot be undone."
        onConfirm={handleDeleteSession}
        onCancel={() => setShowConfirmDelete(false)}
      />

      <Modal visible={showErrorModal} transparent animationType="fade" onRequestClose={() => setShowErrorModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertModal}>
            <IconSymbol ios_icon_name="exclamationmark.triangle.fill" android_material_icon_name="warning" size={40} color={colors.error} />
            <Text style={styles.alertTitle}>Error</Text>
            <Text style={styles.alertMessage}>{errorMessage}</Text>
            <TouchableOpacity style={styles.alertButton} onPress={() => setShowErrorModal(false)}>
              <Text style={styles.alertButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  tabBar: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 8, gap: 8 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  listContainer: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  newSessionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary, borderRadius: 14, padding: 16, marginBottom: 20 },
  newSessionButtonText: { fontSize: 16, fontWeight: '700', color: colors.background },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyStateTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  emptyStateText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 20 },
  sessionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  sessionCardContent: { flex: 1 },
  sessionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sessionDate: { fontSize: 15, fontWeight: '600', color: colors.text },
  sessionPreview: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  sessionSuggestions: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  sessionCardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { padding: 6 },
  recordSection: { alignItems: 'center', paddingTop: 20 },
  recordTitle: { fontSize: 22, fontWeight: 'bold', color: colors.text, marginBottom: 8 },
  recordSubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 20, marginBottom: 32, lineHeight: 20 },
  micButton: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  micButtonRecording: { backgroundColor: colors.error },
  micLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 24 },
  transcriptionCard: { width: '100%', backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  transcriptionLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 8 },
  transcriptionInput: { fontSize: 15, color: colors.text, minHeight: 80, textAlignVertical: 'top', lineHeight: 22 },
  analyzeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 10, padding: 14, marginTop: 12 },
  analyzeButtonDisabled: { opacity: 0.6 },
  analyzeButtonText: { fontSize: 15, fontWeight: '700', color: colors.background },
  suggestionsSection: { width: '100%', marginTop: 8 },
  suggestionsTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 },
  suggestionCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  suggestionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusDotUpheld: { backgroundColor: colors.success },
  statusDotLapsed: { backgroundColor: colors.error },
  suggestionCategory: { fontSize: 15, fontWeight: '600', color: colors.text },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeUpheld: { backgroundColor: colors.success + '20' },
  statusBadgeLapsed: { backgroundColor: colors.error + '20' },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: colors.text },
  suggestionReason: { fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 18 },
  continueButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: 10, padding: 14, marginTop: 16 },
  continueButtonText: { fontSize: 15, fontWeight: '700', color: colors.background },
  chatContainer: { flex: 1 },
  transcriptionSummary: { backgroundColor: colors.highlight, padding: 12, marginHorizontal: 20, borderRadius: 10, marginBottom: 8 },
  transcriptionSummaryLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  transcriptionSummaryText: { fontSize: 13, color: colors.text, lineHeight: 18 },
  messagesContainer: { flex: 1 },
  messagesContent: { paddingHorizontal: 20, paddingVertical: 12, paddingBottom: 20 },
  chatEmptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  chatEmptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 20, lineHeight: 20 },
  messageBubble: { maxWidth: '80%', borderRadius: 16, padding: 12, marginBottom: 8 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.primary },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  messageText: { fontSize: 15, lineHeight: 22 },
  userMessageText: { color: colors.background },
  aiMessageText: { color: colors.text },
  chatInputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  chatInput: { flex: 1, backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border, maxHeight: 100 },
  sendButton: { padding: 4 },
  sendButtonDisabled: { opacity: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  alertModal: { backgroundColor: colors.background, borderRadius: 16, padding: 24, width: '80%', maxWidth: 400, alignItems: 'center', gap: 12 },
  alertTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  alertMessage: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  alertButton: { backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  alertButtonText: { color: colors.background, fontSize: 15, fontWeight: '600' },
});
