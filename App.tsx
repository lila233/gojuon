import React, { useEffect } from 'react';
import { Platform, Text, View, StyleSheet } from 'react-native';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import 'react-native-gesture-handler';
import Constants from 'expo-constants';
import { audioService } from './src/utils/audio';

// 获取 baseUrl（用于 GitHub Pages 等子路径部署）
const baseUrl = Constants.expoConfig?.web?.baseUrl || '';

import { StudyProvider } from './src/contexts/StudyContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
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
  prefixes: [baseUrl],
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

// 现代浮动导航配置 - 使用一致的图标避免布局偏移
const TAB_CONFIG: Record<string, { icon: string }> = {
  Home: { icon: '○' },
  Browse: { icon: '田' },
  Stats: { icon: '〓' },
  Settings: { icon: '◎' },
};

// 现代极简 Tab 图标
function ModernTabIcon({ route, focused, theme }: { route: string; focused: boolean; theme: any }) {
  const config = TAB_CONFIG[route];

  return (
    <View style={styles.tabIconWrapper}>
      <View style={[
        styles.modernTabIcon,
        focused && [styles.modernTabIconActive, { backgroundColor: theme.text }]
      ]}>
        <Text style={[
          styles.modernTabIconText,
          { color: focused ? (theme.background) : theme.textTertiary }
        ]}>
          {config?.icon}
        </Text>
      </View>
    </View>
  );
}

function TabNavigator() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            position: 'absolute',
            bottom: Math.max(insets.bottom, 16) + 8,
            left: '50%',
            marginLeft: -90,
            width: 180,
            height: 48,
            backgroundColor: theme.card,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: theme.border,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            paddingHorizontal: 8,
            paddingTop: 0,
            paddingBottom: 0,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          },
          tabBarItemStyle: {
            flex: 1,
            height: 48,
            paddingTop: 0,
            paddingBottom: 0,
            marginTop: 0,
            marginBottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
          },
          tabBarIcon: ({ focused }) => (
            <ModernTabIcon route={route.name} focused={focused} theme={theme} />
          ),
        })}
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
          <AppWrapper />
        </StudyProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppWrapper() {
  const { theme } = useTheme();

  useEffect(() => {
    void audioService.preloadAll();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <NavigationContainer linking={linking}>
        <AppContent />
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  // 现代浮动导航样式
  tabIconWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernTabIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernTabIconActive: {
    transform: [{ scale: 1.1 }],
  },
  modernTabIconText: {
    fontSize: 16,
    fontWeight: '400',
  },
});
