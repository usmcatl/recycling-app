import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LatLng } from '@/lib/types';
import { colors } from '@/theme';
import { Icon, Text } from './ui';

// react-native-maps has no web support. The web build is only used for quick
// previews, so show a placeholder with the same props as the native Map.

export type MapPin = {
  id: string;
  position: LatLng;
  kind: 'pickup' | 'active' | 'driver' | 'center' | 'home';
  title?: string;
};

export function Map({ pins, style }: {
  pins: MapPin[];
  focus?: LatLng | null;
  showsUserLocation?: boolean;
  onPinPress?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.box, style]}>
      <Icon name="map" size={40} color={colors.primaryContainer} />
      <Text variant="bodySmall">Map preview is available in the iOS/Android app · {pins.length} pins</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#dfe7e4' },
});
