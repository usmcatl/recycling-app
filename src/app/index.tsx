import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, DemoBanner, IconTile, Row, Stat, Text } from '@/components/ui';
import { setLanguage } from '@/i18n';
import { api } from '@/lib/api';
import { formatKg } from '@/lib/format';
import type { CommunityStats, Role } from '@/lib/types';
import { useSession } from '@/providers/session';
import { colors, fonts, radius, space } from '@/theme';

export default function Welcome() {
  const { userId, profile } = useSession();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<CommunityStats | null>(null);

  useEffect(() => {
    api.communityStats().then(setStats).catch(() => setStats(null));
  }, []);

  if (userId && !profile) return <Redirect href="/profile-setup" />;
  if (profile) return <Redirect href={profile.role === 'driver' ? '/map' : '/home'} />;

  const start = (role: Role) => router.push({ pathname: '/sign-in', params: { role } });
  const other = i18n.language === 'en' ? 'es' : 'en';

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <DemoBanner />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md }]}>
        <Row style={{ justifyContent: 'flex-end' }}>
          <Pressable onPress={() => setLanguage(other)} hitSlop={10} style={styles.lang} accessibilityRole="button">
            <Text variant="label" style={{ color: colors.primary }}>
              {other === 'en' ? 'English' : 'Español'}
            </Text>
          </Pressable>
        </Row>

        <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />

        <Text variant="display" style={{ textAlign: 'center' }}>
          {t('welcome.headline')}
          <Text variant="display" style={{ color: colors.primary }}>
            {t('welcome.headlineAccent')}
          </Text>
        </Text>

        <LinearGradient colors={['#e3efd9', colors.secondaryContainer]} style={styles.roleCard}>
          <IconTile name="recycling" bg={colors.surfaceContainerLowest} />
          <Text variant="headline">{t('welcome.donorTitle')}</Text>
          <Text>{t('welcome.donorBody')}</Text>
          <Button label={t('welcome.donorCta')} icon="arrow-forward" onPress={() => start('donor')} style={{ alignSelf: 'flex-start' }} />
        </LinearGradient>

        <LinearGradient colors={['#d3f1fc', colors.tertiaryFixed]} style={styles.roleCard}>
          <IconTile name="local-shipping" bg={colors.surfaceContainerLowest} color={colors.tertiary} />
          <Text variant="headline">{t('welcome.driverTitle')}</Text>
          <Text>{t('welcome.driverBody')}</Text>
          <Pressable onPress={() => start('driver')} style={styles.driverCta} accessibilityRole="button">
            <Text style={{ color: colors.onPrimary, fontFamily: fonts.bodySemi, fontSize: 16 }}>
              {t('welcome.driverCta')}
            </Text>
          </Pressable>
        </LinearGradient>

        <View style={{ gap: space.md, marginTop: space.lg }}>
          <Text variant="eyebrow">{t('welcome.statsEyebrow')}</Text>
          <Text variant="headline" style={{ fontSize: 28, lineHeight: 34 }}>
            {t('welcome.statsHeadline')}
          </Text>
        </View>

        <Card tone="low">
          <Row>
            <Card style={{ flex: 1 }}>
              <Stat value={stats ? formatKg(stats.total_kg) : '—'} label={t('welcome.statKg')} />
            </Card>
            <Card style={{ flex: 1 }}>
              <Stat value={stats ? String(stats.total_pickups) : '—'} label={t('welcome.statPickups')} />
            </Card>
          </Row>
          <Row>
            <Card style={{ flex: 1 }}>
              <Stat value={stats ? String(stats.donors) : '—'} label={t('welcome.statDonors')} />
            </Card>
            <Card style={{ flex: 1 }}>
              <Stat value={stats ? String(stats.drivers) : '—'} label={t('welcome.statDrivers')} />
            </Card>
          </Row>
        </Card>

        <Button variant="tertiary" label={t('welcome.haveAccount')} onPress={() => router.push('/sign-in')} />
        <Text variant="bodySmall" style={{ textAlign: 'center' }}>
          {t('common.serviceOf')}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.lg },
  lang: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.surfaceContainerHigh },
  logo: { width: '100%', height: 170 },
  roleCard: { borderRadius: radius.xl, padding: space.xl, gap: space.md },
  driverCta: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tertiaryContainer,
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
    minHeight: 52,
    justifyContent: 'center',
  },
});
