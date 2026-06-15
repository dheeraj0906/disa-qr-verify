import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { attendanceApi, scanApi } from '@/lib/endpoints';
import { formatIST, todayISO } from '@/utils/formatIST';
import { useAuthStore } from '@/store/authStore';
import type { AttendanceRecord } from '@/types';

export default function AttendanceScreen() {
  const navigation = useNavigation();
  const { user }   = useAuthStore();
  const [records, setRecords]       = useState<AttendanceRecord[]>([]);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading]       = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.my();
      const all = res.data;
      setRecords(all);
      const today = todayISO();
      setTodayRecord(all.find((r) => r.date === today) ?? null);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: 'My Attendance' });
    load();
  }, [load, navigation]);

  async function handleCheckIn() {
    if (!user?.workerId) {
      Alert.alert('Error', 'No worker profile linked to your account. Contact your administrator.');
      return;
    }

    setCheckingIn(true);
    try {
      let lat: number | undefined;
      let lng: number | undefined;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Required',
          'Location is needed to record your check-in position.',
          [{ text: 'OK' }],
        );
      } else {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        } catch {}
      }

      const res = await scanApi.worker(user.workerId, lat, lng);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const { isLate } = res.data;
      Alert.alert(
        isLate ? 'Checked In — Late' : 'Checked In — On Time ✓',
        isLate
          ? 'You have been marked late. Please report to your supervisor.'
          : 'Attendance recorded successfully!',
      );
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Check-in failed.';
      Alert.alert('Error', msg);
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      {/* Today's status card */}
      <View style={{
        backgroundColor: '#6A1B9A', padding: 20,
      }}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18, marginBottom: 4 }}>
          Today's Status
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
          })}
        </Text>
      </View>

      {loading ? (
        <View style={{ padding: 60, alignItems: 'center' }}>
          <ActivityIndicator color="#6A1B9A" size="large" />
        </View>
      ) : (
        <>
          {/* Today's record / check-in CTA */}
          <View style={{
            backgroundColor: '#fff', margin: 16, borderRadius: 16, padding: 20,
            elevation: 2,
          }}>
            {todayRecord ? (
              <View style={{ alignItems: 'center' }}>
                <View style={{
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: todayRecord.is_late ? '#FFF3E0' : '#E8F5E9',
                  justifyContent: 'center', alignItems: 'center', marginBottom: 12,
                }}>
                  <Ionicons
                    name={todayRecord.is_late ? 'warning-outline' : 'checkmark-circle-outline'}
                    size={40}
                    color={todayRecord.is_late ? '#E65100' : '#2E7D32'}
                  />
                </View>
                <Text style={{ fontWeight: 'bold', fontSize: 20, color: '#000', marginBottom: 4 }}>
                  {todayRecord.is_late ? 'Late' : 'On Time'}
                </Text>
                <Text style={{ color: '#666', fontSize: 15 }}>
                  Checked in at {formatIST(todayRecord.check_in_time)}
                </Text>
                {todayRecord.is_late && (
                  <View style={{
                    backgroundColor: '#FFF3E0', borderRadius: 8, paddingHorizontal: 12,
                    paddingVertical: 6, marginTop: 12,
                  }}>
                    <Text style={{ color: '#E65100', fontSize: 13 }}>
                      Reported after the 07:00 IST threshold.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={{ alignItems: 'center' }}>
                <View style={{
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: '#E3F2FD',
                  justifyContent: 'center', alignItems: 'center', marginBottom: 12,
                }}>
                  <Ionicons name="finger-print-outline" size={40} color="#1565C0" />
                </View>
                <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#000', marginBottom: 6 }}>
                  Not Checked In
                </Text>
                <Text style={{ color: '#666', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
                  Tap below to record your attendance for today.
                </Text>
                <TouchableOpacity
                  onPress={handleCheckIn}
                  disabled={checkingIn}
                  style={{
                    backgroundColor: checkingIn ? '#9e7ab5' : '#6A1B9A',
                    borderRadius: 12, height: 52, paddingHorizontal: 40,
                    justifyContent: 'center', alignItems: 'center', width: '100%',
                  }}
                >
                  {checkingIn
                    ? <ActivityIndicator color="#fff" />
                    : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="location-outline" size={20} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                          Check In Now
                        </Text>
                      </View>
                    )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* History */}
          <Text style={{ paddingHorizontal: 16, paddingBottom: 8, fontWeight: 'bold', color: '#000', fontSize: 18 }}>
            Recent Attendance
          </Text>
          {records.length === 0 ? (
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{ color: '#888' }}>No attendance records yet.</Text>
            </View>
          ) : (
            records.slice(0, 30).map((r) => (
              <View key={r.id} style={{
                backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
                borderBottomWidth: 1, borderColor: '#f0f0f0',
                flexDirection: 'row', alignItems: 'center',
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#000', fontWeight: '500', fontSize: 14 }}>
                    {new Date(r.date).toLocaleDateString('en-IN', {
                      weekday: 'short', day: 'numeric', month: 'short',
                    })}
                  </Text>
                  <Text style={{ color: '#888', fontSize: 13 }}>
                    {formatIST(r.check_in_time)}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: r.is_late ? '#E65100' : '#2E7D32',
                  borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4,
                }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>
                    {r.is_late ? 'LATE' : 'ON TIME'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </>
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
