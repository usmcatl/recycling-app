import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import type { LatLng } from '@/lib/types';
import { mapHtml, type MapPin, type MapState } from './map-html';

export type { MapPin };

export function Map({
  pins,
  focus,
  me,
  onPinPress,
  style,
}: {
  pins: MapPin[];
  focus?: LatLng | null;
  /** the current user's own position, drawn as a blue dot */
  me?: LatLng | null;
  onPinPress?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const html = useMemo(() => mapHtml(), []);
  const state: MapState = { pins, focus: focus ?? null, me: me ?? null };
  const json = JSON.stringify(state);

  useEffect(() => {
    if (ready) ref.current?.injectJavaScript(`window.update(${json}); true;`);
  }, [ready, json]);

  return (
    <WebView
      ref={ref}
      style={[StyleSheet.absoluteFill, style]}
      source={{ html, baseUrl: 'https://localhost/' }}
      originWhitelist={['*']}
      javaScriptEnabled
      onMessage={(e) => {
        const msg = JSON.parse(e.nativeEvent.data) as { type: string; id?: string };
        if (msg.type === 'ready') setReady(true);
        if (msg.type === 'pin' && msg.id) onPinPress?.(msg.id);
      }}
    />
  );
}
