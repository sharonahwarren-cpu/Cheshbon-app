
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { BlurView } from 'expo-blur';
import { useTheme } from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Href } from 'expo-router';

const { width: screenWidth } = Dimensions.get('window');

export interface TabBarItem {
  name: string;
  route: Href;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
}

interface FloatingTabBarProps {
  tabs: TabBarItem[];
  containerWidth?: number;
  borderRadius?: number;
  bottomMargin?: number;
}

export function FloatingTabBar({
  tabs,
  containerWidth = screenWidth / 2.5,
  borderRadius = 35,
  bottomMargin
}: FloatingTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const theme = useTheme();
  const animatedValue = useSharedValue(0);

  // Determine active tab based on pathname
  const activeTabIndex = React.useMemo(() => {
    const normalizedPathname = pathname.replace(/\/$/, '');
    
    console.log('[FloatingTabBar] Current pathname:', normalizedPathname);
    
    // Check each tab
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      
      // Home tab - match root or /(tabs)/(home)
      if (tab.name === '(home)') {
        if (normalizedPathname === '/' || 
            normalizedPathname === '' || 
            normalizedPathname === '/(tabs)' ||
            normalizedPathname === '/(tabs)/(home)' ||
            normalizedPathname.startsWith('/(tabs)/(home)/')) {
          console.log(`[FloatingTabBar] Active tab: ${i} (${tab.label})`);
          return i;
        }
      }
      // Reports tab
      else if (tab.name === 'reports') {
        if (normalizedPathname === '/(tabs)/reports' ||
            normalizedPathname.startsWith('/(tabs)/reports/')) {
          console.log(`[FloatingTabBar] Active tab: ${i} (${tab.label})`);
          return i;
        }
      }
      // AI Chat tab
      else if (tab.name === 'ai-chat') {
        if (normalizedPathname === '/(tabs)/ai-chat' ||
            normalizedPathname.startsWith('/(tabs)/ai-chat/')) {
          console.log(`[FloatingTabBar] Active tab: ${i} (${tab.label})`);
          return i;
        }
      }
      // Profile tab
      else if (tab.name === 'profile') {
        if (normalizedPathname === '/(tabs)/profile' ||
            normalizedPathname.startsWith('/(tabs)/profile/')) {
          console.log(`[FloatingTabBar] Active tab: ${i} (${tab.label})`);
          return i;
        }
      }
    }
    
    // Default to home
    console.log('[FloatingTabBar] No match, defaulting to Home (0)');
    return 0;
  }, [pathname, tabs]);

  React.useEffect(() => {
    animatedValue.value = withSpring(activeTabIndex, {
      damping: 20,
      stiffness: 120,
      mass: 1,
    });
  }, [activeTabIndex, animatedValue]);

  const handleTabPress = (route: Href, tabName: string, index: number) => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('[FloatingTabBar] TAB PRESSED');
    console.log('[FloatingTabBar] Tab name:', tabName);
    console.log('[FloatingTabBar] Tab label:', tabs[index].label);
    console.log('[FloatingTabBar] Target route:', route);
    console.log('[FloatingTabBar] Current pathname:', pathname);
    console.log('[FloatingTabBar] Current active index:', activeTabIndex);
    console.log('[FloatingTabBar] Pressed tab index:', index);
    console.log('═══════════════════════════════════════════════════════');
    
    // Always navigate, even if already on the tab (to ensure it works)
    try {
      console.log('[FloatingTabBar] Calling router.push with route:', route);
      router.push(route);
      console.log('[FloatingTabBar] Navigation call completed');
    } catch (error) {
      console.error('[FloatingTabBar] Navigation error:', error);
    }
  };

  const tabWidthPercent = ((100 / tabs.length) - 1).toFixed(2);

  const indicatorStyle = useAnimatedStyle(() => {
    const tabWidth = (containerWidth - 8) / tabs.length;
    return {
      transform: [
        {
          translateX: interpolate(
            animatedValue.value,
            [0, tabs.length - 1],
            [0, tabWidth * (tabs.length - 1)]
          ),
        },
      ],
    };
  });

  const dynamicStyles = {
    blurContainer: {
      ...styles.blurContainer,
      borderWidth: 1.2,
      borderColor: 'rgba(255, 255, 255, 1)',
      ...Platform.select({
        ios: {
          backgroundColor: theme.dark
            ? 'rgba(28, 28, 30, 0.8)'
            : 'rgba(255, 255, 255, 0.6)',
        },
        android: {
          backgroundColor: theme.dark
            ? 'rgba(28, 28, 30, 0.95)'
            : 'rgba(255, 255, 255, 0.6)',
        },
        web: {
          backgroundColor: theme.dark
            ? 'rgba(28, 28, 30, 0.95)'
            : 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(10px)',
        },
      }),
    },
    background: {
      ...styles.background,
    },
    indicator: {
      ...styles.indicator,
      backgroundColor: theme.dark
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(0, 0, 0, 0.04)',
      width: `${tabWidthPercent}%` as `${number}%`,
    },
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={[
        styles.container,
        {
          width: containerWidth,
          marginBottom: bottomMargin ?? 20
        }
      ]}>
        <BlurView
          intensity={80}
          style={[dynamicStyles.blurContainer, { borderRadius }]}
        >
          <View style={dynamicStyles.background} />
          <Animated.View style={[dynamicStyles.indicator, indicatorStyle]} />
          <View style={styles.tabsContainer}>
            {tabs.map((tab, index) => {
              const isActive = activeTabIndex === index;

              return (
                <TouchableOpacity
                  key={`tab-${index}-${tab.name}`}
                  style={styles.tab}
                  onPress={() => handleTabPress(tab.route, tab.name, index)}
                  activeOpacity={0.7}
                >
                  <View style={styles.tabContent}>
                    <IconSymbol
                      android_material_icon_name={tab.icon}
                      ios_icon_name={tab.icon}
                      size={24}
                      color={isActive ? theme.colors.primary : (theme.dark ? '#98989D' : '#000000')}
                    />
                    <Text
                      style={[
                        styles.tabLabel,
                        { color: theme.dark ? '#98989D' : '#8E8E93' },
                        isActive && { color: theme.colors.primary, fontWeight: '600' },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </BlurView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
  },
  container: {
    marginHorizontal: 20,
    alignSelf: 'center',
  },
  blurContainer: {
    overflow: 'hidden',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  indicator: {
    position: 'absolute',
    top: 4,
    left: 2,
    bottom: 4,
    borderRadius: 27,
  },
  tabsContainer: {
    flexDirection: 'row',
    height: 60,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 2,
  },
});
