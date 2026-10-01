import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import { RequireRole } from '@/components/RequireRole';
import { TabBar } from '@/components/TabBar';
import { DriverProvider } from '@/providers/driver';

export default function DriverTabs() {
  const { t } = useTranslation();
  return (
    <RequireRole role="driver">
      <DriverProvider>
        <Tabs
          initialRouteName="map"
          screenOptions={{ headerShown: false }}
          tabBar={(props) => (
            <TabBar {...props} icons={{ routes: 'route', map: 'map', history: 'history', profile: 'person' }} />
          )}
        >
          <Tabs.Screen name="routes" options={{ title: t('tabs.routes') }} />
          <Tabs.Screen name="map" options={{ title: t('tabs.map') }} />
          <Tabs.Screen name="history" options={{ title: t('tabs.history') }} />
          <Tabs.Screen name="profile" options={{ title: t('account.title') }} />
        </Tabs>
      </DriverProvider>
    </RequireRole>
  );
}
