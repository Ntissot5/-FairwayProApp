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

const RootStack = createNativeStackNavigator()
const Tab = createBottomTabNavigator()
const G = "#1B5E35"

function CoachTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: G, tabBarInactiveTintColor: "#9CA3AF", tabBarStyle: { borderTopWidth: 0.5, borderTopColor: "#E5E7EB" }, tabBarLabelStyle: { fontSize: 10, fontWeight: "600" } }}>
      <Tab.Screen name="Dashboard" component={CoachApp} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"⊞"}</Text>, tabBarLabel: "Home" }} />
      <Tab.Screen name="Players" component={PlayersScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"⛳"}</Text>, tabBarLabel: "Players" }} />
      <Tab.Screen name="Sessions" component={SessionsScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"🏌️"}</Text>, tabBarLabel: "Sessions" }} />
      <Tab.Screen name="Revenue" component={RevenueScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"💰"}</Text>, tabBarLabel: "Revenue" }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"💬"}</Text>, tabBarLabel: "Chat" }} />
      <Tab.Screen name="Booking" component={BookingScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 16, color }}>{"📅"}</Text>, tabBarLabel: "Booking" }} />
    </Tab.Navigator>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Welcome" component={WelcomeScreen} />
          <RootStack.Screen name="Login" component={LoginScreen} />
          <RootStack.Screen name="CoachTabs" component={CoachTabs} />
          <RootStack.Screen name="PlayerDetail" component={PlayerDetailScreen} />
          <RootStack.Screen name="Settings" component={SettingsScreen} />
        </RootStack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
