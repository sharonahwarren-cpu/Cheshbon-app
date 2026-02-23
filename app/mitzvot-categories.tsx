
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { authenticatedGet, authenticatedPost, authenticatedPut, authenticatedDelete } from '@/utils/api';
import { ConfirmModal } from '@/components/ConfirmModal';

interface MitzvahCategory {
  id: string;
  name: string;
  description?: string;
  displayOrder: number;
  isSystem: boolean;
}

export default function MitzvotCategoriesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<MitzvahCategory[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MitzvahCategory | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState('');
  const [deleteItemName, setDeleteItemName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await authenticatedGet('/api/mitzvot-categories');
      const data = Array.isArray(res) ? res : (res?.data || []);
      setCategories(data);
    } catch (error) {
      showError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const showError = (msg: string) => { setErrorMessage(msg); setShowErrorModal(true); };
  const showSuccess = (msg: string) => { setSuccessMessage(msg); setShowSuccessModal(true); setTimeout(() => setShowSuccessModal(false), 2000); };

  const openAddModal = () => { setEditingItem(null); setFormData({ name: '', description: '' }); setShowModal(true); };
  const openEditModal = (item: MitzvahCategory) => { setEditingItem(item); setFormData({ name: item.name, description: item.description || '' }); setShowModal(true); };

  const handleSave = async () => {
    if (!formData.name?.trim()) { showError('Name is required'); return; }
    try {
      setLoading(true);
      const payload = { name: formData.name.trim(), description: formData.description?.trim() || undefined };
      if (editingItem) {
        await authenticatedPut(`/api/mitzvot-categories/${editingItem.id}`, payload);
        showSuccess('Category updated');
      } else {
        await authenticatedPost('/api/mitzvot-categories', payload);
        showSuccess('Category created');
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
      await authenticatedDelete(`/api/mitzvot-categories/${deleteItemId}`);
      showSuccess('Category deleted');
      await loadData();
    } catch (error: any) {
      showError(error.message || 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const systemCategories = categories.filter(c => c.isSystem);
  const userCategories = categories.filter(c => !c.isSystem);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mitzvot Categories</Text>
          <TouchableOpacity onPress={openAddModal}>
            <IconSymbol ios_icon_name="plus" android_material_icon_name="add" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
        {loading && categories.length === 0 ? (
          <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (
          <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
            {systemCategories.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>System Categories</Text>
                {systemCategories.map((cat) => (
                  <View key={cat.id} style={styles.categoryCard}>
                    <View style={styles.categoryContent}>
                      <Text style={styles.categoryName}>{cat.name}</Text>
                      {cat.description ? <Text style={styles.categoryDescription}>{cat.description}</Text> : null}
                      <View style={styles.systemBadge}><Text style={styles.systemBadgeText}>System</Text></View>
                    </View>
                    <TouchableOpacity onPress={() => openEditModal(cat)} style={styles.iconButton}>
                      <IconSymbol ios_icon_name="pencil" android_material_icon_name="edit" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
            {userCategories.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>My Categories</Text>
                {userCategories.map((cat) => (
                  <View key={cat.id} style={styles.categoryCard}>
                    <View style={styles.categoryContent}>
                      <Text style={styles.categoryName}>{cat.name}</Text>
                      {cat.description ? <Text style={styles.categoryDescription}>{cat.description}</Text> : null}
                    </View>
                    <View style={styles.actions}>
                      <TouchableOpacity onPress={() => openEditModal(cat)} style={styles.iconButton}>
                        <IconSymbol ios_icon_name="pencil" android_material_icon_name="edit" size={18} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => confirmDelete(cat.id, cat.name)} style={styles.iconButton}>
                        <IconSymbol ios_icon_name="trash" android_material_icon_name="delete" size={18} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}
            {categories.length === 0 && (
              <View style={styles.emptyState}>
                <IconSymbol ios_icon_name="tag.fill" android_material_icon_name="label" size={48} color={colors.textSecondary} />
                <Text style={styles.emptyStateTitle}>No Categories Yet</Text>
                <Text style={styles.emptyStateText}>Tap + to add a category for organizing your mitzvot.</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Category' : 'Add Category'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <IconSymbol ios_icon_name="xmark" android_material_icon_name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Name *</Text>
                <TextInput style={styles.input} value={formData.name || ''} onChangeText={(t) => setFormData({ ...formData, name: t })} placeholder="Category name" placeholderTextColor={colors.textSecondary} />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput style={[styles.input, styles.textArea]} value={formData.description || ''} onChangeText={(t) => setFormData({ ...formData, description: t })} placeholder="Optional description..." placeholderTextColor={colors.textSecondary} multiline numberOfLines={3} />
              </View>
            </View>
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
      <ConfirmModal visible={showConfirmDelete} title="Delete Category" message={`Delete "${deleteItemName}"?`} onConfirm={handleDelete} onCancel={() => setShowConfirmDelete(false)} />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: colors.text },
  listContainer: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 100 },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  categoryCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  categoryContent: { flex: 1, marginRight: 8 },
  categoryName: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
  categoryDescription: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },
  systemBadge: { alignSelf: 'flex-start', backgroundColor: colors.accent + '30', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  systemBadgeText: { fontSize: 10, color: colors.accent, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 4 },
  iconButton: { padding: 6 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyStateTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  emptyStateText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: colors.background, borderRadius: 16, width: '100%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  modalBody: { padding: 20 },
  modalFooter: { flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: colors.border },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 8 },
  input: { backgroundColor: colors.card, borderRadius: 10, padding: 14, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
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
});
