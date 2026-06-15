import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, ScrollView, Image,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/lib/endpoints';

const SEAL_TN  = require('../../../assets/images/icon.png');
const SEAL_KMC = require('../../../assets/images/icon.png');

export default function LoginScreen() {
  const { login, user } = useAuthStore();
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [slowHint, setSlowHint]   = useState(false);
  const slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Biometric auto-login if token already saved
  useEffect(() => {
    (async () => {
      const saved = await SecureStore.getItemAsync('disa_jwt');
      if (!saved) return;
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled  = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login to DISA QR Verify',
        fallbackLabel: 'Use password',
      });
      if (result.success) {
        // Token already in store — root layout will redirect
        router.replace('/');
      }
    })();
  }, []);

  useEffect(() => {
    if (loading) {
      slowTimer.current = setTimeout(() => setSlowHint(true), 8000);
    } else {
      if (slowTimer.current) clearTimeout(slowTimer.current);
      setSlowHint(false);
    }
    return () => { if (slowTimer.current) clearTimeout(slowTimer.current); };
  }, [loading]);

  async function handleLogin() {
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const res = await authApi.login(email.trim().toLowerCase(), password);
      await login(res.data.token, res.data.user);
      router.replace('/');
    } catch (err: unknown) {
      const isTimeout = (err as { code?: string }).code === 'ECONNABORTED';
      const msg = isTimeout
        ? 'Server is waking up — please try again in a few seconds.'
        : ((err as { response?: { data?: { error?: string } } }).response?.data?.error
            ?? 'Login failed. Check your credentials.');
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#F5F5F5' }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        {/* Seals row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
          <Image source={SEAL_TN}  style={{ width: 70, height: 70, borderRadius: 35 }} />
          <Image source={SEAL_KMC} style={{ width: 70, height: 70, borderRadius: 35 }} />
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: '#E0E0E0' }} />

        {/* Spacer */}
        <View style={{ height: 80 }} />

        {/* Card */}
        <View style={{
          backgroundColor: '#fff', borderRadius: 16,
          marginHorizontal: 20, padding: 24,
          shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
        }}>
          <Text style={{ fontWeight: 'bold', color: '#2E7D32', fontSize: 28, textAlign: 'center', marginBottom: 8 }}>
            Cleaning Task App
          </Text>
          <Text style={{ color: '#666', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
            Welcome back! Please login to continue.
          </Text>

          {/* Email */}
          <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#000', marginBottom: 6 }}>
            Email Address
          </Text>
          <TextInput
            style={{
              borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8,
              padding: 14, fontSize: 16, marginBottom: 16, color: '#000',
            }}
            placeholder="you@disa.gov"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            editable={!loading}
          />

          {/* Password */}
          <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#000', marginBottom: 6 }}>
            Password
          </Text>
          <View style={{
            flexDirection: 'row', alignItems: 'center',
            borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, marginBottom: 24,
          }}>
            <TextInput
              style={{ flex: 1, padding: 14, fontSize: 16, color: '#000' }}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={{ paddingHorizontal: 14 }}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={22} color="#9ca3af" />
            </TouchableOpacity>
          </View>

          {/* Login button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#4a9e4f' : '#1B5E20',
              borderRadius: 8, height: 52,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16, letterSpacing: 1.5 }}>LOGIN</Text>
            }
          </TouchableOpacity>

          {slowHint && (
            <Text style={{ color: '#666', fontSize: 12, textAlign: 'center', marginTop: 12 }}>
              Server is waking up from sleep — this may take up to 30s…
            </Text>
          )}

          {/* Register row */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16 }}>
            <Text style={{ color: '#666' }}>Don't have an account? </Text>
            <Text style={{ color: '#2E7D32', fontWeight: 'bold' }}>Register</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
