import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { RequireRole } from '@/components/RequireRole';
import { TabBar } from '@/components/TabBar';

export default function DonorTabs() {
  const { t } = useTranslation();
  return (
    <RequireRole role="donor">
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <TabBar {...props} icons={{ home: 'home', activity: 'history', impact: 'leaderboard', account: 'person' }} />
        )}
      >
        <Tabs.Screen name="home" options={{ title: t('tabs.home') }} />
        <Tabs.Screen name="activity" options={{ title: t('tabs.activity') }} />
        <Tabs.Screen name="impact" options={{ title: t('tabs.impact') }} />
        <Tabs.Screen name="account" options={{ title: t('tabs.account') }} />
      </Tabs>
    </RequireRole>
  );
}
