
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

export default function CurrencyReflectionsScreen() {
  const router = useRouter();
  const { currencyId } = useLocalSearchParams<{ currencyId: string }>();
  
  const [loading, setLoading] = useState(true);
  const [reflections, setReflections] = useState<CurrencyReflection[]>([]);
  const [currencyName, setCurrencyName] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('');
  
  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);

  useEffect(() => {
    if (currencyId) {
      loadReflections();
    }
  }, [currencyId]);

  const loadReflections = async () => {
    console.log('Loading reflections for currency:', currencyId);
    setLoading(true);
    try {
      const response = await authenticatedGet(`/api/reports/currency-reflections/${currencyId}`);
      const reflectionsData = Array.isArray(response) ? response : (response?.data || []);
      
      setReflections(reflectionsData);
      
      if (reflectionsData.length > 0 && reflectionsData[0].currencyChange) {
        const currencyNameValue = reflectionsData[0].currencyChange.currencyName || '';
        const currencySymbolValue = reflectionsData[0].currencyChange.currencySymbol || '';
        setCurrencyName(currencyNameValue);
        setCurrencySymbol(currencySymbolValue);
      } else {
        const currencyRes = await authenticatedGet(`/api/currencies/${currencyId}`);
        const currencyData = currencyRes?.data || currencyRes;
        const currencyNameValue = currencyData.name || 'Currency';
        const currencySymbolValue = currencyData.symbol || '';
        setCurrencyName(currencyNameValue);
        setCurrencySymbol(currencySymbolValue);
      }
      
      console.log('Currency reflections loaded:', reflectionsData.length);
    } catch (error: any) {
      console.error('Error loading currency reflections:', error);
      showError(error.message || 'Failed to load reflections');
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
    const options: Intl.DateTimeFormatOptions = { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    };
    return date.toLocaleDateString('en-US', options);
  };

  const handleReflectionPress = (reflection: CurrencyReflection) => {
    console.log('Navigating to reflection date:', reflection.entryDate);
    router.push({
      pathname: '/(tabs)/reflect',
      params: { date: reflection.entryDate }
    });
  };

  const screenTitle = currencyName ? `${currencyName} Reflections` : 'Currency Reflections';

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
        {reflections.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol
              ios_icon_name="sparkles"
              android_material_icon_name="auto-awesome"
              size={64}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyStateTitle}>No reflections found</Text>
            <Text style={styles.emptyStateText}>
              No reflections have affected this currency yet.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              Reflections affecting {currencyName}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {reflections.length} {reflections.length === 1 ? 'reflection' : 'reflections'}
            </Text>
            <Text style={styles.helperText}>
              Tap any reflection to view full details
            </Text>
            
            {reflections.map((reflection, index) => {
              const dateText = formatDate(reflection.entryDate);
              const outcomeText = reflection.outcome ? 
                (reflection.outcome === 'success' ? 'Success' : 'Struggled') : 
                null;
              
              const currencyChangeAmount = reflection.currencyChange?.amount || 0;
              const currencyChangeOperation = reflection.currencyChange?.operation || 'add';
              const currencyChangeText = `${currencyChangeOperation === 'add' ? '+' : '-'}${currencyChangeAmount} ${currencySymbol}`;
              const currencyChangeColor = currencyChangeOperation === 'add' ? colors.success : colors.error;
              
              return (
                <React.Fragment key={index}>
                  <TouchableOpacity 
                    style={styles.reflectionCard}
                    onPress={() => handleReflectionPress(reflection)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.reflectionHeader}>
                      <Text style={styles.reflectionDate}>{dateText}</Text>
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
                    
                    <Text style={styles.reflectionDescription} numberOfLines={3}>
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
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
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
  reflectionCard: {
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
  reflectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reflectionDate: {
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
  reflectionDescription: {
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
