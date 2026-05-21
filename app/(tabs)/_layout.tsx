import { Tabs } from "expo-router";

import { MoneyBottomTabBar } from "@/components/navigation/money-bottom-tab-bar";

export default function TabLayout() {
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
