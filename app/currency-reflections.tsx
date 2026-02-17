
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { authenticatedGet } from '@/utils/api';

interface CurrencyReflection {
  id: string;
  entryDate: string;
  type: 'reflection';
  description: string;
  linkedGoalTitle?: string;
  outcome?: 'success' | 'struggled';
  currencyChange?: {
    currencyId: string;
    amount: number;
    operation: 'add' | 'subtract';
    currencyName?: string;
    currencySymbol?: string;
  };
  createdAt: string;
}

interface CurrencyTransaction {
  id: string;
  entryDate: string;
  type: 'transaction';
  transactionType: 'claim' | 'pay';
  amount: number;
  description: string;
  createdAt: string;
}

type CurrencyEntry = CurrencyReflection | CurrencyTransaction;

export default function CurrencyReflectionsScreen() {
  const router = useRouter();
  const { currencyId } = useLocalSearchParams<{ currencyId: string }>();
  
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<CurrencyEntry[]>([]);
  const [currencyName, setCurrencyName] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('');
  
  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);

  useEffect(() => {
    if (currencyId) {
      loadEntries();
    }
  }, [currencyId]);

  const loadEntries = async () => {
    console.log('[Currency History] Loading entries for currency:', currencyId);
    setLoading(true);
    try {
      const response = await authenticatedGet(`/api/reports/currency-reflections/${currencyId}`);
      const entriesData = Array.isArray(response) ? response : (response?.data || []);
      
      console.log('[Currency History] Received entries:', entriesData.length);
      if (entriesData.length > 0) {
        console.log('[Currency History] First entry:', entriesData[0]);
        console.log('[Currency History] Last entry:', entriesData[entriesData.length - 1]);
      }
      
      // Backend sorts entries by date (newest first):
      // - Reflections are sorted by entryDate
      // - Transactions are sorted by createdAt
      // Both include full timestamps for accurate time display
      setEntries(entriesData);
      
      // Get currency name and symbol
      if (entriesData.length > 0) {
        const firstReflection = entriesData.find((e: CurrencyEntry) => e.type === 'reflection') as CurrencyReflection | undefined;
        if (firstReflection?.currencyChange) {
          const currencyNameValue = firstReflection.currencyChange.currencyName || '';
          const currencySymbolValue = firstReflection.currencyChange.currencySymbol || '';
          setCurrencyName(currencyNameValue);
          setCurrencySymbol(currencySymbolValue);
        } else {
          // Fallback: fetch currency details
          const currencyRes = await authenticatedGet(`/api/currencies/${currencyId}`);
          const currencyData = currencyRes?.data || currencyRes;
          const currencyNameValue = currencyData.name || 'Currency';
          const currencySymbolValue = currencyData.symbol || '';
          setCurrencyName(currencyNameValue);
          setCurrencySymbol(currencySymbolValue);
        }
      } else {
        // No entries, fetch currency details
        const currencyRes = await authenticatedGet(`/api/currencies/${currencyId}`);
        const currencyData = currencyRes?.data || currencyRes;
        const currencyNameValue = currencyData.name || 'Currency';
        const currencySymbolValue = currencyData.symbol || '';
        setCurrencyName(currencyNameValue);
        setCurrencySymbol(currencySymbolValue);
      }
      
      console.log('[Currency History] Entries loaded:', entriesData.length);
    } catch (error: any) {
      console.error('[Currency History] Error loading entries:', error);
      showError(error.message || 'Failed to load entries');
    } finally {
      setLoading(false);
    }
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    
    // Format date part
    const dateOptions: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric'
    };
    const datePart = date.toLocaleDateString('en-US', dateOptions);
    
    // Format time part
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    };
    const timePart = date.toLocaleTimeString('en-US', timeOptions);
    
    const formattedDate = `${datePart} at ${timePart}`;
    return formattedDate;
  };

  const handleReflectionPress = (entry: CurrencyEntry) => {
    if (entry.type === 'reflection') {
      const reflection = entry as CurrencyReflection;
      console.log('[Currency History] Navigating to reflection:', {
        id: reflection.id,
        entryDate: reflection.entryDate,
        description: reflection.description.substring(0, 50)
      });
      // Navigate to reflect screen with the date and reflection ID
      // The reflect screen will open the edit modal for this reflection
      router.push({
        pathname: '/(tabs)/reflect',
        params: { 
          date: reflection.entryDate,
          reflectionId: reflection.id
        }
      });
    }
    // Transactions are not clickable (no detail screen)
  };

  const screenTitle = currencyName ? `${currencyName} History` : 'Currency History';
  const totalEntries = entries.length;
  const reflectionCount = entries.filter(e => e.type === 'reflection').length;
  const transactionCount = entries.filter(e => e.type === 'transaction').length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: screenTitle,
            headerShown: true,
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: screenTitle,
          headerShown: true,
        }}
      />
      
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="sparkles"
              android_material_icon_name="auto-awesome"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyStateTitle}>No entries found</Text>
            <Text style={styles.emptyStateText}>
              No reflections or transactions have affected this currency yet.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              All entries affecting {currencyName}
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalEntries}</Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{reflectionCount}</Text>
                <Text style={styles.statLabel}>Reflections</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{transactionCount}</Text>
                <Text style={styles.statLabel}>Transactions</Text>
              </View>
            </View>
            <Text style={styles.helperText}>
              Tap reflections to view full details • Sorted by most recent
            </Text>
            
            {entries.map((entry, index) => {
              if (entry.type === 'reflection') {
                const reflection = entry as CurrencyReflection;
                const dateText = formatDate(reflection.entryDate);
                const outcomeText = reflection.outcome ? 
                  (reflection.outcome === 'success' ? 'Success' : 'Struggled') : 
                  null;
                
                const currencyChangeAmount = reflection.currencyChange?.amount || 0;
                const currencyChangeOperation = reflection.currencyChange?.operation || 'add';
                const currencyChangeText = `${currencyChangeOperation === 'add' ? '+' : '-'}${currencyChangeAmount} ${currencySymbol}`;
                const currencyChangeColor = currencyChangeOperation === 'add' ? colors.success : colors.error;
                
                return (
                  <React.Fragment key={`reflection-${index}`}>
                    <TouchableOpacity 
                      style={styles.entryCard}
                      onPress={() => handleReflectionPress(reflection)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.entryTypeIndicator}>
                        <IconSymbol
                          ios_icon_name="note.text"
                          android_material_icon_name="description"
                          size={20}
                          color={colors.primary}
                        />
                        <Text style={styles.entryTypeText}>Reflection</Text>
                      </View>
                      
                      <View style={styles.entryHeader}>
                        <Text style={styles.entryDate}>{dateText}</Text>
                        {reflection.outcome && (
                          <View style={[styles.outcomeBadge, reflection.outcome === 'success' ? styles.outcomeBadgeSuccess : styles.outcomeBadgeStruggle]}>
                            <Text style={styles.outcomeBadgeText}>{outcomeText}</Text>
                          </View>
                        )}
                      </View>
                      
                      {reflection.linkedGoalTitle && (
                        <View style={styles.linkedGoalSection}>
                          <IconSymbol
                            ios_icon_name="target"
                            android_material_icon_name="flag"
                            size={16}
                            color={colors.primary}
                          />
                          <Text style={styles.linkedGoalText}>{reflection.linkedGoalTitle}</Text>
                        </View>
                      )}
                      
                      <Text style={styles.entryDescription} numberOfLines={3}>
                        {reflection.description}
                      </Text>
                      
                      {reflection.currencyChange && (
                        <View style={styles.currencyChangeSection}>
                          <Text style={[styles.currencyChangeText, { color: currencyChangeColor }]}>
                            {currencyChangeText}
                          </Text>
                        </View>
                      )}
                      
                      <View style={styles.viewDetailsRow}>
                        <Text style={styles.viewDetailsText}>Tap to view full reflection</Text>
                        <IconSymbol
                          ios_icon_name="chevron.right"
                          android_material_icon_name="arrow-forward"
                          size={16}
                          color={colors.primary}
                        />
                      </View>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              } else {
                // Transaction entry
                const transaction = entry as CurrencyTransaction;
                const dateText = formatDate(transaction.entryDate);
                const isClaim = transaction.transactionType === 'claim';
                const amountText = `${isClaim ? '+' : '-'}${Math.abs(transaction.amount)} ${currencySymbol}`;
                const amountColor = isClaim ? colors.success : colors.error;
                const iconName = isClaim ? 'download' : 'upload';
                const iosIconName = isClaim ? 'arrow.down.circle.fill' : 'arrow.up.circle.fill';
                
                return (
                  <React.Fragment key={`transaction-${index}`}>
                    <View style={[styles.entryCard, styles.transactionCard]}>
                      <View style={styles.entryTypeIndicator}>
                        <IconSymbol
                          ios_icon_name={iosIconName}
                          android_material_icon_name={iconName}
                          size={20}
                          color={amountColor}
                        />
                        <Text style={[styles.entryTypeText, { color: amountColor }]}>
                          {isClaim ? 'Claimed' : 'Paid'}
                        </Text>
                      </View>
                      
                      <View style={styles.entryHeader}>
                        <Text style={styles.entryDate}>{dateText}</Text>
                      </View>
                      
                      <Text style={styles.entryDescription}>
                        {transaction.description}
                      </Text>
                      
                      <View style={styles.currencyChangeSection}>
                        <Text style={[styles.currencyChangeText, styles.transactionAmount, { color: amountColor }]}>
                          {amountText}
                        </Text>
                      </View>
                    </View>
                  </React.Fragment>
                );
              }
            })}
          </>
        )}
      </ScrollView>

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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  helperText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
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
  entryCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
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
  transactionCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  entryTypeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  entryTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  entryDate: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  outcomeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  outcomeBadgeSuccess: {
    backgroundColor: colors.success + '20',
  },
  outcomeBadgeStruggle: {
    backgroundColor: colors.error + '20',
  },
  outcomeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  linkedGoalSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    backgroundColor: colors.primary + '10',
    padding: 8,
    borderRadius: 8,
  },
  linkedGoalText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  entryDescription: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  currencyChangeSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginBottom: 8,
  },
  currencyChangeText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  transactionAmount: {
    fontSize: 20,
  },
  viewDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  viewDetailsText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertModal: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
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
});
