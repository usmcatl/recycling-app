import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useMaterialsLabel } from '@/components/requests';
import { Button, Card, ErrorText, Field, Header, Icon, IconTile, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useRequestDraft } from '@/providers/request-draft';
import { useSession } from '@/providers/session';
import { colors, fonts, radius, space } from '@/theme';

export default function RequestDetails() {
  const { t } = useTranslation();
  const { profile } = useSession();
  const { draft, update, reset } = useRequestDraft();
  const materialsLabel = useMaterialsLabel();
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!profile?.address) {
      setError(t('profile.addressRequired'));
      return;
    }
    setError(null);
    try {
      const created = await api.createRequest({
        materials: draft.materials,
        other_material: draft.materials.includes('other') ? draft.otherMaterial.trim() : null,
        bag_count: draft.bags,
        preferred_date: draft.date,
        time_window: draft.window,
        instructions: draft.instructions.trim() || null,
        address: profile.address,
        community: profile.community,
        lat: profile.lat,
        lng: profile.lng,
      });
      reset();
      router.replace(`/confirmed/${created.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={t('detailsStep.title')} />
      <Screen>
        <Text variant="eyebrow">{t('detailsStep.eyebrow')}</Text>
        <Text variant="display">{t('detailsStep.headline')}</Text>

        <Card tone="low">
          <Text variant="eyebrow">{t('detailsStep.summary')}</Text>
          <Text variant="title">{materialsLabel(draft.materials, draft.otherMaterial)}</Text>
          <Text variant="bodySmall">
            {formatDate(draft.date)} · {t(`windows.${draft.window}`)}
          </Text>
        </Card>

        <Card tone="low">
          <Text variant="eyebrow">{t('detailsStep.quantity')}</Text>
          <Text variant="title">{t('detailsStep.quantityLabel')}</Text>
          <Row gap={space.lg}>
            <Pressable
              onPress={() => update((d) => ({ bags: Math.max(1, d.bags - 1) }))}
              style={[styles.stepper, { backgroundColor: colors.surfaceContainerLowest }]}
              accessibilityRole="button"
              accessibilityLabel="−"
            >
              <Icon name="remove" />
            </Pressable>
            <Text style={styles.count}>{draft.bags}</Text>
            <Pressable
              onPress={() => update((d) => ({ bags: Math.min(50, d.bags + 1) }))}
              style={[styles.stepper, { backgroundColor: colors.primary }]}
              accessibilityRole="button"
              accessibilityLabel="+"
            >
              <Icon name="add" color={colors.onPrimary} />
            </Pressable>
          </Row>
        </Card>

        <Card tone="low">
          <Field
            label={t('detailsStep.instructions')}
            value={draft.instructions}
            onChangeText={(v) => update({ instructions: v })}
            placeholder={t('detailsStep.instructionsPlaceholder')}
            multiline
          />
        </Card>

        <Card tone="secondary" style={{ flexDirection: 'row' }}>
          <IconTile name="location-on" size={44} bg="rgba(255,255,255,0.5)" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="label">{t('detailsStep.location')}</Text>
            <Text variant="bodySmall">
              {[profile?.address, profile?.community].filter(Boolean).join(', ') || '—'}
            </Text>
            <Pressable onPress={() => router.push({ pathname: '/profile-setup', params: { edit: '1' } })}>
              <Text variant="eyebrow" style={{ color: colors.primary, marginTop: 4 }}>
                {t('detailsStep.changeAddress')}
              </Text>
            </Pressable>
          </View>
        </Card>

        <ErrorText message={error} />
        <Button label={t('detailsStep.submit')} icon="send" onPress={submit} />
        <Text variant="bodySmall" style={{ textAlign: 'center' }}>
          {t('detailsStep.terms')}
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  stepper: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: fonts.headline, fontSize: 28, color: colors.onSurface, minWidth: 32, textAlign: 'center' },
});
