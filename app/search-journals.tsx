
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { authenticatedGet } from '@/utils/api';

interface SearchResult {
  id: string;
  content: string;
  entryDate: string;
  createdAt: string;
  excerpt: string;
}

export default function SearchJournalsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SearchResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    console.log('Searching journals for:', searchQuery);
    setLoading(true);
    setHasSearched(true);
    try {
      const results = await authenticatedGet(`/api/journals/search?q=${encodeURIComponent(searchQuery)}`);
      const resultsData = Array.isArray(results) ? results : (results?.data || []);
      setSearchResults(resultsData);
      console.log('Search results:', resultsData);
    } catch (error) {
      console.error('Error searching journals:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleViewEntry = (result: SearchResult) => {
    console.log('Opening journal entry modal for date:', result.entryDate);
    setSelectedEntry(result);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    console.log('Closing journal entry modal');
    setModalVisible(false);
    setSelectedEntry(null);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  const dateDisplay = formatDate;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: 'Search Journals',
          headerBackTitle: 'Back',
        }} 
      />

      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <IconSymbol
              ios_icon_name="magnifyingglass"
              android_material_icon_name="search"
              size={20}
              color={colors.textSecondary}
            />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search your journals..."
              placeholderTextColor={colors.textSecondary}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="cancel"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            disabled={loading || !searchQuery.trim()}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={false}>
          {!hasSearched ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="magnifyingglass"
                android_material_icon_name="search"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyStateTitle}>Search Your Journals</Text>
              <Text style={styles.emptyStateText}>
                Enter keywords to find journal entries containing those words
              </Text>
            </View>
          ) : loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : searchResults.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol
                ios_icon_name="doc.text.magnifyingglass"
                android_material_icon_name="search-off"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyStateTitle}>No Results Found</Text>
              <Text style={styles.emptyStateText}>
                No journal entries found containing &quot;{searchQuery}&quot;
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsCount}>
                  {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} found
                </Text>
              </View>
              {searchResults.map((result, index) => {
                const formattedDate = dateDisplay(result.entryDate);
                
                return (
                  <React.Fragment key={index}>
                    <View style={styles.resultCard}>
                      <View style={styles.resultHeader}>
                        <Text style={styles.resultDate}>{formattedDate}</Text>
                        <IconSymbol
                          ios_icon_name="calendar"
                          android_material_icon_name="calendar-today"
                          size={16}
                          color={colors.primary}
                        />
                      </View>
                      <Text style={styles.resultExcerpt} numberOfLines={3}>
                        {result.excerpt || result.content}
                      </Text>
                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => handleViewEntry(result)}
                      >
                        <Text style={styles.viewButtonText}>View Full Entry</Text>
                        <IconSymbol
                          ios_icon_name="arrow.right"
                          android_material_icon_name="arrow-forward"
                          size={16}
                          color={colors.primary}
                        />
                      </TouchableOpacity>
                    </View>
                  </React.Fragment>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>

      {/* Journal Entry Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderContent}>
                <IconSymbol
                  ios_icon_name="book.fill"
                  android_material_icon_name="menu-book"
                  size={24}
                  color={colors.primary}
                />
                <Text style={styles.modalTitle}>Journal Entry</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCloseModal}
              >
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="cancel"
                  size={28}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Modal Content */}
            {selectedEntry && (
              <ScrollView
                style={styles.modalContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalDateContainer}>
                  <IconSymbol
                    ios_icon_name="calendar"
                    android_material_icon_name="calendar-today"
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={styles.modalDate}>
                    {dateDisplay(selectedEntry.entryDate)}
                  </Text>
                </View>

                <View style={styles.modalEntryContainer}>
                  <Text style={styles.modalEntryText}>
                    {selectedEntry.content}
                  </Text>
                </View>
              </ScrollView>
            )}

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.doneButton}
                onPress={handleCloseModal}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
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
    padding: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 14,
  },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  searchButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsHeader: {
    marginBottom: 16,
  },
  resultsCount: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  resultCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  resultDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  resultExcerpt: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  // Modal Styles
  modalSafeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalDate: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  modalEntryContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalEntryText: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  doneButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '600',
  },
});
