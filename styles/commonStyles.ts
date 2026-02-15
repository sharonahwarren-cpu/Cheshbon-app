
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

// Warm, calming colors for journaling and goal tracking
export const colors = {
  primary: '#6B4CE6',      // Soft purple - inspiring and creative
  secondary: '#8B5CF6',    // Light purple
  accent: '#EC4899',       // Pink accent - for highlights
  background: '#FAFAFA',   // Light warm background
  backgroundAlt: '#FFFFFF', // Pure white for cards
  text: '#1F2937',         // Dark gray text
  textSecondary: '#6B7280', // Medium gray for secondary text
  card: '#FFFFFF',         // White cards
  cardBorder: '#E5E7EB',   // Light border
  success: '#10B981',      // Green for completed goals
  error: '#EF4444',        // Red for errors and negative balances
  warning: '#F59E0B',      // Orange for in-progress
  muted: '#9CA3AF',        // Muted gray
  highlight: '#FEF3C7',    // Light yellow highlight
  border: '#E5E7EB',       // Border color
};

export const buttonStyles = StyleSheet.create({
  instructionsButton: {
    backgroundColor: colors.primary,
    alignSelf: 'center',
    width: '100%',
  },
  backButton: {
    backgroundColor: colors.backgroundAlt,
    alignSelf: 'center',
    width: '100%',
  },
});

export const commonStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 800,
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.text,
    marginBottom: 10
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 8,
    lineHeight: 24,
    textAlign: 'center',
  },
  section: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  icon: {
    width: 60,
    height: 60,
    tintColor: colors.primary,
  },
});
