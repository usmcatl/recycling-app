import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { api } from '@/lib/api';
import { RATING_TAGS } from '@/lib/constants';
import type { PickupRequest, Rating, Reputation, Role } from '@/lib/types';
import { colors, fonts, radius, space } from '@/theme';
import { Button, Card, ErrorText, Icon, Row, Text } from './ui';

const STAR = '#e8a317';

export function Stars({ value, onChange, size = 20 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <Row gap={onChange ? 6 : 2}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = value >= n ? 'star' : value >= n - 0.5 ? 'star-half' : 'star-border';
        const star = <Icon name={icon} size={size} color={value >= n - 0.5 ? STAR : colors.outlineVariant} />;
        return onChange ? (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${n}`}>
            {star}
          </Pressable>
        ) : (
          <View key={n}>{star}</View>
        );
      })}
    </Row>
  );
}

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

/** "★ 4.8 (12) · 15 completed · 1 missed" */
export function ReputationLine({ reputation, light }: { reputation?: Reputation; light?: boolean }) {
  const { t } = useTranslation();
  if (!reputation) return null;
  const color = light ? colors.onPrimaryContainer : colors.onSurfaceVariant;
  const parts = [t('reputation.completed', { count: reputation.completed })];
  if (reputation.no_shows) parts.push(t('reputation.noShows', { count: reputation.no_shows }));
  if (reputation.late_drops) parts.push(t('reputation.lateDrops', { count: reputation.late_drops }));
  return (
    <Row gap={6} style={{ flexWrap: 'wrap' }}>
      {reputation.rating_avg != null ? (
        <Row gap={4}>
          <Icon name="star" size={16} color={STAR} />
          <Text variant="label" style={{ color: light ? colors.onPrimary : colors.onSurface }}>
            {t('reputation.rating', { avg: reputation.rating_avg.toFixed(1), count: reputation.rating_count })}
          </Text>
        </Row>
      ) : (
        <Text variant="label" style={{ color }}>
          {t('reputation.noRatings')}
        </Text>
      )}
      <Text variant="bodySmall" style={{ color }}>
        · {parts.join(' · ')}
      </Text>
    </Row>
  );
}

/**
 * After a stop is done, the current user rates the other person (1–5 stars,
 * quick tags, optional comment). Shows their existing rating with a Change button.
 */
export function RatingCard({ request, rateeRole }: { request: PickupRequest; rateeRole: Role }) {
  const { t } = useTranslation();
  const [existing, setExisting] = useState<Rating | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
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
          setStars(r.stars);
          setTags(r.tags);
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

  const title = rateeRole === 'driver' ? t('rating.rateDriver') : t('rating.rateDonor');

  if (existing && !editing) {
    return (
      <Card tone="low">
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="eyebrow">{t('rating.yourRating')}</Text>
          <Pressable onPress={() => setEditing(true)} hitSlop={8}>
            <Text variant="label" style={{ color: colors.primary }}>
              {t('rating.edit')}
            </Text>
          </Pressable>
        </Row>
        <Stars value={existing.stars} size={24} />
        {existing.tags.length ? (
          <Text variant="bodySmall">{existing.tags.map((x) => t(`rating.tags.${x}`)).join(' · ')}</Text>
        ) : null}
        {existing.comment ? <Text variant="bodySmall">“{existing.comment}”</Text> : null}
      </Card>
    );
  }

  async function submit() {
    setError(null);
    try {
      await api.rate(request.id, stars, tags, comment.trim() || null);
      setEditing(false);
      setVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const options = RATING_TAGS[rateeRole];

  return (
    <Card tone="secondary">
      <Text variant="eyebrow">{title}</Text>
      <Text variant="title">{t('rating.prompt')}</Text>
      <Stars value={stars} onChange={setStars} size={36} />
      {stars > 0 ? (
        <>
          <Text variant="eyebrow">{t('rating.tagsTitle')}</Text>
          <View style={styles.tags}>
            {options.map((tag) => {
              const on = tags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => setTags((prev) => (on ? prev.filter((x) => x !== tag) : [...prev, tag]))}
                  style={[styles.tag, on && { backgroundColor: colors.primary }]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <Text style={[styles.tagText, { color: on ? colors.onPrimary : colors.onSurfaceVariant }]}>
                    {t(`rating.tags.${tag}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder={t('rating.commentPlaceholder')}
            placeholderTextColor={colors.outline}
            style={styles.comment}
            multiline
          />
          <ErrorText message={error} />
          <Button label={t('rating.submit')} icon="send" onPress={submit} />
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceContainerLowest,
  },
  tagText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
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
