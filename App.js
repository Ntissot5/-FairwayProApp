import "react-native-url-polyfill/auto"
import { NavigationContainer } from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { Text } from "react-native"
import WelcomeScreen from "./src/WelcomeScreen"
import LoginScreen from "./src/LoginScreen"
import CoachApp from "./src/CoachApp"
import PlayersScreen from "./src/PlayersScreen"
import PlayerDetailScreen from "./src/PlayerDetailScreen"
import SessionsScreen from "./src/SessionsScreen"
import RevenueScreen from "./src/RevenueScreen"
import ChatScreen from "./src/ChatScreen"
import BookingScreen from "./src/BookingScreen"
import SettingsScreen from "./src/SettingsScreen"
import { supabase } from "./src/supabase"
import { registerForPushNotifications, savePushToken } from "./src/notifications"
import { OnboardingProvider } from "./src/OnboardingContext"
import * as Notifications from "expo-notifications"
import { useEffect, useRef } from "react"
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
  return (
    <CoachTab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: G, tabBarInactiveTintColor: "#9CA3AF", tabBarStyle: { borderTopWidth: 0.5, borderTopColor: "#E5E7EB" }, tabBarLabelStyle: { fontSize: 10, fontWeight: "600" } }}>
      <CoachTab.Screen name="Dashboard" component={CoachApp} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"⊞"}</Text>, tabBarLabel: "Home" }} />
      <CoachTab.Screen name="Players" component={PlayersScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"⛳"}</Text>, tabBarLabel: "Players" }} />
      <CoachTab.Screen name="Sessions" component={SessionsScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"🏌️"}</Text>, tabBarLabel: "Sessions" }} />
      <CoachTab.Screen name="Revenue" component={RevenueScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"💰"}</Text>, tabBarLabel: "Revenue" }} />
      <CoachTab.Screen name="Chat" component={ChatScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"💬"}</Text>, tabBarLabel: "Chat" }} />
      <CoachTab.Screen name="Booking" component={BookingScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"📅"}</Text>, tabBarLabel: "Booking" }} />
    </CoachTab.Navigator>
  )
}

function PlayerTabs() {
  return (
    <PlayerTab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: G, tabBarInactiveTintColor: "#9CA3AF", tabBarStyle: { borderTopWidth: 0.5, borderTopColor: "#E5E7EB" }, tabBarLabelStyle: { fontSize: 10, fontWeight: "600" } }}>
      <PlayerTab.Screen name="Home" component={PlayerHomeScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"🏠"}</Text>, tabBarLabel: "Home" }} />
      <PlayerTab.Screen name="PlayerRounds" component={PlayerRoundsScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"⛳"}</Text>, tabBarLabel: "Rounds" }} />
      <PlayerTab.Screen name="PlayerPlan" component={PlayerPlanScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"📋"}</Text>, tabBarLabel: "Plan" }} />
      <PlayerTab.Screen name="PlayerVideos" component={PlayerVideosScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"🎥"}</Text>, tabBarLabel: "Videos" }} />
      <PlayerTab.Screen name="PlayerBook" component={PlayerBookScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"📅"}</Text>, tabBarLabel: "Book" }} />
      <PlayerTab.Screen name="PlayerCommunity" component={PlayerCommunityScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"👥"}</Text>, tabBarLabel: "Community" }} />
      <PlayerTab.Screen name="PlayerChat" component={PlayerChatScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"💬"}</Text>, tabBarLabel: "Chat" }} />
    </PlayerTab.Navigator>
  )
}

export default function App() {
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
      console.log('Notification tapped:', response)
    })

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current)
      Notifications.removeNotificationSubscription(responseListener.current)
    }
  }, [])

  return (
    <SafeAreaProvider>
      <OnboardingProvider>
      <NavigationContainer>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Welcome" component={WelcomeScreen} />
          <RootStack.Screen name="Login" component={LoginScreen} />
          <RootStack.Screen name="CoachTabs" component={CoachTabs} />
          <RootStack.Screen name="PlayerApp" component={PlayerTabs} />
          <RootStack.Screen name="PlayerDetail" component={PlayerDetailScreen} />
          <RootStack.Screen name="Settings" component={SettingsScreen} />
        </RootStack.Navigator>
      </NavigationContainer>
      </OnboardingProvider>
    </SafeAreaProvider>
  )
}
