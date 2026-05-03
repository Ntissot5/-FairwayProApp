import "react-native-url-polyfill/auto"
import "./src/i18n"
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { View, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { StatusBar } from "expo-status-bar"
import WelcomeScreen from "./src/WelcomeScreen"
import SubscribeScreen from "./src/SubscribeScreen"
import LoginScreen from "./src/LoginScreen"
import FeedScreen from "./src/FeedScreen"
import CoachApp from "./src/CoachApp"
import PlayersScreen from "./src/PlayersScreen"
import PlayerDetailScreen from "./src/PlayerDetailScreen"
import SpaceScreen from "./src/SpaceScreen"
import CreateScreen from "./src/CreateScreen"
import VideoAnnotateScreen from "./src/VideoAnnotateScreen"
import SessionsScreen from "./src/SessionsScreen"
import RevenueScreen from "./src/RevenueScreen"
import ChatScreen from "./src/ChatScreen"
import BookingScreen from "./src/BookingScreen"
import SettingsScreen from "./src/SettingsScreen"
import AICoachScreen from "./src/AICoachScreen"
import { supabase } from "./src/supabase"
import { registerForPushNotifications, savePushToken } from "./src/notifications"
import { OnboardingProvider } from "./src/OnboardingContext"
import { ThemeProvider, useTheme } from "./src/ThemeContext"
import * as Notifications from "expo-notifications"
import { useEffect, useRef, useMemo, createRef } from "react"
import PlayerHomeScreen from "./src/PlayerHomeScreen"
import PlayerRoundsScreen from "./src/PlayerRoundsScreen"
import PlayerPlanScreen from "./src/PlayerPlanScreen"
import PlayerVideosScreen from "./src/PlayerVideosScreen"
import PlayerBookScreen from "./src/PlayerBookScreen"
import PlayerCommunityScreen from "./src/PlayerCommunityScreen"
import PlayerChatScreen from "./src/PlayerChatScreen"
import DailyBriefingScreen from "./src/DailyBriefingScreen"

const RootStack = createNativeStackNavigator()
const navigationRef = createRef()
const CoachTab = createBottomTabNavigator()
const PlayerTab = createBottomTabNavigator()

function TabIcon({ name, focused, color, colors }) {
  return (
    <View style={styles.tabIconWrap}>
      <View style={[styles.tabIcon, { backgroundColor: focused ? colors.primary : 'transparent' }]}>
        <Ionicons name={focused ? name : `${name}-outline`} size={20} color={focused ? '#fff' : color} />
      </View>
    </View>
  )
}

function CoachTabs() {
  const { colors } = useTheme()
  const tabBarStyle = useMemo(() => ({
    backgroundColor: colors.tabBar,
    borderTopWidth: 0,
    height: 88,
    paddingBottom: 30,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: colors.tabBar === '#FFFFFF' ? 0.04 : 0.2,
    shadowRadius: 8,
    elevation: 8,
  }), [colors])

  return (
    <CoachTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500", letterSpacing: 0.1 },
      }}
    >
      <CoachTab.Screen
        name="Dashboard"
        component={CoachApp}
        options={{
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" focused={focused} color={color} colors={colors} />,
          tabBarLabel: "Home",
        }}
      />
      <CoachTab.Screen
        name="Spaces"
        component={PlayersScreen}
        options={{
          tabBarIcon: ({ color, focused }) => <TabIcon name="people" focused={focused} color={color} colors={colors} />,
          tabBarLabel: "Players",
        }}
      />
      <CoachTab.Screen
        name="Create"
        component={View}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault()
            navigation.navigate("CreateModal")
          },
        })}
        options={{
          tabBarIcon: () => (
            <View style={[styles.fabWrap, { backgroundColor: colors.primary }]}>
              <Ionicons name="add" size={28} color="#fff" />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <CoachTab.Screen
        name="Calendar"
        component={BookingScreen}
        options={{
          tabBarIcon: ({ color, focused }) => <TabIcon name="calendar" focused={focused} color={color} colors={colors} />,
          tabBarLabel: "Calendar",
        }}
      />
      <CoachTab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          tabBarIcon: ({ color, focused }) => <TabIcon name="pulse" focused={focused} color={color} colors={colors} />,
          tabBarLabel: "Activity",
        }}
      />
    </CoachTab.Navigator>
  )
}

