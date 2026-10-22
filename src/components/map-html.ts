import { LAKESIDE_CENTER } from '@/lib/constants';
import type { LatLng } from '@/lib/types';
import { colors } from '@/theme';

// OpenStreetMap via Leaflet, rendered in a WebView (native) or iframe (web).
// No API key or account needed. The page exposes window.update(state) and
// posts {type:'pin', id} back when a pin is tapped.

export type MapPin = {
  id: string;
  position: LatLng;
  kind: 'pickup' | 'active' | 'driver' | 'center' | 'home';
  title?: string;
};

export type MapState = {
  pins: MapPin[];
  focus: LatLng | null;
  me: LatLng | null;
};

const pinStyle: Record<MapPin['kind'], { bg: string; fg: string; glyph: string }> = {
  pickup: { bg: colors.primary, fg: '#fff', glyph: '♻' },
  active: { bg: colors.tertiaryContainer, fg: '#fff', glyph: '🚚' },
  driver: { bg: colors.primary, fg: '#fff', glyph: '🚚' },
  center: { bg: colors.secondaryContainer, fg: colors.primary, glyph: '🌿' },
  home: { bg: colors.secondaryContainer, fg: colors.primary, glyph: '🏠' },
};

export function mapHtml() {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<style>
  html, body, #map { margin: 0; height: 100%; background: #dfe7e4; }
  .pin { width: 34px; height: 34px; border-radius: 12px; border: 2px solid #fff;
    display: flex; align-items: center; justify-content: center; font-size: 17px;
    box-shadow: 0 4px 14px rgba(25,28,28,0.18); }
  .me { width: 16px; height: 16px; border-radius: 8px; background: #1a73e8; border: 3px solid #fff;
    box-shadow: 0 0 0 6px rgba(26,115,232,0.2); }
  .leaflet-control-attribution { font-size: 9px; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var styles = ${JSON.stringify(pinStyle)};
  var map = L.map('map', { zoomControl: false }).setView([${LAKESIDE_CENTER.lat}, ${LAKESIDE_CENTER.lng}], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  var layer = L.layerGroup().addTo(map);
  var meMarker = null;
  var lastFocus = null;

  function send(msg) {
    var s = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else if (window.parent !== window) window.parent.postMessage(s, '*');
  }

  window.update = function (state) {
    layer.clearLayers();
    (state.pins || []).forEach(function (p) {
      var s = styles[p.kind];
      var icon = L.divIcon({
        className: '',
        html: '<div class="pin" style="background:' + s.bg + ';color:' + s.fg + '">' + s.glyph + '</div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });
      L.marker([p.position.lat, p.position.lng], { icon: icon, title: p.title || '' })
        .on('click', function () { send({ type: 'pin', id: p.id }); })
        .addTo(layer);
    });
    if (state.me) {
      var ll = [state.me.lat, state.me.lng];
      if (meMarker) meMarker.setLatLng(ll);
      else meMarker = L.marker(ll, { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), interactive: false }).addTo(map);
    }
    var f = state.focus;
    var key = f ? f.lat.toFixed(5) + ',' + f.lng.toFixed(5) : null;
    if (f && key !== lastFocus) {
      lastFocus = key;
      map.flyTo([f.lat, f.lng], 14, { duration: 0.5 });
    }
  };
  send({ type: 'ready' });
</script>
</body>
</html>`;
}
