import { Redirect, Tabs } from "expo-router";

import { MoneyBottomTabBar } from "@/components/navigation/money-bottom-tab-bar";
import { useAuth } from "@/features/auth/auth-provider";

export default function TabLayout() {
  const { isLoading, session } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <MoneyBottomTabBar {...props} />}
      screenOptions={{
        headerShown: false
      }}
    >
      <Tabs.Screen
        name="calendar"
        options={{
          title: "Calendar"
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: "Timeline"
        }}
      />
      <Tabs.Screen
        name="shared"
        options={{
          title: "Shared"
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights"
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings"
        }}
      />
    </Tabs>
  );
}
