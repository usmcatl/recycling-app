import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button, Header, Icon, IconTile, Row, Screen, Text } from '@/components/ui';
import { MATERIALS } from '@/lib/constants';
import type { MaterialId } from '@/lib/types';
import { useRequestDraft } from '@/providers/request-draft';
import { colors, fonts, radius, space } from '@/theme';

export default function SelectMaterials() {
  const { t } = useTranslation();
  const { draft, update } = useRequestDraft();
  const selected = new Set(draft.materials);

  function toggle(id: MaterialId) {
    update((d) => ({
      materials: d.materials.includes(id) ? d.materials.filter((m) => m !== id) : [...d.materials, id],
    }));
  }

  const otherOn = selected.has('other');

  return (
    <View style={{ flex: 1 }}>
      <Header title={t('common.appName')} />
      <Screen
        footer={
          <View style={styles.footer}>
            <Button
              label={draft.materials.length ? t('materialsStep.confirm', { count: draft.materials.length }) : t('materialsStep.pickOne')}
              disabled={draft.materials.length === 0 || (otherOn && !draft.otherMaterial.trim())}
              onPress={() => router.push('/request/schedule')}
            />
          </View>
        }
      >
        <Text variant="eyebrow">{t('materialsStep.eyebrow')}</Text>
        <Text variant="display">{t('materialsStep.headline')}</Text>

        {MATERIALS.map((m) => {
          const on = selected.has(m.id);
          return (
            <Pressable
              key={m.id}
              onPress={() => toggle(m.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={[styles.card, on && { backgroundColor: colors.primaryContainer }]}
            >
              <IconTile name={m.icon} bg={on ? 'rgba(255,255,255,0.14)' : m.tint} color={on ? colors.primaryFixed : m.iconColor} />
              <Text variant="title" style={on && { color: colors.onPrimary }}>
                {t(`materials.${m.id}`)}
              </Text>
              <Text variant="bodySmall" style={on && { color: colors.onPrimaryContainer }}>
                {t(`materials.${m.id}Desc`)}
              </Text>
              <Row style={{ justifyContent: 'space-between' }}>
                {on ? (
                  <View style={styles.selectedPill}>
                    <Text style={styles.selectedText}>{t('materialsStep.selected')}</Text>
                  </View>
                ) : (
                  <View />
                )}
                <Icon name={on ? 'check-circle' : 'add-circle'} color={on ? colors.onPrimary : colors.outlineVariant} />
              </Row>
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => toggle('other')}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: otherOn }}
          style={[styles.other, otherOn && { borderColor: colors.primary }]}
        >
          <IconTile name="help-outline" bg={colors.surfaceContainerHigh} color={colors.onSurfaceVariant} size={40} />
          <Text variant="title">{t('materials.other')}</Text>
          <Text variant="bodySmall">{t('materials.otherDesc')}</Text>
          {otherOn ? (
            <TextInput
              value={draft.otherMaterial}
              onChangeText={(v) => update({ otherMaterial: v })}
              placeholder={t('materials.otherPlaceholder')}
              placeholderTextColor={colors.outline}
              style={styles.otherInput}
              autoFocus
            />
          ) : null}
        </Pressable>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.xl,
    padding: space.lg,
    gap: space.sm,
  },
  selectedPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  selectedText: { color: colors.onPrimary, fontFamily: fonts.bodySemi, fontSize: 11 },
  other: {
    alignItems: 'center',
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLow,
  },
  otherInput: {
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 48,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.onSurface,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: space.lg,
    paddingBottom: space.xl,
    backgroundColor: 'rgba(248,250,248,0.94)',
  },
});
