import { Stack } from 'expo-router';
import { RequireRole } from '@/components/RequireRole';
import { RequestDraftProvider } from '@/providers/request-draft';
import { colors } from '@/theme';

export const unstable_settings = { initialRouteName: 'materials' };

export default function RequestLayout() {
  return (
    <RequireRole role="donor">
      <RequestDraftProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }} />
      </RequestDraftProvider>
    </RequireRole>
  );
}
