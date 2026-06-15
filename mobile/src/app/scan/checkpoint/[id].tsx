import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { scanApi } from '@/lib/endpoints';
import { useAuthStore } from '@/store/authStore';

export default function CheckpointDeepLinkScreen() {
  const { id }     = useLocalSearchParams<{ id: string }>();
  const { user }   = useAuthStore();
  const navigation = useNavigation();
  const [status, setStatus] = useState('Verifying checkpoint…');

  useEffect(() => {
    navigation.setOptions({ title: 'QR Checkpoint' });
  }, [navigation]);

  useEffect(() => {
    if (!id) return;
    handle();
  }, [id]);

  async function handle() {
    try {
      const res = await scanApi.checkpoint(id);
      const { checkpoint } = res.data;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Field workers and admins go to the task location screen
      if (user?.role === 'field_worker' || user?.role === 'super_admin') {
        router.replace({
          pathname: '/(worker)/task-location',
          params: { stretchId: checkpoint.stretch_id },
        });
      } else {
        // Other roles just go home
        router.replace('/');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error
        ?? 'Could not verify this checkpoint.';
      setStatus(`Error: ${msg}`);
      Alert.alert('QR Scan Failed', msg, [
        { text: 'OK', onPress: () => router.replace('/') },
      ]);
    }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 32 }}>
      <ActivityIndicator size="large" color="#2E7D32" />
      <Text style={{ marginTop: 20, color: '#333', fontSize: 16, textAlign: 'center' }}>
        {status}
      </Text>
    </View>
  );
}
