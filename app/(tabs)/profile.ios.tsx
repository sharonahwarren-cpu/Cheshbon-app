
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, ActivityIndicator, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect } from "react";
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { authenticatedGet } from "@/utils/api";
import { useFocusEffect } from "@react-navigation/native";

interface JournalEntry {
  id: string;
  content: string;
  mood?: string;
  createdAt: string;
  updatedAt: string;
}

interface Goal {
  id: string;
  title: string;
  description?: string;
  targetDate?: string;
  completed: boolean;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [signOutModalVisible, setSignOutModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    journalCount: 0,
    goalCount: 0,
    completedCount: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  // Reload stats when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadStats();
    }, [])
  );

  const loadStats = async () => {
    console.log("Loading user stats");
    setLoading(true);
    try {
      // Fetch journal entries
      console.log("[API] Fetching journal entries for stats");
      const journalData = await authenticatedGet<JournalEntry[]>("/api/journal");
      
      // Fetch goals
      console.log("[API] Fetching goals for stats");
      const goalsData = await authenticatedGet<Goal[]>("/api/goals");
      
      const completedGoals = goalsData.filter(g => g.completed).length;
      
      setStats({
        journalCount: journalData.length,
        goalCount: goalsData.length,
        completedCount: completedGoals,
      });
      
      console.log("[API] Stats loaded:", {
        journalCount: journalData.length,
        goalCount: goalsData.length,
        completedCount: completedGoals,
      });
    } catch (error: any) {
      console.error("[API] Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

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

        {/* Stats Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your Progress</Text>
          {loading ? (
            <View style={styles.statsLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <IconSymbol
                  ios_icon_name="book.fill"
                  android_material_icon_name="menu-book"
                  size={24}
                  color={colors.primary}
                />
                <Text style={styles.statValue}>{stats.journalCount}</Text>
                <Text style={styles.statLabel}>Journal Entries</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <IconSymbol
                  ios_icon_name="target"
                  android_material_icon_name="flag"
                  size={24}
                  color={colors.accent}
                />
                <Text style={styles.statValue}>{stats.goalCount}</Text>
                <Text style={styles.statLabel}>Goals</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={24}
                  color={colors.success}
                />
                <Text style={styles.statValue}>{stats.completedCount}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
            </View>
          )}
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
    paddingTop: 10,
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
  statsLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 60,
    backgroundColor: colors.cardBorder,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
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
