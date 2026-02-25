
import React, { useState, useCallback } from 'react';
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
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete, getBearerToken, BACKEND_URL } from '@/utils/api';
import { ConfirmModal } from '@/components/ConfirmModal';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

interface MitzvahCategory {
  id: string;
  name: string;
  description?: string;
  displayOrder: number;
  isSystem: boolean;
}

interface Mitzvah {
  id: string;
  title: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  type: 'RESTRAINING' | 'PROACTIVE';
  status: 'ACTIVE' | 'DEACTIVATED';
  isSystem: boolean;
}

export default function MitzvotScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [mitzvot, setMitzvot] = useState<Mitzvah[]>([]);
  const [categories, setCategories] = useState<MitzvahCategory[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Mitzvah | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState('');
  const [deleteItemName, setDeleteItemName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'ACTIVE' | 'DEACTIVATED'>('ACTIVE');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importStatus, setImportStatus] = useState<{ totalSystemMitzvot: number; userHasImported: boolean; systemMitzvotAvailable: boolean } | null>(null);
  const [importing, setImporting] = useState(false);
  const [initializingSystem, setInitializingSystem] = useState(false);

  useFocusEffect(useCallback(() => { loadData(); loadImportStatus(); }, []));

  const loadData = async () => {
    console.log('[Mitzvot] Loading data...');
    setLoading(true);
    try {
      const [mitzvotRes, categoriesRes] = await Promise.all([
        authenticatedGet('/api/mitzvot'),
        authenticatedGet('/api/mitzvot-categories'),
      ]);
      setMitzvot(Array.isArray(mitzvotRes) ? mitzvotRes : (mitzvotRes?.data || []));
      setCategories(Array.isArray(categoriesRes) ? categoriesRes : (categoriesRes?.data || []));
    } catch (error) {
      showError('Failed to load mitzvot data');
    } finally {
      setLoading(false);
    }
  };

  const loadImportStatus = async () => {
    try {
      console.log('[Mitzvot] Loading import status...');
      const status = await authenticatedGet<{ totalSystemMitzvot: number; userHasImported: boolean; systemMitzvotAvailable?: boolean }>('/api/mitzvot/import-status');
      // Ensure systemMitzvotAvailable is always a boolean (handle older backend versions)
      setImportStatus({
        totalSystemMitzvot: status.totalSystemMitzvot ?? 0,
        userHasImported: status.userHasImported ?? false,
        systemMitzvotAvailable: status.systemMitzvotAvailable ?? true,
      });
    } catch (error) {
      console.log('[Mitzvot] Failed to load import status:', error);
      // Default to showing the initialize option if status check fails
      setImportStatus({ totalSystemMitzvot: 0, userHasImported: false, systemMitzvotAvailable: true });
    }
  };

  const showError = (msg: string) => { setErrorMessage(msg); setShowErrorModal(true); };
  const showSuccess = (msg: string) => { setSuccessMessage(msg); setShowSuccessModal(true); setTimeout(() => setShowSuccessModal(false), 2000); };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ title: '', description: '', categoryId: '', type: 'PROACTIVE', status: 'ACTIVE' });
    setShowModal(true);
  };

  const openEditModal = (item: Mitzvah) => {
    setEditingItem(item);
    setFormData({ title: item.title, description: item.description || '', categoryId: item.categoryId || '', type: item.type, status: item.status });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.title?.trim()) { showError('Title is required'); return; }
    try {
      setLoading(true);
      const payload = { title: formData.title.trim(), description: formData.description?.trim() || undefined, categoryId: formData.categoryId || undefined, type: formData.type || 'PROACTIVE', status: formData.status || 'ACTIVE' };
      if (editingItem) {
        await authenticatedPut(`/api/mitzvot/${editingItem.id}`, payload);
        showSuccess('Mitzvah updated');
      } else {
        await authenticatedPost('/api/mitzvot', payload);
        showSuccess('Mitzvah created');
      }
      setShowModal(false);
      await loadData();
    } catch (error: any) {
      showError(error.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (id: string, name: string) => { setDeleteItemId(id); setDeleteItemName(name); setShowConfirmDelete(true); };

  const handleDelete = async () => {
    try {
      setLoading(true);
      setShowConfirmDelete(false);
      await authenticatedDelete(`/api/mitzvot/${deleteItemId}`);
      showSuccess('Mitzvah deleted');
      await loadData();
    } catch (error: any) {
      showError(error.message || 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (item: Mitzvah) => {
    try {
      const newStatus = item.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
      await authenticatedPut(`/api/mitzvot/${item.id}`, { status: newStatus });
      showSuccess(`Mitzvah ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`);
      await loadData();
    } catch (error: any) {
      showError(error.message || 'Failed to update status');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      console.log('[Mitzvot] Downloading CSV template...');
      const templateHeaders = 'title,description,mitzvah_number,source,hebrew_name,type,applies_to,location,time_period,category_name,schedule_type';
      const templateExample = 'Love your neighbor as yourself,Treat others with kindness and respect,1,Leviticus 19:18,ואהבת לרעך כמוך,PROACTIVE,All Jews,Everywhere,Always,Interpersonal Mitzvot,always';

      const csvContent = `${templateHeaders}\n${templateExample}\n`;

      if (Platform.OS === 'web') {
        // Web: trigger download via anchor element
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'mitzvot_template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showSuccess('Template downloaded!');
      } else {
        // Native: write to cache directory
        const fileUri = `${FileSystem.cacheDirectory}mitzvot_template.csv`;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
        showSuccess(`Template saved to: ${fileUri}`);
      }
    } catch (error: any) {
      console.error('[Mitzvot] Template download error:', error);
      showError(error.message || 'Failed to download template');
    }
  };

  const handleInitializeSystemMitzvot = async () => {
    try {
      console.log('[Mitzvot] Initializing system mitzvot from pre-uploaded CSV...');
      setInitializingSystem(true);
      setShowImportModal(false);

      const result = await authenticatedPost('/api/mitzvot/initialize-system', {});
      console.log('[Mitzvot] Initialize result:', result);

      const importedCount = result.imported || 0;
      const skippedCount = result.skipped || 0;
      const errors = result.errors || [];

      let message = '';
      if (importedCount > 0) {
        message = `Successfully initialized ${importedCount} system mitzvot!`;
      } else if (skippedCount > 0) {
        message = `System mitzvot already initialized (${skippedCount} existing)`;
      }

      if (errors.length > 0) {
        message += `\n\nWarnings:\n${errors.slice(0, 3).join('\n')}`;
        if (errors.length > 3) {
          message += `\n...and ${errors.length - 3} more`;
        }
      }

      showSuccess(message);
      await loadData();
      await loadImportStatus();
    } catch (error: any) {
      console.error('[Mitzvot] Initialize system mitzvot error:', error);
      showError(error.message || 'Failed to initialize system mitzvot');
    } finally {
      setInitializingSystem(false);
    }
  };

  const handleImportCSV = async () => {
    try {
      console.log('[Mitzvot] Opening document picker...');
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        console.log('[Mitzvot] User cancelled document picker');
        return;
      }

      const file = result.assets[0];
      console.log('[Mitzvot] Selected file:', file.name, file.size, 'bytes');

      if (!file.uri) {
        showError('Failed to read file');
        return;
      }

      // Check file size (max 5MB)
      if (file.size && file.size > 5 * 1024 * 1024) {
        showError('File is too large. Maximum size is 5MB.');
        return;
      }

      setImporting(true);
      setShowImportModal(false);

      // Read file content
      const fileContent = await FileSystem.readAsStringAsync(file.uri);
      console.log('[Mitzvot] File content length:', fileContent.length);

      // Create FormData for multipart upload
      const formData = new FormData();
      
      // For web, we need to create a Blob
      if (Platform.OS === 'web') {
        const blob = new Blob([fileContent], { type: 'text/csv' });
        formData.append('file', blob, file.name);
      } else {
        // For native, use the file URI
        formData.append('file', {
          uri: file.uri,
          type: 'text/csv',
          name: file.name,
        } as any);
      }

      console.log('[Mitzvot] Uploading CSV to /api/mitzvot/import-csv...');
      const token = await getBearerToken();
      if (!token) {
        throw new Error('Authentication token not found. Please sign in.');
      }

      const response = await fetch(`${BACKEND_URL}/api/mitzvot/import-csv`, {
        method: 'POST',
        headers: {
          // Note: Don't set Content-Type for FormData — browser/fetch sets it with boundary automatically
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Import failed' }));
        throw new Error(errorData.message || `Import failed with status ${response.status}`);
      }

      const result_data = await response.json();
      console.log('[Mitzvot] Import result:', result_data);

      const importedCount = result_data.imported || 0;
      const skippedCount = result_data.skipped || 0;
      const errors = result_data.errors || [];

      let message = `Successfully imported ${importedCount} mitzvot`;
      if (skippedCount > 0) {
        message += `, skipped ${skippedCount} duplicates`;
      }
      if (errors.length > 0) {
        message += `\n\nWarnings:\n${errors.slice(0, 3).join('\n')}`;
        if (errors.length > 3) {
          message += `\n...and ${errors.length - 3} more`;
        }
      }

      showSuccess(message);
      await loadData();
      await loadImportStatus();
    } catch (error: any) {
      console.error('[Mitzvot] Import error:', error);
      showError(error.message || 'Failed to import CSV file');
    } finally {
      setImporting(false);
    }
  };

  const filteredMitzvot = mitzvot.filter(m => filterStatus === 'all' || m.status === filterStatus);

  const groupedByCategory: Record<string, Mitzvah[]> = {};
  filteredMitzvot.forEach(m => {
    const catName = m.categoryName || 'Uncategorized';
    if (!groupedByCategory[catName]) groupedByCategory[catName] = [];
    groupedByCategory[catName].push(m);
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mitzvot</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setShowImportModal(true)} style={styles.headerButton}>
              <IconSymbol ios_icon_name="arrow.down.doc.fill" android_material_icon_name="file-download" size={22} color={colors.accent} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/mitzvot-categories' as any)} style={styles.headerButton}>
              <IconSymbol ios_icon_name="tag.fill" android_material_icon_name="label" size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={openAddModal} style={styles.headerButton}>
              <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            {(['ACTIVE', 'DEACTIVATED', 'all'] as const).map((status) => (
              <TouchableOpacity key={status} style={[styles.filterChip, filterStatus === status && styles.filterChipActive]} onPress={() => setFilterStatus(status)}>
                <Text style={[styles.filterChipText, filterStatus === status && styles.filterChipTextActive]}>
                  {status === 'all' ? 'All' : status === 'ACTIVE' ? 'Active' : 'Deactivated'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading && mitzvot.length === 0 ? (
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
            {filteredMitzvot.length === 0 ? (
              <View style={styles.emptyState}>
                <IconSymbol ios_icon_name="star.fill" android_material_icon_name="star" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyStateTitle}>No Mitzvot Yet</Text>
                <Text style={styles.emptyStateText}>Tap + to add mitzvot or manage categories with the tag icon.</Text>
              </View>
            ) : (
              Object.entries(groupedByCategory).map(([categoryName, items]) => (
                <View key={categoryName} style={styles.categorySection}>
                  <Text style={styles.categoryTitle}>{categoryName}</Text>
                  {items.map((item) => (
                    <View key={item.id} style={[styles.mitzvahCard, item.status === 'DEACTIVATED' && styles.mitzvahCardDeactivated]}>
                      <View style={styles.mitzvahHeader}>
                        <View style={styles.mitzvahTitleRow}>
                          <IconSymbol
                            ios_icon_name={item.type === 'PROACTIVE' ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
                            android_material_icon_name={item.type === 'PROACTIVE' ? 'check-circle' : 'cancel'}
                            size={18}
                            color={item.type === 'PROACTIVE' ? colors.success : colors.error}
                          />
                          <Text style={styles.mitzvahTitle}>{item.title}</Text>
                          {item.isSystem && <View style={styles.systemBadge}><Text style={styles.systemBadgeText}>System</Text></View>}
                        </View>
                        <View style={styles.mitzvahActions}>
                          <TouchableOpacity onPress={() => handleToggleStatus(item)} style={styles.iconButton}>
                            <IconSymbol ios_icon_name="power" android_material_icon_name="power-settings-new" size={18} color={item.status === 'ACTIVE' ? colors.primary : colors.textSecondary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => openEditModal(item)} style={styles.iconButton}>
                            <IconSymbol ios_icon_name="pencil" android_material_icon_name="edit" size={18} color={colors.primary} />
                          </TouchableOpacity>
                          {!item.isSystem && (
                            <TouchableOpacity onPress={() => confirmDelete(item.id, item.title)} style={styles.iconButton}>
                              <IconSymbol ios_icon_name="trash" android_material_icon_name="delete" size={18} color={colors.error} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      {item.description ? <Text style={styles.mitzvahDescription}>{item.description}</Text> : null}
                      <View style={styles.mitzvahMeta}>
                        <View style={[styles.typeBadge, item.type === 'PROACTIVE' ? styles.typeBadgeProactive : styles.typeBadgeRestraining]}>
                          <Text style={styles.typeBadgeText}>{item.type === 'PROACTIVE' ? 'Proactive' : 'Restraining'}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Mitzvah' : 'Add Mitzvah'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <IconSymbol ios_icon_name="xmark" android_material_icon_name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Title *</Text>
                <TextInput style={styles.input} value={formData.title || ''} onChangeText={(t) => setFormData({ ...formData, title: t })} placeholder="Mitzvah title" placeholderTextColor={colors.textSecondary} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput style={[styles.input, styles.textArea]} value={formData.description || ''} onChangeText={(t) => setFormData({ ...formData, description: t })} placeholder="Describe this mitzvah..." placeholderTextColor={colors.textSecondary} multiline numberOfLines={3} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity style={[styles.catChip, !formData.categoryId && styles.catChipSelected]} onPress={() => setFormData({ ...formData, categoryId: '' })}>
                    <Text style={[styles.catChipText, !formData.categoryId && styles.catChipTextSelected]}>None</Text>
                  </TouchableOpacity>
                  {categories.map((cat) => (
                    <TouchableOpacity key={cat.id} style={[styles.catChip, formData.categoryId === cat.id && styles.catChipSelected]} onPress={() => setFormData({ ...formData, categoryId: cat.id })}>
                      <Text style={[styles.catChipText, formData.categoryId === cat.id && styles.catChipTextSelected]}>{cat.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Type *</Text>
                <View style={styles.typeSelector}>
                  <TouchableOpacity style={[styles.typeButton, formData.type === 'PROACTIVE' && styles.typeButtonProactive]} onPress={() => setFormData({ ...formData, type: 'PROACTIVE' })}>
                    <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={18} color={formData.type === 'PROACTIVE' ? colors.background : colors.success} />
                    <Text style={[styles.typeButtonText, formData.type === 'PROACTIVE' && styles.typeButtonTextSelected]}>Proactive</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.typeButton, formData.type === 'RESTRAINING' && styles.typeButtonRestraining]} onPress={() => setFormData({ ...formData, type: 'RESTRAINING' })}>
                    <IconSymbol ios_icon_name="xmark.circle.fill" android_material_icon_name="cancel" size={18} color={formData.type === 'RESTRAINING' ? colors.background : colors.error} />
                    <Text style={[styles.typeButtonText, formData.type === 'RESTRAINING' && styles.typeButtonTextSelected]}>Restraining</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary]} onPress={() => setShowModal(false)}>
                <Text style={styles.buttonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={handleSave} disabled={loading}>
                {loading ? <ActivityIndicator color={colors.background} /> : <Text style={styles.buttonPrimaryText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmModal visible={showConfirmDelete} title="Delete Mitzvah" message={`Delete "${deleteItemName}"? This cannot be undone.`} onConfirm={handleDelete} onCancel={() => setShowConfirmDelete(false)} />

      <Modal visible={showErrorModal} transparent animationType="fade" onRequestClose={() => setShowErrorModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.alertModal}>
            <Text style={styles.alertTitle}>Error</Text>
            <Text style={styles.alertMessage}>{errorMessage}</Text>
            <TouchableOpacity style={styles.alertButton} onPress={() => setShowErrorModal(false)}><Text style={styles.alertButtonText}>OK</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={() => setShowSuccessModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={48} color={colors.success} />
            <Text style={styles.successModalText}>{successMessage}</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={showImportModal} transparent animationType="slide" onRequestClose={() => setShowImportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.importModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Import Mitzvot from CSV</Text>
              <TouchableOpacity onPress={() => setShowImportModal(false)}>
                <IconSymbol ios_icon_name="xmark" android_material_icon_name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.importModalBody}>
              {/* System Mitzvot Section - shown when available */}
              {importStatus?.systemMitzvotAvailable && (
                <View style={[styles.systemImportCard, importStatus.userHasImported && styles.systemImportCardDone]}>
                  <View style={styles.systemImportHeader}>
                    <IconSymbol
                      ios_icon_name={importStatus.userHasImported ? 'checkmark.seal.fill' : 'star.fill'}
                      android_material_icon_name={importStatus.userHasImported ? 'verified' : 'star'}
                      size={24}
                      color={importStatus.userHasImported ? colors.success : colors.primary}
                    />
                    <Text style={styles.systemImportTitle}>
                      {importStatus.userHasImported ? 'System Mitzvot Initialized' : 'Initialize System Mitzvot'}
                    </Text>
                  </View>
                  {importStatus.userHasImported ? (
                    <>
                      <Text style={styles.systemImportText}>
                        You have {importStatus.totalSystemMitzvot} system mitzvot loaded. You can edit, delete, or add more mitzvot from the main list.
                      </Text>
                      <View style={styles.importWarning}>
                        <IconSymbol ios_icon_name="checkmark.circle.fill" android_material_icon_name="check-circle" size={18} color={colors.success} />
                        <Text style={styles.importWarningText}>
                          {importStatus.totalSystemMitzvot} system mitzvot are active in your account
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.systemImportText}>
                        Load the pre-configured Mitzvot from the system database. These will be added to your account and you can edit, delete, or add to them.
                      </Text>
                      <TouchableOpacity
                        style={styles.systemImportButton}
                        onPress={handleInitializeSystemMitzvot}
                        disabled={initializingSystem}
                      >
                        {initializingSystem ? (
                          <ActivityIndicator color={colors.background} />
                        ) : (
                          <>
                            <IconSymbol ios_icon_name="sparkles" android_material_icon_name="auto-awesome" size={20} color={colors.background} />
                            <Text style={styles.systemImportButtonText}>Initialize System Mitzvot</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}

              {/* Show info card when system mitzvot not available and user hasn't imported */}
              {!importStatus?.systemMitzvotAvailable && !importStatus?.userHasImported && (
                <View style={styles.importInfoCard}>
                  <IconSymbol ios_icon_name="info.circle.fill" android_material_icon_name="info" size={32} color={colors.accent} />
                  <Text style={styles.importInfoTitle}>Import Mitzvot</Text>
                  <Text style={styles.importInfoText}>
                    Upload your own CSV file with mitzvot data, or contact your administrator to set up system mitzvot.
                  </Text>
                </View>
              )}

              {/* Divider between system and custom import */}
              {importStatus?.systemMitzvotAvailable && (
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>
              )}

              <View style={styles.customImportSection}>
                <Text style={styles.customImportTitle}>Import Custom CSV</Text>
                <Text style={styles.customImportText}>
                  Upload your own CSV file with mitzvot data. Download the template to see the required format.
                </Text>
                <TouchableOpacity style={styles.templateButton} onPress={handleDownloadTemplate}>
                  <IconSymbol ios_icon_name="arrow.down.circle.fill" android_material_icon_name="download" size={20} color={colors.accent} />
                  <Text style={styles.templateButtonText}>Download CSV Template</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.importButton} onPress={handleImportCSV} disabled={importing}>
                  {importing ? (
                    <ActivityIndicator color={colors.background} />
                  ) : (
                    <>
                      <IconSymbol ios_icon_name="doc.badge.plus" android_material_icon_name="note-add" size={24} color={colors.background} />
                      <Text style={styles.importButtonText}>Select CSV File</Text>
                    </>
                  )}
                </TouchableOpacity>
                <Text style={styles.importNote}>Maximum file size: 5MB</Text>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {(importing || initializingSystem) && (
        <View style={styles.importingOverlay}>
          <View style={styles.importingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.importingText}>
              {initializingSystem ? 'Initializing system mitzvot...' : 'Importing mitzvot...'}
            </Text>
            <Text style={styles.importingSubtext}>This may take a moment</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: colors.text },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerButton: { padding: 4 },
  filterBar: { paddingHorizontal: 20, marginBottom: 8 },
  filterScroll: { gap: 8, paddingVertical: 4 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 13, color: colors.text, fontWeight: '500' },
  filterChipTextActive: { color: colors.background, fontWeight: '600' },
  listContainer: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyStateTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  emptyStateText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 20 },
  categorySection: { marginBottom: 20 },
  categoryTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  mitzvahCard: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  mitzvahCardDeactivated: { opacity: 0.5 },
  mitzvahHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  mitzvahTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  mitzvahTitle: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  systemBadge: { backgroundColor: colors.accent + '30', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  systemBadgeText: { fontSize: 10, color: colors.accent, fontWeight: '600' },
  mitzvahActions: { flexDirection: 'row', gap: 4 },
  iconButton: { padding: 6 },
  mitzvahDescription: { fontSize: 13, color: colors.textSecondary, marginBottom: 8, lineHeight: 18 },
  mitzvahMeta: { flexDirection: 'row', gap: 6 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeProactive: { backgroundColor: colors.success + '20' },
  typeBadgeRestraining: { backgroundColor: colors.error + '20' },
  typeBadgeText: { fontSize: 11, fontWeight: '600', color: colors.text },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: colors.background, borderRadius: 16, width: '100%', maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  modalBody: { padding: 20 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: colors.border },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 8 },
  input: { backgroundColor: colors.card, borderRadius: 10, padding: 14, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  catChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  catChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { fontSize: 13, color: colors.text },
  catChipTextSelected: { color: colors.background, fontWeight: '600' },
  typeSelector: { flexDirection: 'row', gap: 12 },
  typeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  typeButtonProactive: { backgroundColor: colors.success, borderColor: colors.success },
  typeButtonRestraining: { backgroundColor: colors.error, borderColor: colors.error },
  typeButtonText: { fontSize: 14, fontWeight: '600', color: colors.text },
  typeButtonTextSelected: { color: colors.background },
  button: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonPrimaryText: { color: colors.background, fontSize: 16, fontWeight: '600' },
  buttonSecondaryText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  alertModal: { backgroundColor: colors.background, borderRadius: 16, padding: 24, width: '80%', maxWidth: 400 },
  alertTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 12 },
  alertMessage: { fontSize: 15, color: colors.textSecondary, marginBottom: 20 },
  alertButton: { backgroundColor: colors.primary, padding: 14, borderRadius: 12, alignItems: 'center' },
  alertButtonText: { color: colors.background, fontSize: 15, fontWeight: '600' },
  successModal: { backgroundColor: colors.background, borderRadius: 20, padding: 32, alignItems: 'center', gap: 16 },
  successModalText: { fontSize: 16, fontWeight: '600', color: colors.text, textAlign: 'center' },
  importModalContent: { backgroundColor: colors.background, borderRadius: 16, width: '100%', maxWidth: 500 },
  importModalBody: { padding: 20 },
  importInfoCard: { backgroundColor: colors.card, borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: colors.border },
  importInfoTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginTop: 12, marginBottom: 8 },
  importInfoText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  importWarning: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.warning + '20', padding: 12, borderRadius: 8, marginTop: 12 },
  importWarningText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  templateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.accent + '50', marginBottom: 12 },
  templateButtonText: { fontSize: 14, fontWeight: '600', color: colors.accent },
  importButton: { backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16, borderRadius: 12, marginBottom: 8 },
  importButtonText: { fontSize: 16, fontWeight: '600', color: colors.background },
  importNote: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  importingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  importingCard: { backgroundColor: colors.background, borderRadius: 16, padding: 32, alignItems: 'center', gap: 16, minWidth: 200 },
  importingText: { fontSize: 18, fontWeight: '600', color: colors.text },
  importingSubtext: { fontSize: 14, color: colors.textSecondary },
  systemImportCard: { backgroundColor: colors.primary + '15', borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 2, borderColor: colors.primary + '40' },
  systemImportCardDone: { backgroundColor: colors.success + '15', borderColor: colors.success + '40' },
  systemImportHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  systemImportTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  systemImportText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 16 },
  systemImportButton: { backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14, borderRadius: 10 },
  systemImportButtonText: { fontSize: 15, fontWeight: '600', color: colors.background },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: 12, fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  customImportSection: { marginTop: 8 },
  customImportTitle: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 8 },
  customImportText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 16 },
});
