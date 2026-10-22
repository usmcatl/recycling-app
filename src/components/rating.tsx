import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { api } from '@/lib/api';
import { FEEDBACK_QUESTIONS } from '@/lib/constants';
import type { PickupRequest, Rating, Reputation, Role } from '@/lib/types';
import { colors, fonts, radius, space } from '@/theme';
import { Button, Card, ErrorText, Icon, Row, Text } from './ui';

/** Reputation for several users at once; refetches when the id list changes. */
export function useReputation(userIds: (string | null | undefined)[]) {
  const ids = userIds.filter((x): x is string => !!x);
  const key = ids.join(',');
  const [data, setData] = useState<Record<string, Reputation>>({});
  useEffect(() => {
    if (!key) return;
    api.reputation(key.split(',')).then(setData).catch(() => {});
  }, [key]);
  return data;
}

/** "15 completed · 1 missed", or "New member" before the first completed pickup. */
export function ReputationLine({ reputation, light }: { reputation?: Reputation; light?: boolean }) {
  const { t } = useTranslation();
  if (!reputation) return null;
  const color = light ? colors.onPrimaryContainer : colors.onSurfaceVariant;
  const parts: string[] = [];
  if (reputation.completed) parts.push(t('reputation.completed', { count: reputation.completed }));
  if (reputation.no_shows) parts.push(t('reputation.noShows', { count: reputation.no_shows }));
  if (reputation.late_drops) parts.push(t('reputation.lateDrops', { count: reputation.late_drops }));
  return (
    <Row gap={6} style={{ flexWrap: 'wrap' }}>
      <Icon name="verified" size={16} color={light ? colors.onPrimary : colors.primary} />
      <Text variant="bodySmall" style={{ color }}>
        {parts.length ? parts.join(' · ') : t('reputation.newMember')}
      </Text>
    </Row>
  );
}

type Answers = Record<string, boolean>;

/**
 * After a stop is done, the current user answers a few yes/no questions about the other
 * person, plus an optional note. Only the coordinator reads other people's feedback.
 */
export function RatingCard({ request, rateeRole }: { request: PickupRequest; rateeRole: Role }) {
  const { t } = useTranslation();
  const [existing, setExisting] = useState<Rating | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [answers, setAnswers] = useState<Answers>({});
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .myRating(request.id)
      .catch(() => null)
      .then((r) => {
        if (!alive) return;
        setExisting(r);
        if (r) {
          setAnswers(r.answers);
          setComment(r.comment ?? '');
        }
      });
    return () => {
      alive = false;
    };
  }, [request.id, version]);

  const done = ['picked_up', 'deposited', 'no_show'].includes(request.status);
  const hasOther = rateeRole === 'driver' ? !!request.driver_id : !!request.donor_id;
  if (!done || !hasOther || existing === undefined) return null;

  const questions = FEEDBACK_QUESTIONS[rateeRole];
  const title = rateeRole === 'driver' ? t('rating.titleDriver') : t('rating.titleDonor');

  if (existing && !editing) {
    return (
      <Card tone="low">
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="eyebrow">{t('rating.yourFeedback')}</Text>
          <Pressable onPress={() => setEditing(true)} hitSlop={8}>
            <Text variant="label" style={{ color: colors.primary }}>
              {t('rating.edit')}
            </Text>
          </Pressable>
        </Row>
        {questions.map((q) =>
          existing.answers[q] === undefined ? null : (
            <Row key={q} gap={space.sm}>
              <Text variant="bodySmall" style={{ flex: 1 }}>
                {t(`rating.questions.${q}`)}
              </Text>
              <Text variant="label">{existing.answers[q] ? t('common.yes') : t('common.no')}</Text>
            </Row>
          ),
        )}
        {existing.comment ? <Text variant="bodySmall">“{existing.comment}”</Text> : null}
        <PrivateNote />
      </Card>
    );
  }

  async function submit() {
    setError(null);
    if (questions.some((q) => answers[q] === undefined)) {
      setError(t('rating.answerAll'));
      return;
    }
    try {
      await api.rate(request.id, answers, comment.trim() || null);
      setEditing(false);
      setVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card tone="secondary">
      <Text variant="eyebrow">{title}</Text>
      <Text variant="title">{t('rating.prompt')}</Text>
      {questions.map((q) => (
        <View key={q} style={{ gap: space.sm }}>
          <Text variant="label">{t(`rating.questions.${q}`)}</Text>
          <Row gap={space.sm}>
            {[true, false].map((value) => {
              const on = answers[q] === value;
              return (
                <Pressable
                  key={String(value)}
                  onPress={() => setAnswers((a) => ({ ...a, [q]: value }))}
                  style={[styles.choice, on && { backgroundColor: colors.primary }]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                >
                  <Text style={[styles.choiceText, { color: on ? colors.onPrimary : colors.onSurfaceVariant }]}>
                    {value ? t('common.yes') : t('common.no')}
                  </Text>
                </Pressable>
              );
            })}
          </Row>
        </View>
      ))}
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder={t('rating.commentPlaceholder')}
        placeholderTextColor={colors.outline}
        style={styles.comment}
        multiline
      />
      <PrivateNote />
      <ErrorText message={error} />
      <Button label={t('rating.submit')} icon="send" onPress={submit} />
    </Card>
  );
}

function PrivateNote() {
  const { t } = useTranslation();
  return (
    <Row gap={6}>
      <Icon name="lock" size={14} color={colors.onSurfaceVariant} />
      <Text variant="bodySmall" style={{ flex: 1 }}>
        {t('rating.private')}
      </Text>
    </Row>
  );
}

const styles = StyleSheet.create({
  choice: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLowest,
  },
  choiceText: { fontFamily: fonts.bodySemi, fontSize: 14 },
  comment: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.md,
    padding: space.md,
    minHeight: 72,
    textAlignVertical: 'top',
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.onSurface,
  },
});
