import '../global.css';
import { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '@/store/authStore';
import { notificationsApi } from '@/lib/endpoints';

SplashScreen.preventAutoHideAsync();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const { hydrated, hydrate, user } = useAuthStore();
  const [isOffline, setIsOffline]   = useState(false);
  const notifRef    = useRef<Notifications.EventSubscription | null>(null);
  const pendingLink = useRef<string | null>(null);

  // Offline banner
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });
    return unsub;
  }, []);

  // Capture initial deep-link URL (cold start) and foreground URL changes
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) pendingLink.current = url;
    });

    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url) {
        pendingLink.current = url;
        // If already authenticated, process immediately
        if (useAuthStore.getState().user) {
          processDeepLink(url);
          pendingLink.current = null;
        }
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    SplashScreen.hideAsync();

    if (!user) {
      router.replace('/(auth)/login');
      return;
    }

    registerPush();

    // Process any pending deep link before falling back to role redirect
    if (pendingLink.current) {
      const url = pendingLink.current;
      pendingLink.current = null;
      if (processDeepLink(url)) return;
    }

    redirectByRole();
  }, [hydrated, user]);

  // Returns true if a deep link was handled (so we skip role redirect)
  function processDeepLink(url: string): boolean {
    const cpMatch = url.match(/\/scan\/checkpoint\/([a-f0-9-]{36})/i);
    const wkMatch = url.match(/\/scan\/worker\/([a-f0-9-]{36})/i);

    if (cpMatch) {
      router.replace({ pathname: '/scan/checkpoint/[id]', params: { id: cpMatch[1] } });
      return true;
    }
    if (wkMatch) {
      router.replace({ pathname: '/scan/worker/[id]', params: { id: wkMatch[1] } });
      return true;
    }
    return false;
  }

  async function registerPush() {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;
      const tokenData = await Notifications.getExpoPushTokenAsync();
      await notificationsApi.saveToken(tokenData.data).catch(() => {});
    } catch {}
  }

  function redirectByRole() {
    if (!user) return;
    switch (user.role) {
      case 'field_worker': router.replace('/(worker)/');       break;
      case 'super_admin':  router.replace('/(admin)/');        break;
      case 'commissioner': router.replace('/(commissioner)/'); break;
      case 'verifier':     router.replace('/(verifier)/');     break;
      default:             router.replace('/(auth)/login');
    }
  }

  // Notification tap → verifier queue
  useEffect(() => {
    notifRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      if (data?.type === 'new_task' && user?.role === 'verifier') {
        router.push('/(verifier)/');
      }
    });
    return () => notifRef.current?.remove();
  }, [user]);

  if (!hydrated) return null;

  return (
    <>
      <StatusBar style="light" />
      {isOffline && (
        <View style={{ backgroundColor: '#D32F2F', paddingVertical: 8, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
            No internet connection
          </Text>
        </View>
      )}
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
