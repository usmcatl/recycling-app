import * as Location from 'expo-location';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, ErrorText, Field, Header, Icon, Row, Screen, Segmented, Text } from '@/components/ui';
import { currentLocale } from '@/i18n';
import { COMMUNITIES } from '@/lib/constants';
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
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  if (!userId) return <Redirect href="/" />;
  if (profile && !editing && !params.role) {
    return <Redirect href={profile.role === 'driver' ? '/map' : '/home'} />;
  }

  async function pinMyLocation() {
    setError(null);
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError(t('profile.locationDenied'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      if (!address) {
        const [place] = await Location.reverseGeocodeAsync(pos.coords).catch(() => []);
        if (place) {
          setAddress([place.street, place.streetNumber].filter(Boolean).join(' '));
          const match = COMMUNITIES.find((c) => [place.city, place.district, place.subregion].includes(c));
          if (match) setCommunity(match);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    setError(null);
    if (!fullName.trim()) return setError(t('profile.required'));
    if (role === 'donor' && !address.trim()) return setError(t('profile.addressRequired'));
    try {
      const saved = await saveProfile({
        role,
        full_name: fullName.trim(),
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
      });
      if (editing && router.canGoBack()) router.back();
      else router.replace(saved.role === 'driver' ? '/map' : '/home');
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

          {role === 'donor' ? (
            <>
              <Field
                label={t('profile.address')}
                value={address}
                onChangeText={setAddress}
                placeholder={t('profile.addressPlaceholder')}
                hint={t('profile.addressHint')}
              />
              <Pressable onPress={pinMyLocation} style={styles.locate} accessibilityRole="button">
                <Icon name={coords ? 'check-circle' : 'my-location'} color={colors.primary} />
                <Text variant="label" style={{ color: colors.primary, flex: 1 }}>
                  {locating ? t('common.loading') : coords ? t('profile.locationSet') : t('profile.useLocation')}
                </Text>
                {coords ? (
                  <Text variant="bodySmall">
                    {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                  </Text>
                ) : null}
              </Pressable>
            </>
          ) : null}
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
            <Row>
              <View style={{ flex: 1 }}>
                <Field label={t('profile.color')} value={color} onChangeText={setColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t('profile.plate')} value={plate} onChangeText={setPlate} autoCapitalize="characters" />
              </View>
            </Row>
          </Card>
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
  locate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.secondaryContainer,
  },
});
