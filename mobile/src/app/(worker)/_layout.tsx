import { Stack, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

export default function WorkerLayout() {
  const { logout } = useAuthStore();

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#2E7D32' },
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
      <Stack.Screen name="index"         options={{ title: 'My Assignments' }} />
      <Stack.Screen name="history"       options={{ title: 'My History' }} />
      <Stack.Screen name="attendance"    options={{ title: 'My Attendance' }} />
      <Stack.Screen name="task-location" options={{ title: 'Task Location' }} />
      <Stack.Screen name="scan"          options={{ headerShown: false }} />
      <Stack.Screen name="upload"        options={{ title: 'Submit Proof' }} />
    </Stack>
  );
}
