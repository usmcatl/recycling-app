import { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { LAKESIDE_CENTER } from '@/lib/constants';
import type { LatLng } from '@/lib/types';
import { colors } from '@/theme';
import { Icon, type IconName } from './ui';

export type MapPin = {
  id: string;
  position: LatLng;
  kind: 'pickup' | 'active' | 'driver' | 'center' | 'home';
  title?: string;
};

const pinStyle: Record<MapPin['kind'], { icon: IconName; bg: string; fg: string }> = {
  pickup: { icon: 'recycling', bg: colors.primary, fg: colors.onPrimary },
  active: { icon: 'local-shipping', bg: colors.tertiaryContainer, fg: colors.onPrimary },
  driver: { icon: 'local-shipping', bg: colors.primary, fg: colors.onPrimary },
  center: { icon: 'eco', bg: colors.secondaryContainer, fg: colors.primary },
  home: { icon: 'home', bg: colors.secondaryContainer, fg: colors.primary },
};

export function Map({
  pins,
  focus,
  showsUserLocation,
  onPinPress,
  style,
}: {
  pins: MapPin[];
  focus?: LatLng | null;
  showsUserLocation?: boolean;
  onPinPress?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<MapView>(null);

  useEffect(() => {
    if (focus) {
      ref.current?.animateToRegion(
        { latitude: focus.lat, longitude: focus.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 },
        400,
      );
    }
    // keyed on the coordinates so a new object with the same position doesn't re-animate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.lat, focus?.lng]);

  return (
    <MapView
      ref={ref}
      style={[StyleSheet.absoluteFill, style]}
      initialRegion={{
        latitude: focus?.lat ?? LAKESIDE_CENTER.lat,
        longitude: focus?.lng ?? LAKESIDE_CENTER.lng,
        latitudeDelta: 0.12,
        longitudeDelta: 0.12,
      }}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      toolbarEnabled={false}
    >
      {pins.map((p) => {
        const s = pinStyle[p.kind];
        return (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.position.lat, longitude: p.position.lng }}
            title={p.title}
            onPress={() => onPinPress?.(p.id)}
            tracksViewChanges={false}
          >
            <View style={[styles.pin, { backgroundColor: s.bg }]}>
              <Icon name={s.icon} size={18} color={s.fg} />
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
