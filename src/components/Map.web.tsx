import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LatLng } from '@/lib/types';
import { mapHtml, type MapPin, type MapState } from './map-html';

export type { MapPin };

// Web preview: the same Leaflet page as native, in an iframe.
export function Map({
  pins,
  focus,
  me,
  onPinPress,
  style,
}: {
  pins: MapPin[];
  focus?: LatLng | null;
  me?: LatLng | null;
  onPinPress?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => mapHtml(), []);
  const json = JSON.stringify({ pins, focus: focus ?? null, me: me ?? null } satisfies MapState);
  const onPinRef = useRef(onPinPress);

  useEffect(() => {
    onPinRef.current = onPinPress;
  });

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== frame.current?.contentWindow || typeof e.data !== 'string') return;
      const msg = JSON.parse(e.data) as { type: string; id?: string };
      if (msg.type === 'ready') setReady(true);
      if (msg.type === 'pin' && msg.id) onPinRef.current?.(msg.id);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    const win = frame.current?.contentWindow as (Window & { update?: (s: MapState) => void }) | null;
    if (ready) win?.update?.(JSON.parse(json));
  }, [ready, json]);

  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      <iframe ref={frame} srcDoc={html} title="map" style={{ border: 0, width: '100%', height: '100%' }} />
    </View>
  );
}
