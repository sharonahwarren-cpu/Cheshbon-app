
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Modal, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React from "react";
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { ConfirmModal } from "@/components/ConfirmModal";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [showSignOutModal, setShowSignOutModal] = React.useState(false);
  const [showErrorModal, setShowErrorModal] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [showDeleteDataModal, setShowDeleteDataModal] = React.useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = React.useState(false);
  const [showSuccessModal, setShowSuccessModal] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleSignOut = async () => {
    console.log('🚪 [PROFILE] Sign out button pressed');
    setShowSignOutModal(true);
  };

  const confirmSignOut = async () => {
    console.log('🚪 [PROFILE] Confirming sign out...');
    setShowSignOutModal(false);
    try {
      await signOut();
      console.log('✅ [PROFILE] Sign out successful');
      router.replace('/auth');
    } catch (error: any) {
      console.error('❌ [PROFILE] Sign out error:', error);
      setErrorMessage('Failed to sign out. Please try again.');
      setShowErrorModal(true);
    }
  };

  const handleContactDeveloper = () => {
    console.log('📧 [PROFILE] Contact developer pressed');
    const emailAddress = 'cheshbon.app.me@gmail.com';
    const emailSubject = 'Cheshbon App Feedback';
    const emailBody = 'Hi,\n\nI would like to:\n[ ] Report a bug\n[ ] Provide feedback\n[ ] Suggest a feature\n\nDetails:\n';
    const mailtoUrl = `mailto:${emailAddress}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    
    Linking.openURL(mailtoUrl).catch((err) => {
      console.error('❌ [PROFILE] Failed to open email client:', err);
      setErrorMessage(`Could not open email client. Please email ${emailAddress} directly.`);
      setShowErrorModal(true);
    });
  };

  const handleDeleteData = () => {
    console.log('🗑️ [PROFILE] Delete data button pressed');
    setShowDeleteDataModal(true);
  };

  const confirmDeleteData = async () => {
    console.log('🗑️ [PROFILE] Confirming delete all data...');
    setShowDeleteDataModal(false);
    setIsDeleting(true);
    
    try {
      const { authenticatedDelete } = await import('@/utils/api');
      await authenticatedDelete('/api/user/data');
      console.log('✅ [PROFILE] All data deleted successfully');
      setSuccessMessage('All your data has been deleted successfully.');
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('❌ [PROFILE] Delete data error:', error);
      setErrorMessage('Failed to delete data. Please try again.');
      setShowErrorModal(true);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAccount = () => {
    console.log('🗑️ [PROFILE] Delete account button pressed');
    setShowDeleteAccountModal(true);
  };

  const confirmDeleteAccount = async () => {
    console.log('🗑️ [PROFILE] Confirming delete account...');
    setShowDeleteAccountModal(false);
    setIsDeleting(true);
    
    try {
      const { authenticatedDelete } = await import('@/utils/api');
      await authenticatedDelete('/api/user/account');
      console.log('✅ [PROFILE] Account deleted successfully');
      setSuccessMessage('Your account has been deleted successfully.');
      setShowSuccessModal(true);
      
      // Sign out and redirect to auth after a brief delay
      setTimeout(async () => {
        await signOut();
        router.replace('/auth');
      }, 2000);
    } catch (error: any) {
      console.error('❌ [PROFILE] Delete account error:', error);
      setErrorMessage('Failed to delete account. Please try again.');
      setShowErrorModal(true);
      setIsDeleting(false);
    }
  };

  const userInitial = user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U';
  const displayName = user?.name || 'User';
  const displayEmail = user?.email || 'Welcome to Cheshbon';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* User Info Card */}
        <View style={styles.card}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userInitial}</Text>
            </View>
          </View>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{displayEmail}</Text>
        </View>

        {/* Preferences Button */}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => {
            console.log('Navigating to Preferences');
            router.push('/preferences');
          }}
        >
          <IconSymbol
            ios_icon_name="gear"
            android_material_icon_name="settings"
            size={20}
            color={colors.primary}
          />
          <Text style={styles.menuButtonText}>Preferences</Text>
          <IconSymbol
            ios_icon_name="chevron.right"
            android_material_icon_name="chevron-right"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Sign Out Button */}
        <TouchableOpacity
          style={[styles.menuButton, styles.signOutButton]}
          onPress={handleSignOut}
        >
          <IconSymbol
            ios_icon_name="arrow.right.square"
            android_material_icon_name="logout"
            size={20}
            color="#EF4444"
          />
          <Text style={[styles.menuButtonText, styles.signOutText]}>Sign Out</Text>
          <IconSymbol
            ios_icon_name="chevron.right"
            android_material_icon_name="chevron-right"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {/* Data Management Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Data Management</Text>
          <Text style={styles.dangerText}>
            These actions are permanent and cannot be undone.
          </Text>

          {/* Delete All Data Button */}
          <TouchableOpacity
            style={[styles.dangerButton, isDeleting && styles.dangerButtonDisabled]}
            onPress={handleDeleteData}
            disabled={isDeleting}
          >
            <IconSymbol
              ios_icon_name="trash.fill"
              android_material_icon_name="delete"
              size={20}
              color="#fff"
            />
            <Text style={styles.dangerButtonText}>Delete All Data</Text>
          </TouchableOpacity>
          <Text style={styles.dangerDescription}>
            Deletes all your goals, reflections, journals, and settings. Your account will remain active.
          </Text>

          {/* Delete Account Button */}
          <TouchableOpacity
            style={[styles.dangerButton, styles.deleteAccountButton, isDeleting && styles.dangerButtonDisabled]}
            onPress={handleDeleteAccount}
            disabled={isDeleting}
          >
            <IconSymbol
              ios_icon_name="person.fill.xmark"
              android_material_icon_name="person-remove"
              size={20}
              color="#fff"
            />
            <Text style={styles.dangerButtonText}>Delete Account</Text>
          </TouchableOpacity>
          <Text style={styles.dangerDescription}>
            Permanently deletes your account and all associated data. You will be signed out.
          </Text>
        </View>

        {/* About Card with Logo */}
        <View style={styles.card}>
          <View style={styles.aboutLogoContainer}>
            <Image
              source={require('@/assets/images/Chesbon_app_Logo.png')}
              style={styles.aboutLogo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.cardTitle}>About Cheshbon</Text>
          <Text style={styles.aboutText}>
            Cheshbon is your personal growth companion. Track your thoughts through journaling and achieve your goals with progress tracking.
          </Text>
          <Text style={styles.aboutText}>
            Stay consistent, reflect on your journey, and celebrate your wins!
          </Text>
        </View>

        {/* Contact Developer Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact Developer</Text>
          <Text style={styles.contactText}>
            Have a bug to report, feedback to share, or a feature to suggest?
          </Text>
          <Text style={styles.contactText}>
            We&apos;d love to hear from you!
          </Text>
          <TouchableOpacity
            style={styles.contactButton}
            onPress={handleContactDeveloper}
          >
            <IconSymbol
              ios_icon_name="envelope.fill"
              android_material_icon_name="email"
              size={20}
              color="#fff"
            />
            <Text style={styles.contactButtonText}>Email Developer</Text>
          </TouchableOpacity>
          <Text style={styles.emailText}>cheshbon.app.me@gmail.com</Text>
        </View>
      </ScrollView>

      {/* Sign Out Confirmation Modal */}
      <ConfirmModal
        visible={showSignOutModal}
        title="Sign Out"
        message="Are you sure you want to sign out?"
        onConfirm={confirmSignOut}
        onCancel={() => setShowSignOutModal(false)}
        confirmText="Sign Out"
        cancelText="Cancel"
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
            <Text style={styles.successModalMessage}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.successModalButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.successModalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error Modal - web-compatible, no Alert.alert */}
      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.errorModal}>
            <Text style={styles.errorModalTitle}>Error</Text>
            <Text style={styles.errorModalMessage}>{errorMessage}</Text>
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
    paddingBottom: 100,
  },
  header: {
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
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
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  aboutLogoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  aboutLogo: {
    width: 80,
    height: 80,
  },
  aboutText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  contactText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 12,
    marginBottom: 12,
    gap: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emailText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  menuButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 12,
  },
  signOutButton: {
    borderColor: '#EF4444',
  },
  signOutText: {
    color: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
  dangerText: {
    fontSize: 14,
    color: '#DC2626',
    lineHeight: 20,
    marginBottom: 16,
    fontWeight: '500',
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
  dangerDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 8,
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
});
