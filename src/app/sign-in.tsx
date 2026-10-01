import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Card, DemoBanner, ErrorText, Field, Header, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { colors } from '@/theme';

export default function SignIn() {
  const { t } = useTranslation();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(clean)) {
      setError(t('signIn.invalidEmail'));
      return;
    }
    try {
      await api.sendCode(clean);
      setEmail(clean);
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function verify() {
    setError(null);
    try {
      await api.verifyCode(email, code.trim());
      const existing = await api.getMyProfile();
      if (existing) router.replace(existing.role === 'driver' ? '/map' : '/home');
      else router.replace({ pathname: '/profile-setup', params: role ? { role } : {} });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={t('signIn.title')} />
      <DemoBanner />
      <Screen>
        <Text variant="display">{sent ? t('signIn.codeTitle') : t('signIn.headline')}</Text>
        <Text>{sent ? t('signIn.codeBody', { email }) : t('signIn.body')}</Text>

        <Card tone="low">
          {sent ? (
            <Field
              key="code"
              label={t('signIn.code')}
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              placeholder="000000"
              autoFocus
              style={{ fontSize: 24, letterSpacing: 8 }}
            />
          ) : (
            <Field
              key="email"
              label={t('signIn.email')}
              value={email}
              onChangeText={setEmail}
              placeholder={t('signIn.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              autoFocus
            />
          )}
        </Card>

        <ErrorText message={error} />

        {sent ? (
          <>
            <Button label={t('signIn.verify')} icon="arrow-forward" onPress={verify} disabled={code.length !== 6} />
            <Button variant="tertiary" label={t('signIn.resend')} onPress={() => { setSent(false); setCode(''); }} />
          </>
        ) : (
          <Button label={t('signIn.sendCode')} icon="mail" onPress={sendCode} />
        )}

        {api.mode === 'demo' ? (
          <Text variant="bodySmall" style={{ textAlign: 'center', color: colors.tertiary }}>
            {t('signIn.demoHint')}
          </Text>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
