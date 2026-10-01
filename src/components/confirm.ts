import { Alert, Platform } from 'react-native';

/** Native yes/no dialog; the browser's confirm() on web. */
export function confirmAction(opts: { title: string; message?: string; yes: string; no: string; onYes: () => void }) {
  if (Platform.OS === 'web') {
    if (window.confirm([opts.title, opts.message].filter(Boolean).join('\n\n'))) opts.onYes();
    return;
  }
  Alert.alert(opts.title, opts.message, [
    { text: opts.no, style: 'cancel' },
    { text: opts.yes, style: 'destructive', onPress: opts.onYes },
  ]);
}
