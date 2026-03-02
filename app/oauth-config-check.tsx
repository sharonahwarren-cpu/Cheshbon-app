
import { Stack, useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet } from '@/utils/api';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

interface EnvCheckResponse {
  google: {
    clientIdSet: boolean;
    clientIdPreview: string;
    clientSecretSet: boolean;
  };
  apple: {
    clientIdSet: boolean;
    clientIdPreview: string;
    teamIdSet: boolean;
    keyIdSet: boolean;
    privateKeySet: boolean;
  };
  urls: {
    baseUrl: string;
    frontendUrl: string;
  };
  instructions: string;
}

export default function OAuthConfigCheckScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<EnvCheckResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiGet<EnvCheckResponse>('/api/env-check');
      setConfig(response);
    } catch (err: any) {
      console.error('Error loading OAuth config:', err);
      setError(err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const openSpecularDashboard = () => {
    Linking.openURL('https://specular.dev/dashboard');
  };

  const openGoogleCloudConsole = () => {
    Linking.openURL('https://console.cloud.google.com/apis/credentials');
  };

  const renderConfigItem = (label: string, isSet: boolean, preview?: string) => {
    const statusColor = isSet ? '#4CAF50' : '#F44336';
    const statusText = isSet ? 'SET' : 'NOT SET';
    const statusIcon = isSet ? 'check-circle' : 'error';

    return (
      <View style={styles.configItem}>
        <View style={styles.configHeader}>
          <Text style={styles.configLabel}>{label}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
            <IconSymbol
              ios_icon_name={isSet ? 'checkmark.circle.fill' : 'xmark.circle.fill'}
              android_material_icon_name={statusIcon}
              size={16}
              color="#FFFFFF"
            />
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </View>
        {preview && isSet && (
          <Text style={styles.previewText}>{preview}</Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'OAuth Configuration',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Checking configuration...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen
          options={{
            title: 'OAuth Configuration',
            headerBackTitle: 'Back',
          }}
        />
        <View style={styles.errorContainer}>
          <IconSymbol
            ios_icon_name="exclamationmark.triangle.fill"
            android_material_icon_name="warning"
            size={48}
            color="#F44336"
          />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadConfig}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!config) {
    return null;
  }

  const googleConfigured = config.google.clientIdSet && config.google.clientSecretSet;
  const appleConfigured = config.apple.clientIdSet && config.apple.teamIdSet && config.apple.keyIdSet && config.apple.privateKeySet;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'OAuth Configuration',
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Overall Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuration Status</Text>
          <View style={styles.overallStatus}>
            {googleConfigured ? (
              <View style={styles.statusRow}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={24}
                  color="#4CAF50"
                />
                <Text style={styles.statusRowText}>Google Sign-In is configured</Text>
              </View>
            ) : (
              <View style={styles.statusRow}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="error"
                  size={24}
                  color="#F44336"
                />
                <Text style={styles.statusRowText}>Google Sign-In is NOT configured</Text>
              </View>
            )}
            {appleConfigured ? (
              <View style={styles.statusRow}>
                <IconSymbol
                  ios_icon_name="checkmark.circle.fill"
                  android_material_icon_name="check-circle"
                  size={24}
                  color="#4CAF50"
                />
                <Text style={styles.statusRowText}>Apple Sign-In is configured</Text>
              </View>
            ) : (
              <View style={styles.statusRow}>
                <IconSymbol
                  ios_icon_name="xmark.circle.fill"
                  android_material_icon_name="error"
                  size={24}
                  color="#F44336"
                />
                <Text style={styles.statusRowText}>Apple Sign-In is NOT configured</Text>
              </View>
            )}
          </View>
        </View>

        {/* Google OAuth */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Google OAuth</Text>
          <View style={styles.card}>
            {renderConfigItem('GOOGLE_CLIENT_ID', config.google.clientIdSet, config.google.clientIdPreview)}
            {renderConfigItem('GOOGLE_CLIENT_SECRET', config.google.clientSecretSet)}
          </View>
        </View>

        {/* Apple OAuth */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Apple OAuth</Text>
          <View style={styles.card}>
            {renderConfigItem('APPLE_CLIENT_ID', config.apple.clientIdSet, config.apple.clientIdPreview)}
            {renderConfigItem('APPLE_TEAM_ID', config.apple.teamIdSet)}
            {renderConfigItem('APPLE_KEY_ID', config.apple.keyIdSet)}
            {renderConfigItem('APPLE_PRIVATE_KEY', config.apple.privateKeySet)}
          </View>
        </View>

        {/* URLs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Backend URLs</Text>
          <View style={styles.card}>
            <View style={styles.urlItem}>
              <Text style={styles.urlLabel}>BASE_URL:</Text>
              <Text style={styles.urlValue}>{config.urls.baseUrl || 'NOT SET'}</Text>
            </View>
            <View style={styles.urlItem}>
              <Text style={styles.urlLabel}>FRONTEND_URL:</Text>
              <Text style={styles.urlValue}>{config.urls.frontendUrl || 'NOT SET'}</Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        {!googleConfigured && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How to Fix Google Sign-In</Text>
            <View style={styles.instructionsCard}>
              <Text style={styles.instructionsTitle}>Step 1: Get Google OAuth Credentials</Text>
              <Text style={styles.instructionsText}>
                1. Go to Google Cloud Console{'\n'}
                2. Select or create your project{'\n'}
                3. Navigate to APIs & Services → Credentials{'\n'}
                4. Click CREATE CREDENTIALS → OAuth client ID{'\n'}
                5. Select Application type: Web application{'\n'}
                6. Add Authorized redirect URI:{'\n'}
                   {config.urls.baseUrl}/api/auth/callback/google{'\n'}
                7. Copy the Client ID and Client Secret
              </Text>
              <TouchableOpacity style={styles.linkButton} onPress={openGoogleCloudConsole}>
                <IconSymbol
                  ios_icon_name="arrow.up.right.square.fill"
                  android_material_icon_name="open-in-new"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.linkButtonText}>Open Google Cloud Console</Text>
              </TouchableOpacity>

              <Text style={[styles.instructionsTitle, { marginTop: 24 }]}>Step 2: Add to Specular Dashboard</Text>
              <Text style={styles.instructionsText}>
                1. Go to Specular Dashboard{'\n'}
                2. Select your backend project{'\n'}
                3. Navigate to Environment Variables{'\n'}
                4. Add two new variables:{'\n'}
                   • GOOGLE_CLIENT_ID = (paste your Client ID){'\n'}
                   • GOOGLE_CLIENT_SECRET = (paste your Client Secret){'\n'}
                5. Save and redeploy your backend
              </Text>
              <TouchableOpacity style={styles.linkButton} onPress={openSpecularDashboard}>
                <IconSymbol
                  ios_icon_name="arrow.up.right.square.fill"
                  android_material_icon_name="open-in-new"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.linkButtonText}>Open Specular Dashboard</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Refresh Button */}
        <TouchableOpacity style={styles.refreshButton} onPress={loadConfig}>
          <IconSymbol
            ios_icon_name="arrow.clockwise"
            android_material_icon_name="refresh"
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.refreshButtonText}>Refresh Configuration</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  overallStatus: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusRowText: {
    marginLeft: 12,
    fontSize: 16,
    color: colors.text,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  configItem: {
    marginBottom: 16,
  },
  configHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  configLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  previewText: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  urlItem: {
    marginBottom: 12,
  },
  urlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  urlValue: {
    fontSize: 14,
    color: colors.text,
    fontFamily: 'monospace',
  },
  instructionsCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  linkButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
    paddingVertical: 14,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  refreshButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
