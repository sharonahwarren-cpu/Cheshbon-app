
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';

// Calm, earthy colors for journaling and goal tracking
export const colors = {
  primary: '#7C9885',      // Sage green - calming and grounding
  secondary: '#A8B5A0',    // Light sage
  accent: '#C9A66B',       // Warm tan accent - for highlights
  background: '#F5F3EF',   // Warm off-white background
  backgroundAlt: '#FFFFFF', // Pure white for cards
  text: '#3A3A3A',         // Warm dark gray text
  textSecondary: '#6B6B6B', // Medium gray for secondary text
  card: '#FFFFFF',         // White cards
  cardBorder: '#E0DDD7',   // Warm light border
  success: '#7C9885',      // Sage green for completed goals
  error: '#B87C6C',        // Terracotta for errors and negative balances
  warning: '#D4A574',      // Warm sand for in-progress
  muted: '#9B9B9B',        // Muted gray
  highlight: '#F9F5E8',    // Warm cream highlight
  border: '#E0DDD7',       // Border color
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
