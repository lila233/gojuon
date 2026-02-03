import React, { useEffect, useRef } from 'react';
import { Platform, Text, View, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { NavigationContainer, LinkingOptions, NavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import 'react-native-gesture-handler';
import Constants from 'expo-constants';
import { audioService } from './src/utils/audio';

// 获取 baseUrl（用于 GitHub Pages 等子路径部署）
const rawBaseUrl = Constants.expoConfig?.web?.baseUrl || '';
const normalizedBaseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
const baseUrl = resolveBaseUrl();

import { StudyProvider } from './src/contexts/StudyContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import { TabBarProvider, useTabBar } from './src/contexts/TabBarContext';
import HomeScreen from './src/screens/HomeScreen';
import StudyScreen from './src/screens/StudyScreen';
import StatsScreen from './src/screens/StatsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import BrowseScreen from './src/screens/BrowseScreen';

const Tab = createBottomTabNavigator();
const RootStack = createStackNavigator();

// Navigation types for proper linking config
type TabParamList = {
  Home: undefined;
  Browse: undefined;
  Stats: undefined;
  Settings: undefined;
};

type RootStackParamList = {
  Main: undefined;
  Study: undefined;
};

// Linking configuration with proper typing
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: baseUrl ? [baseUrl] : [],
  config: {
    screens: {
      Main: {
        path: '',
        screens: {
          Home: '',
          Browse: 'browse',
          Stats: 'stats',
          Settings: 'settings',
        },
      },
      Study: 'study',
    },
  },
};

function resolveBaseUrl(): string {
  if (Platform.OS !== 'web') return '';
  if (!normalizedBaseUrl) return '';
  if (typeof window === 'undefined') return normalizedBaseUrl;

  const path = window.location.pathname || '';
  if (path === normalizedBaseUrl || path.startsWith(`${normalizedBaseUrl}/`)) {
    return normalizedBaseUrl;
  }

  // 当部署在根路径时，不应用 baseUrl
  return '';
}

// Tab 图标配置 - 使用日语汉字
const TAB_CONFIG: Record<string, { icon: string }> = {
  Home: { icon: '学' },    // 学習 - 学习
  Browse: { icon: '表' },  // 五十音表 - 图表
  Stats: { icon: '績' },   // 成績 - 成绩
  Settings: { icon: '設' }, // 設定 - 设置
};

// 自定义浮动 TabBar 组件
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isVisible } = useTabBar();
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isVisible ? 0 : 100,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  return (
    <Animated.View style={[
      styles.floatingTabBarContainer,
      {
        bottom: Math.max(insets.bottom, 12) + 8,
        transform: [{ translateY }],
      }
    ]}>
      <View style={[
        styles.floatingTabBar,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
        }
      ]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = TAB_CONFIG[route.name];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <View style={[
                styles.tabIconCircle,
                isFocused && { backgroundColor: theme.text }
              ]}>
                <Text style={[
                  styles.tabIconText,
                  { color: isFocused ? theme.background : theme.textTertiary }
                ]}>
                  {config?.icon}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

function TabNavigator() {
  const { isDark } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Browse" component={BrowseScreen} />
        <Tab.Screen name="Stats" component={StatsScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </View>
  );
}

function AppContent() {
  const { theme } = useTheme();

  return (
    <>
      <StatusBar hidden={true} />
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: theme.background },
          gestureEnabled: true,
          cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        }}
      >
        <RootStack.Screen
          name="Main"
          component={TabNavigator}
        />
        <RootStack.Screen
          name="Study"
          component={StudyScreen}
          options={{
            transitionSpec: {
              open: {
                animation: 'timing',
                config: { duration: 350 },
              },
              close: {
                animation: 'timing',
                config: { duration: 350 },
              },
            },
          }}
        />
      </RootStack.Navigator>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StudyProvider>
          <TabBarProvider>
            <AppWrapper />
          </TabBarProvider>
        </StudyProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppWrapper() {
  const { theme } = useTheme();
  const navigationRef = React.useRef<NavigationContainerRef<RootStackParamList>>(null);

  useEffect(() => {
    void audioService.preloadAll();
  }, []);

  // Web keyboard shortcuts: Alt+1/2/3/4
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;

      // Check if we're on Study screen - if so, disable shortcuts
      const currentRoute = navigationRef.current?.getCurrentRoute();
      if (currentRoute?.name === 'Study') return;

      const tabMap: Record<string, string> = {
        '1': 'Home',
        '2': 'Browse',
        '3': 'Stats',
        '4': 'Settings',
      };

      const tabName = tabMap[e.key];
      if (tabName) {
        e.preventDefault();
        navigationRef.current?.navigate('Main' as never, { screen: tabName } as never);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <NavigationContainer linking={linking} ref={navigationRef}>
        <AppContent />
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  // 自定义浮动导航栏样式
  floatingTabBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  floatingTabBar: {
    flexDirection: 'row',
    width: 180,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  tabItem: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tabIconText: {
    fontSize: 16,
    fontWeight: '400',
  },
});
