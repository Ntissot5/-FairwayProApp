import "react-native-url-polyfill/auto"
import "./src/i18n"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { Text, View, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import WelcomeScreen from "./src/WelcomeScreen"
import SubscribeScreen from "./src/SubscribeScreen"
import LoginScreen from "./src/LoginScreen"
import CoachApp from "./src/CoachApp"
import PlayersScreen from "./src/PlayersScreen"
import PlayerDetailScreen from "./src/PlayerDetailScreen"
import SessionsScreen from "./src/SessionsScreen"
import RevenueScreen from "./src/RevenueScreen"
import ChatScreen from "./src/ChatScreen"
import BookingScreen from "./src/BookingScreen"
import SettingsScreen from "./src/SettingsScreen"
import SessionLiveScreen from "./src/SessionLiveScreen"
import VideoRecordScreen from "./src/VideoRecordScreen"
import VideoAnnotationScreen from "./src/VideoAnnotationScreen"
import SessionSummaryScreen from "./src/SessionSummaryScreen"
import PlayerSessionSummaryScreen from "./src/PlayerSessionSummaryScreen"
import PlayerVideoReplayScreen from "./src/PlayerVideoReplayScreen"
import { supabase } from "./src/supabase"
import { OnboardingProvider } from "./src/OnboardingContext"
import * as Notifications from "expo-notifications"
import { useEffect, useRef, useState } from "react"
import PlayerHomeScreen from "./src/PlayerHomeScreen"
import PlayerRoundsScreen from "./src/PlayerRoundsScreen"
import PlayerPlanScreen from "./src/PlayerPlanScreen"
import PlayerVideosScreen from "./src/PlayerVideosScreen"
import PlayerBookScreen from "./src/PlayerBookScreen"
import PlayerCommunityScreen from "./src/PlayerCommunityScreen"
import PlayerChatScreen from "./src/PlayerChatScreen"

const RootStack = createNativeStackNavigator()
const CoachTab = createBottomTabNavigator()
const PlayerTab = createBottomTabNavigator()
const G = "#1B5E35"

function CoachTabs() {
  const { t } = useTranslation()
  return (
    <CoachTab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: G, tabBarInactiveTintColor: "#9CA3AF", tabBarStyle: { borderTopWidth: 0.5, borderTopColor: "#E5E7EB" }, tabBarLabelStyle: { fontSize: 10, fontWeight: "600" } }}>
      <CoachTab.Screen name="Dashboard" component={CoachApp} options={{ tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} />, tabBarLabel: t('tabs.home') }} />
<CoachTab.Screen name="Players" component={PlayersScreen} options={{ tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={22} color={color} />, tabBarLabel: t('tabs.players') }} />
      <CoachTab.Screen name="Sessions" component={SessionsScreen} options={{ tabBarIcon: ({ color }) => <Ionicons name="list-outline" size={22} color={color} />, tabBarLabel: t('tabs.sessions') }} />
      <CoachTab.Screen name="Revenue" component={RevenueScreen} options={{ tabBarIcon: ({ color }) => <Ionicons name="wallet-outline" size={22} color={color} />, tabBarLabel: t('tabs.revenue') }} />
      <CoachTab.Screen name="Chat" component={ChatScreen} options={{ tabBarIcon: ({ color }) => <Ionicons name="chatbubbles-outline" size={22} color={color} />, tabBarLabel: t('tabs.chat') }} />
      <CoachTab.Screen name="Booking" component={BookingScreen} options={{ tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={22} color={color} />, tabBarLabel: t('tabs.booking') }} />
    </CoachTab.Navigator>
  )
}

