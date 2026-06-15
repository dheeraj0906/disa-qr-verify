import { Stack, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';

export default function AdminLayout() {
  const { logout } = useAuthStore();

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1B5E20' },
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
      <Stack.Screen name="index"        options={{ title: 'Admin Dashboard' }} />
      <Stack.Screen name="task-details" options={{ title: 'Task Details' }} />
      <Stack.Screen name="review"       options={{ title: 'Review Submission' }} />
    </Stack>
  );
}