function PlayerTabs() {
  const { colors } = useTheme()
  const tabBarStyle = useMemo(() => ({
    backgroundColor: colors.tabBar,
    borderTopWidth: 0,
    height: 88,
    paddingBottom: 30,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: colors.tabBar === '#FFFFFF' ? 0.04 : 0.2,
    shadowRadius: 8,
    elevation: 8,
  }), [colors])

  return (
    <PlayerTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500", letterSpacing: 0.1 },
      }}
    >
      <PlayerTab.Screen
        name="Home"
        component={PlayerHomeScreen}
        options={{
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" focused={focused} color={color} colors={colors} />,
          tabBarLabel: "Home",
        }}
      />
      <PlayerTab.Screen
        name="PlayerPlan"
        component={PlayerPlanScreen}
        options={{
          tabBarIcon: ({ color, focused }) => <TabIcon name="clipboard" focused={focused} color={color} colors={colors} />,
          tabBarLabel: "Plan",
        }}
      />
      <PlayerTab.Screen
        name="PlayerBook"
        component={PlayerBookScreen}
        options={{
          tabBarIcon: ({ color, focused }) => <TabIcon name="calendar" focused={focused} color={color} colors={colors} />,
          tabBarLabel: "Book",
        }}
      />
      <PlayerTab.Screen
        name="PlayerProfile"
        component={PlayerRoundsScreen}
        options={{
          tabBarIcon: ({ color, focused }) => <TabIcon name="person" focused={focused} color={color} colors={colors} />,
          tabBarLabel: "Profile",
        }}
      />
    </PlayerTab.Navigator>
  )
}

function AppNavigation() {
  const { colors, isDark } = useTheme()
  const notificationListener = useRef()
  const responseListener = useRef()

  useEffect(() => {
    registerForPushNotifications().then(async token => {
      if (token) {
        const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
        if (user) savePushToken(user.id, token)
      }
    })

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification)
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data
      if (data?.type === 'daily_briefing') {
        // FairwayPro: navigate to briefing screen when daily briefing push is tapped
        navigationRef.current?.navigate('DailyBriefing')
      }
    })

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current)
      Notifications.removeNotificationSubscription(responseListener.current)
    }
  }, [])

  const navTheme = useMemo(() => ({
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.bg,
      card: colors.card,
      text: colors.text,
      border: colors.separator,
    },
  }), [isDark, colors])

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer theme={navTheme} ref={navigationRef}>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Subscribe" component={SubscribeScreen} />
          <RootStack.Screen name="Welcome" component={WelcomeScreen} />
          <RootStack.Screen name="Login" component={LoginScreen} />
          <RootStack.Screen name="CoachTabs" component={CoachTabs} />
          <RootStack.Screen name="PlayerApp" component={PlayerTabs} />
          <RootStack.Screen name="CreateModal" component={CreateScreen} options={{ presentation: "transparentModal", animation: "fade" }} />
          <RootStack.Screen name="Space" component={SpaceScreen} />
          <RootStack.Screen name="AICoach" component={AICoachScreen} />
          <RootStack.Screen name="VideoAnnotate" component={VideoAnnotateScreen} />
          <RootStack.Screen name="PlayerDetail" component={PlayerDetailScreen} />
          <RootStack.Screen name="Sessions" component={SessionsScreen} />
          <RootStack.Screen name="Revenue" component={RevenueScreen} />
          <RootStack.Screen name="Chat" component={ChatScreen} />
          <RootStack.Screen name="Settings" component={SettingsScreen} />
          <RootStack.Screen name="DailyBriefing" component={DailyBriefingScreen} />
          <RootStack.Screen name="PlayerVideos" component={PlayerVideosScreen} />
          <RootStack.Screen name="PlayerChat" component={PlayerChatScreen} />
          <RootStack.Screen name="PlayerCommunity" component={PlayerCommunityScreen} />
        </RootStack.Navigator>
      </NavigationContainer>
    </>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <OnboardingProvider>
          <AppNavigation />
        </OnboardingProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  tabIconWrap: { alignItems: 'center', justifyContent: 'center' },
  tabIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fabWrap: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: -12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
})