function PlayerTabs() {
  const { t } = useTranslation()
  return (
    <PlayerTab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: G, tabBarInactiveTintColor: "#9CA3AF", tabBarStyle: { borderTopWidth: 0.5, borderTopColor: "#E5E7EB" }, tabBarLabelStyle: { fontSize: 10, fontWeight: "600" } }}>
      <PlayerTab.Screen name="Home" component={PlayerHomeScreen} options={{ tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} />, tabBarLabel: t('tabs.home') }} />
      <PlayerTab.Screen name="PlayerRounds" component={PlayerRoundsScreen} options={{ tabBarIcon: ({ color }) => <Ionicons name="flag-outline" size={22} color={color} />, tabBarLabel: t('tabs.rounds') }} />
      <PlayerTab.Screen name="PlayerPlan" component={PlayerPlanScreen} options={{ tabBarIcon: ({ color }) => <Ionicons name="clipboard-outline" size={22} color={color} />, tabBarLabel: t('tabs.plan') }} />
      <PlayerTab.Screen name="PlayerVideos" component={PlayerVideosScreen} options={{ tabBarIcon: ({ color }) => <Ionicons name="videocam-outline" size={22} color={color} />, tabBarLabel: t('tabs.videos') }} />
      <PlayerTab.Screen name="PlayerBook" component={PlayerBookScreen} options={{ tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={22} color={color} />, tabBarLabel: t('tabs.booking') }} />
      <PlayerTab.Screen name="PlayerCommunity" component={PlayerCommunityScreen} options={{ tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={22} color={color} />, tabBarLabel: t('tabs.community') }} />
      <PlayerTab.Screen name="PlayerChat" component={PlayerChatScreen} options={{ tabBarIcon: ({ color }) => <Ionicons name="chatbubbles-outline" size={22} color={color} />, tabBarLabel: t('tabs.chat') }} />
    </PlayerTab.Navigator>
  )
}

const navigationRef = { current: null }

export default function App() {
  const notificationListener = useRef()
  const responseListener = useRef()
  const [initialRoute, setInitialRoute] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check existing auth session
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          // Check if user is a coach (has players assigned)
          const { data: players } = await supabase
            .from('players')
            .select('id')
            .eq('coach_id', session.user.id)
            .limit(1)
          setInitialRoute(players && players.length > 0 ? 'CoachTabs' : 'PlayerApp')
        } else {
          setInitialRoute('Welcome')
        }
      } catch {
        setInitialRoute('Welcome')
      }
      setIsLoading(false)
    }
    checkSession()

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification)
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data
      if (data?.type === 'session_summary' && data?.session_record_id && navigationRef.current) {
        navigationRef.current.navigate('PlayerSessionSummary', { session_record_id: data.session_record_id })
      }
    })

    return () => {
      notificationListener.current?.remove()
      responseListener.current?.remove()
    }
  }, [])

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: G, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 36, fontWeight: '800', color: '#fff', letterSpacing: -1 }}>Fairway<Text style={{ color: '#4ade80' }}>Pro</Text></Text>
        <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
      <OnboardingProvider>
      <NavigationContainer ref={ref => { navigationRef.current = ref }}>
        <RootStack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRoute}>
          <RootStack.Screen name="Welcome" component={WelcomeScreen} />
          <RootStack.Screen name="Login" component={LoginScreen} />
          <RootStack.Screen name="CoachTabs" component={CoachTabs} />
          <RootStack.Screen name="PlayerApp" component={PlayerTabs} />
          <RootStack.Screen name="PlayerDetail" component={PlayerDetailScreen} />
          <RootStack.Screen name="Settings" component={SettingsScreen} />
          <RootStack.Screen name="SessionLive" component={SessionLiveScreen} />
          <RootStack.Screen name="VideoRecord" component={VideoRecordScreen} options={{ headerShown: false, animation: 'slide_from_bottom' }} />
          <RootStack.Screen name="VideoAnnotation" component={VideoAnnotationScreen} options={{ headerShown: false }} />
          <RootStack.Screen name="SessionSummary" component={SessionSummaryScreen} />
          <RootStack.Screen name="PlayerSessionSummary" component={PlayerSessionSummaryScreen} />
          <RootStack.Screen name="PlayerVideoReplay" component={PlayerVideoReplayScreen} options={{ headerShown: false }} />
          <RootStack.Screen name="Plans" component={SubscribeScreen} options={{ headerShown: true, headerTitle: '', headerBackTitle: '', headerTintColor: '#1a1a1a', headerStyle: { backgroundColor: '#fff' }, headerShadowVisible: false }} />
        </RootStack.Navigator>
      </NavigationContainer>
      </OnboardingProvider>
    </SafeAreaProvider>
  )
}
