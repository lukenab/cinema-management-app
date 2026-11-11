import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, View, useWindowDimensions } from 'react-native';

import { movieTitle } from '@/lib/labels';
import { colors, radius, shadow, spacing } from '@/theme';
import type { PublicMovie } from '@/types/api';

import { AppText, Poster } from './ui';

/**
 * Full-bleed hero banners made from movie backdrops. The next card peeks in from the
 * right and the page indicator sits underneath. Movies without a backdrop fall back to the poster.
 */
export function HeroCarousel({ movies }: { movies: PublicMovie[] }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const gap = spacing.sm;
  const cardWidth = Math.round(width - spacing.lg * 2 - 12); // leaves a sliver of the next card visible
  const cardHeight = Math.round(cardWidth * 0.5);

  if (!movies.length) return null;

  return (
    <View>
      <FlatList
        horizontal
        data={movies}
        keyExtractor={(m) => String(m.movieId)}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + gap}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap, paddingVertical: spacing.xs }}
        scrollEventThrottle={32}
        onScroll={(e) => setIndex(Math.max(0, Math.min(movies.length - 1, Math.round(e.nativeEvent.contentOffset.x / (cardWidth + gap)))))}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/movie/${item.movieId}`)}
            accessibilityRole="button"
            accessibilityLabel={`Xem phim ${movieTitle(item)}`}
            style={{ width: cardWidth, height: cardHeight, borderRadius: radius.md, overflow: 'hidden', ...shadow, shadowOpacity: 0.1, elevation: 3, backgroundColor: colors.surfaceAlt }}
          >
            <Poster uri={item.backdropUrl ?? item.posterUrl ?? item.thumbnailUrl} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <LinearGradient colors={['transparent', 'rgba(8,20,45,0.78)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' }} />
            <View style={{ position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md }}>
              <AppText numberOfLines={1} style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{movieTitle(item)}</AppText>
              {item.genres.length ? (
                <AppText numberOfLines={1} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>
                  {item.genres.map((g) => g.name ?? g.genreName).filter(Boolean).slice(0, 3).join(' · ')}
                </AppText>
              ) : null}
            </View>
          </Pressable>
        )}
      />
      {movies.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.sm }}>
          {movies.map((m, i) => (
            <View key={m.movieId} style={{ width: i === index ? 8 : 6, height: i === index ? 8 : 6, borderRadius: 4, backgroundColor: i === index ? colors.primary : colors.seatAvailableBorder }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
