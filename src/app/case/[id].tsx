import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, View } from 'react-native';
import { StatusChip, useMaterialsLabel } from '@/components/requests';
import { Avatar, Button, Card, ErrorText, Field, Header, IconTile, Loading, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { RECYCLING_CENTER } from '@/lib/constants';
import { callNumber, formatDate, formatKg, openDirections, openWhatsApp } from '@/lib/format';
import type { RequestStatus } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { colors, fonts } from '@/theme';

function confirm(message: string, onYes: () => void, yesLabel: string, noLabel: string) {
  if (Platform.OS === 'web') {
    onYes();
    return;
  }
  Alert.alert(message, undefined, [
    { text: noLabel, style: 'cancel' },
    { text: yesLabel, style: 'destructive', onPress: onYes },
  ]);
}

export default function CaseDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: r, loading, reload, setData } = useData(() => api.getRequest(id), [id]);
  const materialsLabel = useMaterialsLabel();
  // null until the driver edits it; until then show the estimate
  const [kgInput, setKg] = useState<string | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => api.subscribeRequest(id, setData), [id, setData]);
  const kg = kgInput ?? (r ? String(r.actual_kg ?? r.estimated_kg) : '');

  if (loading && !r) return <Loading />;
  if (!r) {
    return (
      <View style={{ flex: 1 }}>
        <Header title={t('case.title')} />
        <Screen>
          <Text>{t('requestStatus.notFound')}</Text>
        </Screen>
      </View>
    );
  }

  async function act(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const advance = (status: RequestStatus, opts?: { kg?: number; note?: string }) =>
    act(() => api.advanceRequest(r.id, status, opts));

  const inHand = r.status === 'claimed' || r.status === 'en_route';
  const closed = ['deposited', 'cancelled', 'no_show'].includes(r.status);
  const donor = r.donor;
  const coords = r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null;

  return (
    <View style={{ flex: 1 }}>
      <Header title={t('case.title')} />
      <Screen>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="eyebrow">
            {t('common.caseId')} #{r.case_code}
          </Text>
          <StatusChip status={r.status} />
        </Row>

        <Card>
          <Text variant="eyebrow">{t('case.donor')}</Text>
          <Row>
            <Avatar name={donor?.full_name ?? '?'} size={56} />
            <Text variant="headline" style={{ flex: 1 }}>
              {donor?.full_name ?? '—'}
            </Text>
          </Row>
          {donor?.whatsapp ? (
            <Row>
              <Button label={t('case.callDonor')} icon="call" onPress={() => callNumber(donor.whatsapp!)} style={{ flex: 1 }} />
              <Button
                variant="secondary"
                label={t('common.whatsapp')}
                icon="chat"
                onPress={() => openWhatsApp(donor.whatsapp!, `Recycle Connect #${r.case_code}`)}
                style={{ flex: 1 }}
              />
            </Row>
          ) : r.status === 'open' ? (
            <Text variant="bodySmall">{t('case.contactAfterClaim')}</Text>
          ) : null}
        </Card>

        <Card tone="low">
          <Row style={{ alignItems: 'flex-start' }}>
            <IconTile name="location-on" size={44} bg={colors.surfaceContainerLowest} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="eyebrow">{t('case.address')}</Text>
              <Text variant="title">{r.address}</Text>
              {r.community ? <Text variant="bodySmall">{r.community}</Text> : null}
            </View>
          </Row>
          <Button variant="tertiary" label={t('common.openInMaps')} icon="open-in-new" onPress={() => openDirections(coords, `${r.address}, ${r.community ?? ''}`)} />
        </Card>

        <Row style={{ alignItems: 'stretch' }}>
          <Card tone="low" style={{ flex: 1 }}>
            <Text variant="eyebrow">{t('case.load')}</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 34, color: colors.primary }}>{String(r.bag_count).padStart(2, '0')}</Text>
            <Text variant="bodySmall">≈ {formatKg(r.estimated_kg)} kg</Text>
          </Card>
          <Card tone="low" style={{ flex: 1 }}>
            <Text variant="eyebrow">{t('case.when')}</Text>
            <Text variant="title">{formatDate(r.preferred_date)}</Text>
            <Text variant="bodySmall">{t(`windows.${r.time_window}`)}</Text>
          </Card>
        </Row>

        <Card tone="low">
          <Text variant="eyebrow">{t('case.materials')}</Text>
          <Text variant="label">{materialsLabel(r.materials, r.other_material)}</Text>
          {r.instructions ? (
            <>
              <Text variant="eyebrow">{t('case.instructions')}</Text>
              <Text style={{ fontStyle: 'italic' }}>“{r.instructions}”</Text>
            </>
          ) : null}
        </Card>

        <ErrorText message={error} />

        {r.status === 'open' ? (
          <Button label={t('case.claim')} icon="check-circle" onPress={() => act(() => api.claimRequest(r.id))} />
        ) : null}

        {r.status === 'claimed' ? (
          <Button variant="secondary" label={t('case.startRoute')} icon="directions" onPress={() => advance('en_route')} />
        ) : null}

        {inHand ? (
          <Card tone="secondary">
            <Field label={t('case.weightPrompt')} value={kg} onChangeText={setKg} keyboardType="decimal-pad" />
            <Button
              label={t('case.confirmCollection')}
              icon="check-circle"
              onPress={() => {
                const n = Number(kg.replace(',', '.'));
                return advance('picked_up', Number.isFinite(n) && n > 0 ? { kg: n } : undefined);
              }}
            />
          </Card>
        ) : null}

        {r.status === 'picked_up' ? (
          <Card tone="primary">
            <Text style={{ color: colors.onPrimary }}>
              {RECYCLING_CENTER.name} · {RECYCLING_CENTER.address}
            </Text>
            <Button variant="secondary" label={t('case.navigateCenter')} icon="directions" onPress={() => openDirections(RECYCLING_CENTER.location)} />
            <Button
              variant="secondary"
              label={t('case.deposit')}
              icon="eco"
              onPress={async () => {
                await advance('deposited');
                router.back();
              }}
            />
          </Card>
        ) : null}

        {inHand ? (
          issue == null ? (
            <>
              <Button variant="tertiary" label={t('case.release')} onPress={() =>
                confirm(t('case.releaseConfirm'), () => act(() => api.releaseRequest(r.id)), t('common.confirm'), t('common.back'))
              } />
              <Button variant="danger" label={t('case.reportIssue')} icon="report" onPress={() => setIssue('')} />
            </>
          ) : (
            <Card tone="low">
              <Field
                label={t('case.issuePrompt')}
                value={issue}
                onChangeText={setIssue}
                placeholder={t('case.issuePlaceholder')}
                multiline
              />
              <Row>
                <Button variant="tertiary" label={t('common.cancel')} onPress={() => setIssue(null)} style={{ flex: 1 }} />
                <Button
                  variant="danger"
                  label={t('common.confirm')}
                  disabled={!issue.trim()}
                  onPress={() => advance('no_show', { note: issue.trim() })}
                  style={{ flex: 1 }}
                />
              </Row>
            </Card>
          )
        ) : null}

        {closed ? (
          <Card tone="low">
            <Text>{t('case.completed')}</Text>
            {r.actual_kg != null ? <Text variant="label">{t('requestStatus.actual', { kg: formatKg(r.actual_kg) })}</Text> : null}
            {r.status_note ? <Text variant="bodySmall">{r.status_note}</Text> : null}
          </Card>
        ) : null}
      </Screen>
    </View>
  );
}
