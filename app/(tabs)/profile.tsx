
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity, Modal, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect } from "react";
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);

  useEffect(() => {
    console.log('[Profile] Screen mounted, user:', user ? user.email : 'not logged in');
  }, []);

  useEffect(() => {
    console.log('[Profile] User state changed:', user ? user.email : 'not logged in');
  }, [user]);

  const handleSignOut = async () => {
    console.log("User signing out");
    try {
      await signOut();
      console.log("Sign out successful, redirecting to auth");
      router.replace('/auth');
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setSignOutModalVisible(false);
    }
  };

  // If user is not loaded yet, show loading
  if (!user) {
    console.log('[Profile] No user found, showing loading...');
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 16, color: colors.textSecondary }}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const userName = user?.name || user?.email || 'User';
  const userEmail = user?.email || '';
  const userInitial = userName.charAt(0).toUpperCase();

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
          <Text style={styles.userName}>{userName}</Text>
          <Text style={styles.userEmail}>{userEmail}</Text>
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

        {/* Settings Button */}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => {
            console.log('Navigating to Settings');
            router.push('/settings-menu');
          }}
        >
          <IconSymbol
            ios_icon_name="wrench.and.screwdriver"
            android_material_icon_name="build"
            size={20}
            color={colors.primary}
          />
          <Text style={styles.menuButtonText}>Settings</Text>
          <IconSymbol
            ios_icon_name="chevron.right"
            android_material_icon_name="chevron-right"
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

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

        {/* Sign Out Button */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={() => {
            console.log("Sign out button pressed");
            setSignOutModalVisible(true);
          }}
        >
          <IconSymbol
            ios_icon_name="arrow.right.square"
            android_material_icon_name="logout"
            size={20}
            color="#EF4444"
          />
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Sign Out Confirmation Modal */}
      <Modal
        visible={signOutModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setSignOutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <Text style={styles.confirmTitle}>Sign Out?</Text>
            <Text style={styles.confirmText}>
              Are you sure you want to sign out?
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmButtonCancel]}
                onPress={() => {
                  console.log("Sign out cancelled");
                  setSignOutModalVisible(false);
                }}
              >
                <Text style={styles.confirmButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmButtonSignOut]}
                onPress={handleSignOut}
              >
                <Text style={styles.confirmButtonTextSignOut}>Sign Out</Text>
              </TouchableOpacity>
            </View>
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
    paddingTop: Platform.OS === 'android' ? 20 : 10,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EF4444',
    gap: 8,
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModal: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 40,
    width: '80%',
    maxWidth: 400,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonCancel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  confirmButtonSignOut: {
    backgroundColor: '#EF4444',
  },
  confirmButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  confirmButtonTextSignOut: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
