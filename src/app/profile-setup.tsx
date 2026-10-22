import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { homeHref } from '@/components/nav';
import { Button, Card, ErrorText, Field, Header, Icon, Row, Screen, Segmented, Text } from '@/components/ui';
import { currentLocale } from '@/i18n';
import { api } from '@/lib/api';
import { COMMUNITIES, DEFAULT_BAG_LIMIT } from '@/lib/constants';
import { weekdayName } from '@/lib/format';
import { addressFor, locateMe, LocationDeniedError } from '@/lib/locate';
import { routeWeekday } from '@/lib/schedule';
import type { Role } from '@/lib/types';
import { useSession } from '@/providers/session';
import { colors, fonts, radius, space } from '@/theme';

export default function ProfileSetup() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ role?: string; edit?: string }>();
  const { userId, profile, saveProfile } = useSession();

  const editing = params.edit === '1';
  const [role, setRole] = useState<Role>(
    (params.role as Role) ?? profile?.role ?? 'donor',
  );
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp ?? '+52 ');
  const [community, setCommunity] = useState(profile?.community ?? 'Ajijic');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [coords, setCoords] = useState(
    profile?.lat != null && profile?.lng != null ? { lat: profile.lat, lng: profile.lng } : null,
  );
  const [make, setMake] = useState(profile?.vehicle_make ?? '');
  const [model, setModel] = useState(profile?.vehicle_model ?? '');
  const [color, setColor] = useState(profile?.vehicle_color ?? '');
  const [plate, setPlate] = useState(profile?.vehicle_plate ?? '');
  const [plateState, setPlateState] = useState(profile?.vehicle_plate_state ?? '');
  const [maxBags, setMaxBags] = useState(profile?.max_bags ?? DEFAULT_BAG_LIMIT);
  const [error, setError] = useState<string | null>(null);
  // idle → locating (waiting for a position) → lookingUp (pin set, finding the street) → idle
  const [locating, setLocating] = useState<'idle' | 'locating' | 'lookingUp'>('idle');
  const [addressMissed, setAddressMissed] = useState(false);
  const [agreed, setAgreed] = useState(!!profile?.conduct_accepted_at);
  const communityDay = routeWeekday(community);

  // start from the address they signed in with
  useEffect(() => {
    if (profile?.email) return;
    api
      .currentEmail()
      .then((e) => e && setEmail((cur) => cur || e))
      .catch(() => {});
  }, [profile?.email]);

  if (!userId) return <Redirect href="/" />;
  if (profile && !editing && !params.role) {
    return <Redirect href={profile.role === 'driver' ? '/map' : '/home'} />;
  }

  async function pinMyLocation() {
    setError(null);
    setAddressMissed(false);
    setLocating('locating');
    try {
      const pos = await locateMe();
      setCoords(pos); // pin right away; the street name can follow
      setLocating('lookingUp');
      const found = await addressFor(pos);
      if (found.street) setAddress((cur) => cur.trim() || found.street!);
      else if (!address.trim()) setAddressMissed(true);
      if (found.community) setCommunity(found.community);
    } catch (e) {
      setError(e instanceof LocationDeniedError ? t('profile.locationDenied') : t('profile.locationFailed'));
    } finally {
      setLocating('idle');
    }
  }

  async function save() {
    setError(null);
    if (!fullName.trim()) return setError(t('profile.required'));
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) return setError(t('signIn.invalidEmail'));
    if (role === 'donor' && !address.trim()) return setError(t('profile.addressRequired'));
    if (!agreed) return setError(t('profile.conductRequired'));
    try {
      const saved = await saveProfile({
        role,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase() || null,
        whatsapp: whatsapp.trim().length > 4 ? whatsapp.trim() : null,
        locale: profile?.locale ?? currentLocale(),
        community,
        address: address.trim() || null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        vehicle_make: make.trim() || null,
        vehicle_model: model.trim() || null,
        vehicle_color: color.trim() || null,
        vehicle_plate: plate.trim() || null,
        vehicle_plate_state: plateState.trim() || null,
        max_bags: role === 'driver' ? maxBags : (profile?.max_bags ?? null),
        conduct_accepted_at: profile?.conduct_accepted_at ?? new Date().toISOString(),
      });
      // switching role lands on that role's home; a plain edit goes back where it came from
      const roleChanged = !!profile && profile.role !== saved.role;
      if (editing && !roleChanged && router.canGoBack()) router.back();
      else router.replace(homeHref(saved.role));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={t('profile.title')} />
      <Screen>
        <Text variant="display">{t('profile.headline')}</Text>
        <Text>{role === 'driver' ? t('profile.driverBody') : t('profile.donorBody')}</Text>

        {!editing ? (
          <Segmented
            value={role}
            onChange={setRole}
            options={[
              { value: 'donor', label: t('welcome.donorTitle') },
              { value: 'driver', label: t('welcome.driverTitle') },
            ]}
          />
        ) : null}

        <Card tone="low">
          <Field label={t('profile.fullName')} value={fullName} onChangeText={setFullName} autoComplete="name" />
          <Field
            label={t('profile.email')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('signIn.emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            hint={t('profile.emailHint')}
          />
          <Field
            label={t('profile.whatsapp')}
            value={whatsapp}
            onChangeText={setWhatsapp}
            keyboardType="phone-pad"
            autoComplete="tel"
            hint={t('profile.whatsappHint')}
          />
        </Card>

        <Card tone="low">
          <Text variant="eyebrow">{t('profile.community')}</Text>
          <View style={styles.chips}>
            {COMMUNITIES.map((c) => {
              const on = c === community;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCommunity(c)}
                  style={[styles.chip, on && { backgroundColor: colors.primary }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, { color: on ? colors.onPrimary : colors.onSurfaceVariant }]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
          {communityDay != null ? (
            <Row gap={6}>
              <Icon name="event-repeat" size={18} color={colors.primary} />
              <Text variant="label" style={{ color: colors.primary }}>
                {t('profile.routeDay', { day: weekdayName(communityDay) })}
              </Text>
            </Row>
          ) : null}

          {role === 'donor' ? (
            <>
              <Field
                label={t('profile.address')}
                value={address}
                onChangeText={setAddress}
                placeholder={t('profile.addressPlaceholder')}
                hint={t('profile.addressHint')}
              />
              <Pressable
                onPress={pinMyLocation}
                disabled={locating !== 'idle'}
                style={styles.locate}
                accessibilityRole="button"
              >
                {locating !== 'idle' ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Icon name={coords ? 'check-circle' : 'my-location'} color={colors.primary} />
                )}
                <Text variant="label" style={{ color: colors.primary, flex: 1 }}>
                  {locating === 'locating'
                    ? t('profile.locating')
                    : locating === 'lookingUp'
                      ? t('profile.findingAddress')
                      : coords
                        ? t('profile.locationSet')
                        : t('profile.useLocation')}
                </Text>
                {coords ? (
                  <Text variant="bodySmall">
                    {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </Text>
                ) : null}
              </Pressable>
            </>
          ) : null}
          {role === 'donor' && addressMissed ? <Text variant="bodySmall">{t('profile.addressNotFound')}</Text> : null}
        </Card>

        {role === 'driver' ? (
          <Card tone="low">
            <Row gap={space.sm}>
              <Icon name="local-shipping" />
              <Text variant="title">{t('profile.vehicle')}</Text>
            </Row>
            <Row>
              <View style={{ flex: 1 }}>
                <Field label={t('profile.make')} value={make} onChangeText={setMake} placeholder="Nissan" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t('profile.model')} value={model} onChangeText={setModel} placeholder="NP300" />
              </View>
            </Row>
            <Field label={t('profile.color')} value={color} onChangeText={setColor} />
            <Row>
              <View style={{ flex: 1 }}>
                <Field label={t('profile.plate')} value={plate} onChangeText={setPlate} autoCapitalize="characters" />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label={t('profile.plateState')}
                  value={plateState}
                  onChangeText={setPlateState}
                  placeholder={t('profile.plateStatePlaceholder')}
                />
              </View>
            </Row>
            <Text variant="eyebrow">{t('profile.bagLimit')}</Text>
            <Row gap={space.lg}>
              <Pressable
                onPress={() => setMaxBags((n) => Math.max(1, n - 1))}
                style={[styles.stepper, { backgroundColor: colors.surfaceContainerLowest }]}
                accessibilityRole="button"
                accessibilityLabel="−"
              >
                <Icon name="remove" />
              </Pressable>
              <Text style={styles.count}>{maxBags}</Text>
              <Pressable
                onPress={() => setMaxBags((n) => Math.min(20, n + 1))}
                style={[styles.stepper, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="+"
              >
                <Icon name="add" color={colors.onPrimary} />
              </Pressable>
            </Row>
            <Text variant="bodySmall">{t('profile.bagLimitHint')}</Text>
          </Card>
        ) : null}

        {!profile?.conduct_accepted_at ? (
          <Row gap={space.sm}>
            <Pressable
              onPress={() => setAgreed((a) => !a)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: agreed }}
              hitSlop={8}
            >
              <Icon name={agreed ? 'check-box' : 'check-box-outline-blank'} color={colors.primary} />
            </Pressable>
            <Text style={{ flex: 1 }}>
              {t('profile.agreeConduct')}{' '}
              <Text style={{ color: colors.primary, textDecorationLine: 'underline' }} onPress={() => router.push('/conduct')}>
                {t('profile.conductLink')}
              </Text>
            </Text>
          </Row>
        ) : null}

        <ErrorText message={error} />
        <Button label={t('profile.saveProfile')} icon="check-circle" onPress={save} />
        <Text variant="bodySmall" style={{ textAlign: 'center' }}>
          {t('profile.privacy')}
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLowest,
  },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  stepper: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: fonts.headline, fontSize: 24, color: colors.onSurface, minWidth: 32, textAlign: 'center' },
  locate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.secondaryContainer,
  },
});
