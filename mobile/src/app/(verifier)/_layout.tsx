import { Stack, router } from 'expo-router';
import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

export default function VerifierLayout() {
  const { logout } = useAuthStore();

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#4A148C' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
        headerTitleAlign: 'center',
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={{ marginRight: 16 }}>
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </TouchableOpacity>
        ),
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Review Queue',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.push('/(verifier)/history')} style={{ marginLeft: 16 }}>
              <Ionicons name="time-outline" size={22} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen name="review"  options={{ title: 'Review Submission' }} />
      <Stack.Screen name="history" options={{ title: 'Review History' }} />
    </Stack>
  );
}
