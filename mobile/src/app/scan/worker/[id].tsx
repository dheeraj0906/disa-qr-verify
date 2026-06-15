import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { scanApi } from '@/lib/endpoints';
import { formatIST } from '@/utils/formatIST';

export default function WorkerDeepLinkScreen() {
  const { id }     = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const [status, setStatus] = useState('Recording attendance…');

  useEffect(() => {
    navigation.setOptions({ title: 'Worker Check-In' });
  }, [navigation]);

  useEffect(() => {
    if (!id) return;
    handle();
  }, [id]);

  async function handle() {
    let lat: number | undefined;
    let lng: number | undefined;

    try {
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      if (locStatus === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
    } catch {}

    try {
      const res = await scanApi.worker(id, lat, lng);
      const { isLate, worker, attendance } = res.data;
      await Haptics.notificationAsync(
        isLate
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Success,
      );

      Alert.alert(
        isLate ? '⚠ Checked In — Late' : '✓ Checked In — On Time',
        `${worker.name}\n${formatIST(attendance.check_in_time)}`,
        [{ text: 'OK', onPress: () => router.replace('/') }],
      );
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error
        ?? 'Check-in failed.';
      setStatus(`Error: ${msg}`);
      Alert.alert('Check-In Failed', msg, [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 32 }}>
      <ActivityIndicator size="large" color="#6A1B9A" />
      <Text style={{ marginTop: 20, color: '#333', fontSize: 16, textAlign: 'center' }}>
        {status}
      </Text>
    </View>
  );
}
