import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { api } from '@/lib/api';
import { colors, radius } from '@/theme';

/** Shows a stored pickup photo (resolves private storage refs to a viewable URL). */
export function StopPhoto({ photoRef, height = 200 }: { photoRef: string; height?: number }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api.photoUrl(photoRef).then((u) => alive && setUri(u)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [photoRef]);
  return (
    <View style={{ height, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceContainerHigh }}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
    </View>
  );
}
