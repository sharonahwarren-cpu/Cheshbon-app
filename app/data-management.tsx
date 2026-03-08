
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { useAuth } from '@/contexts/AuthContext';
import { ConfirmModal } from '@/components/ConfirmModal';
import { authenticatedDelete } from '@/utils/api';
import { DatePickerModal } from '@/components/DatePickerModal';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

type DataType = 'all' | 'journals' | 'reflections' | 'goals' | 'strategies' | 'currencies' | 'life-areas';
type ExportFormat = 'csv' | 'pdf';

export default function DataManagementScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  // Download state
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [selectedDataType, setSelectedDataType] = useState<DataType>('all');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Delete state
  const [showDeleteDataModal, setShowDeleteDataModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');

  const dataTypeOptions: { value: DataType; label: string }[] = [
    { value: 'all', label: 'All Data' },
    { value: 'journals', label: 'Journals' },
    { value: 'reflections', label: 'Reflections' },
    { value: 'goals', label: 'Goals' },
    { value: 'strategies', label: 'Strategies' },
    { value: 'currencies', label: 'Currencies' },
    { value: 'life-areas', label: 'Life Areas' },
  ];

  const formatOptions: { value: ExportFormat; label: string }[] = [
    { value: 'csv', label: 'CSV (Excel)' },
    { value: 'pdf', label: 'PDF' },
  ];

  const handleDownloadData = async () => {
    console.log('📥 [DATA MANAGEMENT] Starting data download...');
    console.log('📥 [DATA MANAGEMENT] Data type:', selectedDataType);
    console.log('📥 [DATA MANAGEMENT] Format:', selectedFormat);
    console.log('📥 [DATA MANAGEMENT] Start date:', startDate?.toISOString());
    console.log('📥 [DATA MANAGEMENT] End date:', endDate?.toISOString());

    setIsDownloading(true);

    try {
      const { BACKEND_URL, getBearerToken } = await import('@/utils/api');
      const token = await getBearerToken();

      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Build query parameters
      const queryParams = new URLSearchParams({
        dataType: selectedDataType,
        format: selectedFormat,
      });

      if (startDate) {
        queryParams.append('startDate', startDate.toISOString());
      }
      if (endDate) {
        queryParams.append('endDate', endDate.toISOString());
      }

      const url = `${BACKEND_URL}/api/user/data/export?${queryParams.toString()}`;
      console.log('📥 [DATA MANAGEMENT] Fetching from:', url);

      if (Platform.OS === 'web') {
        // Web: Use fetch to get blob and trigger browser download
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ [DATA MANAGEMENT] Download failed:', response.status, errorText);
          throw new Error(`Download failed: ${response.status}`);
        }

        console.log('✅ [DATA MANAGEMENT] Download response received');

        // Web: Create a blob and trigger download
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        const fileExtension = selectedFormat;
        const fileName = `cheshbon_${selectedDataType}_${new Date().toISOString().split('T')[0]}.${fileExtension}`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
        console.log('✅ [DATA MANAGEMENT] Web download triggered:', fileName);
      } else {
        // Mobile: Use FileSystem.downloadAsync for proper binary file handling
        const fileExtension = selectedFormat;
        const fileName = `cheshbon_${selectedDataType}_${new Date().toISOString().split('T')[0]}.${fileExtension}`;
        
        // Use cacheDirectory as fallback if documentDirectory is not available
        const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
        
        if (!baseDir) {
          throw new Error('File system not available on this device');
        }
        
        const fileUri = `${baseDir}${fileName}`;

        console.log('📥 [DATA MANAGEMENT] Downloading file to:', fileUri);

        const downloadResult = await FileSystem.downloadAsync(url, fileUri, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        console.log('✅ [DATA MANAGEMENT] File downloaded, status:', downloadResult.status);

        if (downloadResult.status !== 200) {
          throw new Error(`Download failed with status: ${downloadResult.status}`);
        }

        console.log('✅ [DATA MANAGEMENT] File saved to:', downloadResult.uri);

        // Share the file
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          const mimeType = selectedFormat === 'pdf' ? 'application/pdf' : 'text/csv';
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType,
            dialogTitle: `Export ${selectedDataType} data`,
          });
          console.log('✅ [DATA MANAGEMENT] File shared');
        } else {
          console.log('⚠️ [DATA MANAGEMENT] Sharing not available');
        }
      }

      setModalMessage('Your data has been downloaded successfully.');
      setShowSuccessModal(true);
      setShowDownloadOptions(false);
    } catch (error: any) {
      console.error('❌ [DATA MANAGEMENT] Download error:', error);
      setModalMessage(`Failed to download data: ${error.message || 'An unexpected error occurred.'}`);
      setShowErrorModal(true);
    } finally {
      setIsDownloading(false);
    }
  };

  const confirmDeleteData = async () => {
    console.log('🗑️ [DATA MANAGEMENT] Confirming delete all data...');
    setShowDeleteDataModal(false);
    setIsDeletingData(true);

    try {
      await authenticatedDelete('/api/user/data');
      console.log('✅ [DATA MANAGEMENT] All data deleted successfully');
      setModalMessage('All your data has been permanently deleted. Your account remains active.');
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('❌ [DATA MANAGEMENT] Delete data error:', error);
      setModalMessage(`Failed to delete data: ${error.message || 'An unexpected error occurred.'}`);
      setShowErrorModal(true);
    } finally {
      setIsDeletingData(false);
    }
  };

  const confirmDeleteAccount = async () => {
    console.log('🗑️ [DATA MANAGEMENT] Confirming delete account...');
    setShowDeleteAccountModal(false);
    setIsDeletingAccount(true);

    try {
      await authenticatedDelete('/api/user/account');
      console.log('✅ [DATA MANAGEMENT] Account deleted successfully');
      setModalMessage('Your account and all associated data have been permanently deleted. You will be signed out.');
      setShowSuccessModal(true);

      // Sign out and redirect to auth after a brief delay
      setTimeout(async () => {
        await signOut();
        router.replace('/auth');
      }, 2000);
    } catch (error: any) {
      console.error('❌ [DATA MANAGEMENT] Delete account error:', error);
      setModalMessage(`Failed to delete account: ${error.message || 'An unexpected error occurred.'}`);
      setShowErrorModal(true);
      setIsDeletingAccount(false);
    }
  };

  const formatDateDisplay = (date: Date | null): string => {
    if (!date) return 'Not set';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const startDateDisplay = formatDateDisplay(startDate);
  const endDateDisplay = formatDateDisplay(endDate);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          title: 'Data Management',
          headerShown: true,
          headerBackTitle: 'Back',
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Download Data Section */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowDownloadOptions(!showDownloadOptions)}
          >
            <View style={styles.sectionHeaderLeft}>
              <IconSymbol
                ios_icon_name="arrow.down.circle.fill"
                android_material_icon_name="download"
                size={24}
                color={colors.primary}
              />
              <Text style={styles.sectionTitle}>Download Your Data</Text>
            </View>
            <IconSymbol
              ios_icon_name={showDownloadOptions ? 'chevron.up' : 'chevron.down'}
              android_material_icon_name={showDownloadOptions ? 'expand-less' : 'expand-more'}
              size={24}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          {showDownloadOptions && (
            <View style={styles.downloadOptions}>
              {/* Data Type Selection */}
              <Text style={styles.label}>What to download:</Text>
              <View style={styles.optionGrid}>
                {dataTypeOptions.map((option) => {
                  const isSelected = selectedDataType === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
                      onPress={() => setSelectedDataType(option.value)}
                    >
                      <Text style={[styles.optionButtonText, isSelected && styles.optionButtonTextSelected]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Format Selection */}
              <Text style={styles.label}>Format:</Text>
              <View style={styles.formatRow}>
                {formatOptions.map((option) => {
                  const isSelected = selectedFormat === option.value;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.formatButton, isSelected && styles.formatButtonSelected]}
                      onPress={() => setSelectedFormat(option.value)}
                    >
                      <Text style={[styles.formatButtonText, isSelected && styles.formatButtonTextSelected]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Date Range */}
              <Text style={styles.label}>Date Range (optional):</Text>
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <Text style={styles.dateLabel}>From:</Text>
                  <Text style={styles.dateValue}>{startDateDisplay}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Text style={styles.dateLabel}>To:</Text>
                  <Text style={styles.dateValue}>{endDateDisplay}</Text>
                </TouchableOpacity>
              </View>

              {(startDate || endDate) && (
                <TouchableOpacity
                  style={styles.clearDatesButton}
                  onPress={() => {
                    setStartDate(null);
                    setEndDate(null);
                  }}
                >
                  <Text style={styles.clearDatesText}>Clear dates (download all)</Text>
                </TouchableOpacity>
              )}

              {/* Download Button */}
              <TouchableOpacity
                style={[styles.downloadButton, isDownloading && styles.downloadButtonDisabled]}
                onPress={handleDownloadData}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <IconSymbol
                      ios_icon_name="arrow.down.circle.fill"
                      android_material_icon_name="download"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.downloadButtonText}>Download</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Delete Data Section */}
        <View style={styles.card}>
          <View style={styles.dangerHeader}>
            <IconSymbol
              ios_icon_name="exclamationmark.triangle.fill"
              android_material_icon_name="warning"
              size={24}
              color="#DC2626"
            />
            <Text style={styles.dangerTitle}>Danger Zone</Text>
          </View>
          <Text style={styles.dangerDescription}>
            These actions are permanent and cannot be undone.
          </Text>

          {/* Delete All Data */}
          <TouchableOpacity
            style={[styles.dangerButton, (isDeletingData || isDeletingAccount) && styles.dangerButtonDisabled]}
            onPress={() => setShowDeleteDataModal(true)}
            disabled={isDeletingData || isDeletingAccount}
          >
            <IconSymbol
              ios_icon_name="trash.fill"
              android_material_icon_name="delete"
              size={20}
              color="#fff"
            />
            <Text style={styles.dangerButtonText}>Delete All Data</Text>
          </TouchableOpacity>
          <Text style={styles.dangerSubtext}>
            Deletes all your goals, reflections, journals, and settings. Your account will remain active.
          </Text>

          {/* Delete Account */}
          <TouchableOpacity
            style={[styles.dangerButton, styles.deleteAccountButton, (isDeletingData || isDeletingAccount) && styles.dangerButtonDisabled]}
            onPress={() => setShowDeleteAccountModal(true)}
            disabled={isDeletingData || isDeletingAccount}
          >
            <IconSymbol
              ios_icon_name="person.fill.xmark"
              android_material_icon_name="person-remove"
              size={20}
              color="#fff"
            />
            <Text style={styles.dangerButtonText}>Delete Account</Text>
          </TouchableOpacity>
          <Text style={styles.dangerSubtext}>
            Permanently deletes your account and all associated data. You will be signed out.
          </Text>
        </View>
      </ScrollView>

      {/* Date Pickers */}
      <DatePickerModal
        isVisible={showStartDatePicker}
        date={startDate || new Date()}
        onConfirm={(date) => {
          setStartDate(date);
          setShowStartDatePicker(false);
        }}
        onCancel={() => setShowStartDatePicker(false)}
        maximumDate={endDate || undefined}
      />

      <DatePickerModal
        isVisible={showEndDatePicker}
        date={endDate || new Date()}
        onConfirm={(date) => {
          setEndDate(date);
          setShowEndDatePicker(false);
        }}
        onCancel={() => setShowEndDatePicker(false)}
        minimumDate={startDate || undefined}
      />

      {/* Delete Data Confirmation Modal */}
      <ConfirmModal
        visible={showDeleteDataModal}
        title="Delete All Data"
        message="This will permanently delete ALL your data including goals, reflections, journals, and settings. Your account will remain active. This action cannot be undone. Are you absolutely sure?"
        onConfirm={confirmDeleteData}
        onCancel={() => setShowDeleteDataModal(false)}
        confirmText="Delete All Data"
        cancelText="Cancel"
        confirmButtonColor="#DC2626"
      />

      {/* Delete Account Confirmation Modal */}
      <ConfirmModal
        visible={showDeleteAccountModal}
        title="Delete Account"
        message="This will permanently delete your account and ALL associated data. You will be signed out and cannot recover your account. This action cannot be undone. Are you absolutely sure?"
        onConfirm={confirmDeleteAccount}
        onCancel={() => setShowDeleteAccountModal(false)}
        confirmText="Delete Account"
        cancelText="Cancel"
        confirmButtonColor="#991B1B"
      />

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <IconSymbol
              ios_icon_name="checkmark.circle.fill"
              android_material_icon_name="check-circle"
              size={48}
              color="#10B981"
            />
            <Text style={styles.successModalTitle}>Success</Text>
            <Text style={styles.successModalMessage}>{modalMessage}</Text>
            <TouchableOpacity
              style={styles.successModalButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.successModalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.errorModal}>
            <IconSymbol
              ios_icon_name="xmark.circle.fill"
              android_material_icon_name="error"
              size={48}
              color="#DC2626"
            />
            <Text style={styles.errorModalTitle}>Error</Text>
            <Text style={styles.errorModalMessage}>{modalMessage}</Text>
            <TouchableOpacity
              style={styles.errorModalButton}
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.errorModalButtonText}>OK</Text>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  downloadOptions: {
    marginTop: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 16,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionButtonText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  optionButtonTextSelected: {
    color: '#fff',
  },
  formatRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formatButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  formatButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  formatButtonText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  formatButtonTextSelected: {
    color: '#fff',
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  dateValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  clearDatesButton: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clearDatesText: {
    fontSize: 13,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 20,
    gap: 8,
  },
  downloadButtonDisabled: {
    opacity: 0.5,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  dangerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  dangerDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  deleteAccountButton: {
    backgroundColor: '#991B1B',
    marginTop: 20,
  },
  dangerButtonDisabled: {
    opacity: 0.5,
  },
  dangerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModal: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  successModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 12,
    marginBottom: 12,
  },
  successModalMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  successModalButton: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  successModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorModal: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  errorModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 12,
    marginBottom: 12,
  },
  errorModalMessage: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  errorModalButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 10,
    minWidth: 120,
    alignItems: 'center',
  },
  errorModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
