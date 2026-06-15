import { Platform, Linking, Alert } from 'react-native';

export function openNavigation(lat: number, lng: number, label = 'Destination') {
  const url = Platform.OS === 'ios'
    ? `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`
    : `https://maps.google.com/?daddr=${lat},${lng}&dirflg=d`;

  Linking.canOpenURL(url).then((supported) => {
    if (supported) {
      Linking.openURL(url);
    } else {
      Alert.alert('Maps not available', `Navigate to: ${label}\nLat: ${lat}, Lng: ${lng}`);
    }
  });
}

export function parseGeoPoint(raw: string | null): { lat: number; lng: number } | null {
  if (!raw) return null;
  try {
    const geo = JSON.parse(raw) as { coordinates?: [number, number] };
    if (!geo.coordinates) return null;
    const [lng, lat] = geo.coordinates;
    return { lat, lng };
  } catch {
    return null;
  }
}
