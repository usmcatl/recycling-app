import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, View } from 'react-native';
import { RatingCard, ReputationLine, useReputation } from '@/components/rating';
import { StatusChip, useDateLabel, useMaterialsLabel } from '@/components/requests';
import { StopPhoto } from '@/components/StopPhoto';
import { Avatar, Button, Card, ErrorText, Field, Header, IconTile, Loading, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { NO_SHOW_WAIT_MINUTES } from '@/lib/constants';
import { callNumber, formatKg, formatTime, openDirections, openWhatsApp } from '@/lib/format';
import { useData } from '@/lib/use-data';
import { useSession } from '@/providers/session';
import { colors, fonts, radius, space } from '@/theme';

/** Re-renders every second while `active`, for the wait countdown. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

export default function StopDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  const { data: r, loading, reload, setData } = useData(() => api.getRequest(id), [id]);
  const materialsLabel = useMaterialsLabel();
  const dateLabel = useDateLabel();
  const reputation = useReputation([r?.donor_id]);
  const [photo, setPhoto] = useState<string | null>(null);
  // null until the driver edits it; until then show the estimate
  const [kgInput, setKg] = useState<string | null>(null);
  const [issue, setIssue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => api.subscribeRequest(id, setData), [id, setData]);

  const active = !!r && r.driver_id === userId && r.status === 'en_route';
  const waitingForNoShow = active && r.pickup_mode === 'in_person' && !!r.arrived_at;
  const now = useNow(waitingForNoShow);

  if (loading && !r) return <Loading />;
  if (!r) {
    return (
      <View style={{ flex: 1 }}>
        <Header title={t('stop.title')} />
        <Screen>
          <Text>{t('requestStatus.notFound')}</Text>
        </Screen>
      </View>
    );
  }

  const mine = r.driver_id === userId;
  const closed = ['picked_up', 'deposited', 'no_show', 'cancelled'].includes(r.status);
  const kg = kgInput ?? String(r.actual_kg ?? r.estimated_kg);
  const donor = r.donor;
  const coords = r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null;

  const waitEnds = r.arrived_at ? new Date(r.arrived_at).getTime() + NO_SHOW_WAIT_MINUTES * 60_000 : null;
  const msLeft = waitEnds ? Math.max(0, waitEnds - now) : null;
  const canNoShow = r.pickup_mode === 'doorstep' || (msLeft === 0 && !!r.contacted_at);

  async function act(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function contact(how: 'call' | 'whatsapp') {
    if (!donor?.whatsapp) return;
    if (active) await api.markContacted(r!.id).catch(() => {});
    if (how === 'call') callNumber(donor.whatsapp);
    else openWhatsApp(donor.whatsapp, `Recycle Connect #${r!.case_code}`);
    reload();
  }

  async function takePhoto() {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError(t('stop.cameraDenied'));
      return;
    }
    const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 });
    if (!shot.canceled && shot.assets[0]) setPhoto(shot.assets[0].uri);
  }

  async function uploadIfAny() {
    return photo ? api.uploadPhoto(r!.id, photo) : undefined;
  }

  function collect() {
    return act(async () => {
      if (r!.pickup_mode === 'doorstep' && !photo && !r!.photo_url) throw new Error(t('stop.photoNeeded'));
      const n = Number(kg.replace(',', '.'));
      const ref = await uploadIfAny();
      await api.collectStop(r!.id, { kg: Number.isFinite(n) && n > 0 ? n : undefined, photo: ref });
      setPhoto(null);
    });
  }

  function noShow() {
    return act(async () => {
      const ref = await uploadIfAny();
      await api.noShowStop(r!.id, { note: issue ?? '', photo: ref });
      setIssue(null);
      setPhoto(null);
    });
  }

  const minutes = msLeft != null ? Math.floor(msLeft / 60_000) : 0;
  const seconds = msLeft != null ? Math.floor((msLeft % 60_000) / 1000) : 0;

  return (
    <View style={{ flex: 1 }}>
      <Header title={t('stop.title')} />
      <Screen>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="eyebrow">
            #{r.case_code} · {dateLabel(r.route_date)}
          </Text>
          <StatusChip status={r.status} />
        </Row>

        <Card>
          <Text variant="eyebrow">{t('stop.donor')}</Text>
          <Row>
            <Avatar name={donor?.full_name ?? '?'} size={56} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="headline">{donor?.full_name ?? '—'}</Text>
              <ReputationLine reputation={reputation[r.donor_id]} />
            </View>
          </Row>
          {donor?.whatsapp && mine ? (
            <Row>
              <Button label={t('stop.callDonor')} icon="call" onPress={() => contact('call')} style={{ flex: 1 }} />
              <Button variant="secondary" label={t('common.whatsapp')} icon="chat" onPress={() => contact('whatsapp')} style={{ flex: 1 }} />
            </Row>
          ) : !mine ? (
            <Text variant="bodySmall">{t('stop.contactAfterClaim')}</Text>
          ) : null}
        </Card>

        <Card tone="low">
          <Row style={{ alignItems: 'flex-start' }}>
            <IconTile name="location-on" size={44} bg={colors.surfaceContainerLowest} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="eyebrow">{t('stop.address')}</Text>
              <Text variant="title">{r.address}</Text>
              <Text variant="bodySmall">{r.community}</Text>
            </View>
          </Row>
          <Button
            variant="tertiary"
            label={t('common.openInMaps')}
            icon="open-in-new"
            onPress={() => openDirections(coords, `${r.address}, ${r.community}`)}
          />
        </Card>

        <Row style={{ alignItems: 'stretch' }}>
          <Card tone="low" style={{ flex: 1 }}>
            <Text variant="eyebrow">{t('stop.load')}</Text>
            <Text style={{ fontFamily: fonts.display, fontSize: 34, color: colors.primary }}>{String(r.bag_count).padStart(2, '0')}</Text>
            <Text variant="bodySmall">≈ {formatKg(r.estimated_kg)} kg</Text>
          </Card>
          <Card tone="low" style={{ flex: 1 }}>
            <Text variant="eyebrow">{t('stop.mode')}</Text>
            <IconTile name={r.pickup_mode === 'doorstep' ? 'door-front' : 'handshake'} size={40} bg={colors.surfaceContainerLowest} />
            <Text variant="label">{t(`modes.${r.pickup_mode}`)}</Text>
          </Card>
        </Row>

        <Card tone="low">
          <Text variant="eyebrow">{t('stop.materials')}</Text>
          <Text variant="label">{materialsLabel(r.materials, r.other_material)}</Text>
          {r.instructions ? (
            <>
              <Text variant="eyebrow">{t('stop.instructions')}</Text>
              <Text style={{ fontStyle: 'italic' }}>“{r.instructions}”</Text>
            </>
          ) : null}
        </Card>

        <ErrorText message={error} />

        {mine && (r.status === 'claimed' || r.status === 'open') ? (
          <Card tone="secondary">
            <Text>{t('stop.notStarted')}</Text>
            <Button variant="secondary" label={t('driver.viewRoute')} onPress={() => router.push(`/route/${r.route_id}`)} />
          </Card>
        ) : null}

        {active && r.pickup_mode === 'in_person' ? (
          <Card tone="secondary">
            {!r.arrived_at ? (
              <Button label={t('stop.arrived')} icon="place" onPress={() => act(() => api.markArrived(r.id))} />
            ) : (
              <>
                <Text variant="label">{t('stop.arrivedAt', { time: formatTime(new Date(r.arrived_at)) })}</Text>
                {msLeft ? (
                  <Text variant="bodySmall">
                    {t('stop.waiting', { left: `${minutes}:${String(seconds).padStart(2, '0')}` })}
                  </Text>
                ) : null}
                {!r.contacted_at ? <Text variant="bodySmall">{t('stop.contactFirst')}</Text> : null}
              </>
            )}
          </Card>
        ) : null}

        {active ? (
          <Card tone="low">
            {r.pickup_mode === 'doorstep' ? (
              <View style={{ gap: space.sm }}>
                {photo ? (
                  <Image source={{ uri: photo }} style={{ height: 200, borderRadius: radius.md }} resizeMode="cover" />
                ) : r.photo_url ? (
                  <StopPhoto photoRef={r.photo_url} />
                ) : (
                  <Text variant="bodySmall">{t('stop.photoNeeded')}</Text>
                )}
                <Button
                  variant="secondary"
                  icon="photo-camera"
                  label={photo || r.photo_url ? t('stop.retakePhoto') : t('stop.takePhoto')}
                  onPress={takePhoto}
                />
              </View>
            ) : null}
            <Field label={t('stop.weight')} value={kg} onChangeText={setKg} keyboardType="decimal-pad" />
            <Button
              label={t('stop.collect')}
              icon="check-circle"
              disabled={r.pickup_mode === 'doorstep' && !photo && !r.photo_url}
              onPress={collect}
            />
          </Card>
        ) : null}

        {active ? (
          issue == null ? (
            <Button variant="danger" label={t('stop.noShow')} icon="report" disabled={!canNoShow} onPress={() => setIssue('')} />
          ) : (
            <Card tone="low">
              <Field
                label={t('stop.noShowPrompt')}
                value={issue}
                onChangeText={setIssue}
                placeholder={t('stop.noShowPlaceholder')}
                multiline
              />
              <Row>
                <Button variant="tertiary" label={t('common.cancel')} onPress={() => setIssue(null)} style={{ flex: 1 }} />
                <Button variant="danger" label={t('stop.noShowConfirm')} disabled={!issue.trim()} onPress={noShow} style={{ flex: 1 }} />
              </Row>
            </Card>
          )
        ) : null}

        {closed ? (
          <Card tone="low">
            <Text>{t('stop.closed')}</Text>
            {r.actual_kg != null ? <Text variant="label">{t('requestStatus.actual', { kg: formatKg(r.actual_kg) })}</Text> : null}
            {r.status_note ? <Text variant="bodySmall">{r.status_note}</Text> : null}
            {r.photo_url ? <StopPhoto photoRef={r.photo_url} /> : null}
          </Card>
        ) : null}

        {mine ? <RatingCard request={r} rateeRole="donor" /> : null}

        {mine && !closed && r.status === 'en_route' ? (
          <Button variant="tertiary" label={t('driver.viewRoute')} onPress={() => router.push(`/route/${r.route_id}`)} />
        ) : null}
      </Screen>
    </View>
  );
}
