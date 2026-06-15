import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, FlatList, ActivityIndicator, Image,
} from 'react-native';
import { useNavigation } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { dashboardApi, attendanceApi } from '@/lib/endpoints';
import { parseGeoPoint } from '@/utils/navigation';
import { formatIST, todayISO } from '@/utils/formatIST';
import type { DashboardData, AttendanceRecord } from '@/types';

const SEAL = require('../../../assets/images/icon.png');

const STATUS_COLOR: Record<string, string> = {
  not_started: '#D32F2F',
  in_progress:  '#F9A825',
  completed:    '#1565C0',
  verified:     '#2E7D32',
};

export default function CommissionerDashboardScreen() {
  const navigation = useNavigation();
  const [data, setData]         = useState<DashboardData | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [countdown, setCountdown] = useState(30);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const countTimer   = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [dashRes, attRes] = await Promise.all([
        dashboardApi.live(todayISO()),
        attendanceApi.list(todayISO()),
      ]);
      setData(dashRes.data);
      setAttendance(attRes.data.records ?? []);
    } catch {}
    setLoading(false);
    setCountdown(30);
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: 'Commissioner Dashboard' });
    load();
    refreshTimer.current = setInterval(load, 30000);
    countTimer.current = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 30)), 1000);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
      if (countTimer.current) clearInterval(countTimer.current);
    };
  }, [load, navigation]);

  const stretches = data?.stretches ?? [];
  const polylines = stretches.map((s) => ({
    start: parseGeoPoint(s.start_point ?? null),
    end:   parseGeoPoint(s.end_point ?? null),
    color: STATUS_COLOR[s.status] ?? '#9ca3af',
    name:  s.name,
    status: s.status,
  })).filter((p) => p.start && p.end) as { start: { lat: number; lng: number }; end: { lat: number; lng: number }; color: string; name: string; status: string }[];

  const mapCenter = polylines.length > 0
    ? { latitude: polylines[0].start.lat, longitude: polylines[0].start.lng, latitudeDelta: 0.06, longitudeDelta: 0.06 }
    : { latitude: 17.2478, longitude: 80.1514, latitudeDelta: 0.06, longitudeDelta: 0.06 };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      {/* Header seals */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center' }}>
        <Image source={SEAL} style={{ width: 56, height: 56, borderRadius: 28 }} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#1565C0', fontWeight: 'bold', fontSize: 16 }}>Live Monitor</Text>
          <Text style={{ color: '#666', fontSize: 12 }}>Refreshes in {countdown}s</Text>
        </View>
        <Image source={SEAL} style={{ width: 56, height: 56, borderRadius: 28 }} />
      </View>

      {/* Summary cards */}
      {data && (
        <View style={{ flexDirection: 'row', paddingHorizontal: 8, marginBottom: 8 }}>
          <SummaryCard label="Present" value={String(data.attendance?.present ?? 0)} color="#2E7D32" />
          <SummaryCard label="Pending" value={String(data.verification?.pending ?? 0)} color="#F57C00" />
          <SummaryCard label="Approved" value={String(data.verification?.approved ?? 0)} color="#1565C0" />
        </View>
      )}

      {/* Satellite Map */}
      <View style={{ width: '100%', height: 320 }}>
        <MapView
          style={{ flex: 1 }}
          mapType="satellite"
          initialRegion={mapCenter}
          provider={PROVIDER_DEFAULT}
        >
          {polylines.map((p, i) => (
            <Polyline
              key={i}
              coordinates={[
                { latitude: p.start.lat, longitude: p.start.lng },
                { latitude: p.end.lat,   longitude: p.end.lng },
              ]}
              strokeColor={p.color}
              strokeWidth={5}
            />
          ))}
          {polylines.map((p, i) => (
            <Marker key={`ms${i}`} coordinate={{ latitude: p.start.lat, longitude: p.start.lng }} pinColor={p.color} title={p.name} />
          ))}
          {polylines.map((p, i) => (
            <Marker key={`me${i}`} coordinate={{ latitude: p.end.lat, longitude: p.end.lng }} pinColor={p.color} />
          ))}
        </MapView>
      </View>

      {/* Stretch list */}
      <Text style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontWeight: 'bold', color: '#000', fontSize: 18 }}>
        Stretch Status
      </Text>
      {loading ? (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <ActivityIndicator color="#1565C0" />
        </View>
      ) : (
        <FlatList
          data={stretches}
          keyExtractor={(s) => s.id}
          scrollEnabled={false}
          renderItem={({ item: s }) => (
            <View style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f0f0f0' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                <Text style={{ fontWeight: 'bold', color: '#000', fontSize: 15, flex: 1 }}>{s.name}</Text>
                <View style={{ backgroundColor: STATUS_COLOR[s.status] ?? '#9ca3af', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>{s.status.replace('_',' ').toUpperCase()}</Text>
                </View>
              </View>
              {s.road_name && <Text style={{ color: '#666', fontSize: 13 }}>{s.road_name}</Text>}
            </View>
          )}
          ListEmptyComponent={<View style={{ padding: 32, alignItems: 'center' }}><Text style={{ color: '#666' }}>No stretches found.</Text></View>}
        />
      )}

      {/* Attendance */}
      <Text style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontWeight: 'bold', color: '#000', fontSize: 18 }}>
        Today's Attendance
      </Text>
      <FlatList
        data={attendance}
        keyExtractor={(r) => r.id}
        scrollEnabled={false}
        renderItem={({ item: r }) => (
          <View style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderColor: '#f0f0f0', flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, color: '#000', fontSize: 14 }}>{r.worker_name ?? 'Worker'}</Text>
            <Text style={{ color: '#666', fontSize: 13, marginRight: 8 }}>{formatIST(r.check_in_time)}</Text>
            {r.is_late && (
              <View style={{ backgroundColor: '#D32F2F', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>LATE</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={<View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: '#666' }}>No attendance records today.</Text></View>}
      />
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, margin: 4, backgroundColor: color, borderRadius: 12, padding: 12 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>{value}</Text>
      <Text style={{ color: '#fff', fontSize: 12, opacity: 0.9 }}>{label}</Text>
    </View>
  );
}
