import { Pressable, StyleSheet, View } from 'react-native';

import { formatShortDate } from '@/lib/format';
import { ageRatingCode, movieTitle } from '@/lib/labels';
import { colors, radius, shadow, spacing } from '@/theme';
import type { PublicMovie } from '@/types/api';

import { AppText, Poster } from './ui';

export function MovieCard({ movie, onPress }: { movie: PublicMovie; onPress: () => void }) {
  const coming = movie.displayStatus === 'COMING_SOON';
  const age = ageRatingCode(movie.ageRating);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={movieTitle(movie)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.posterWrap}>
        <Poster uri={movie.posterUrl ?? movie.thumbnailUrl} style={styles.poster} />
        {age ? (
          <View style={styles.age}>
            <AppText style={styles.ageText}>{age}</AppText>
          </View>
        ) : null}
      </View>
      <AppText numberOfLines={2} style={styles.title}>{movieTitle(movie)}</AppText>
      {coming && movie.releaseDate ? (
        <AppText variant="caption" style={{ marginTop: 2 }}>Khởi chiếu {formatShortDate(movie.releaseDate)}</AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, maxWidth: '50%', paddingHorizontal: spacing.sm, marginBottom: spacing.lg },
  posterWrap: { borderRadius: radius.sm, ...shadow, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  poster: { width: '100%', aspectRatio: 2 / 3, borderRadius: radius.sm },
  age: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  ageText: { color: '#fff', fontWeight: '800', fontSize: 10, lineHeight: 14 },
  title: { marginTop: spacing.sm, fontWeight: '600', fontSize: 14, lineHeight: 18 },
});
