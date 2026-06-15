import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { router, useNavigation } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { stretchesApi, workersApi } from '@/lib/endpoints';
import { parseGeoPoint } from '@/utils/navigation';
import type { Stretch } from '@/types';

const SEAL = require('../../../assets/images/icon.png');

const STATUS_COLOR: Record<string, string> = {
  not_started: '#D32F2F',
  in_progress:  '#F9A825',
  completed:    '#2E7D32',
  verified:     '#2E7D32',
};

export default function WorkerHomeScreen() {
  const { user }     = useAuthStore();
  const navigation   = useNavigation();
  const [stretches, setStretches]       = useState<Stretch[]>([]);
  const [assignedId, setAssignedId]     = useState<string | null>(null);
  const [loading, setLoading]           = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (user?.role === 'field_worker') {
        // Use dedicated /workers/me endpoint — no need to fetch the full list
        const [sRes, meRes] = await Promise.all([
          stretchesApi.list(),
          workersApi.me().catch(() => ({ data: null })),
        ]);
        const aid = (meRes.data as { assigned_stretch_id?: string | null } | null)
          ?.assigned_stretch_id ?? null;
        setAssignedId(aid);
        setStretches(aid ? sRes.data.filter((s) => s.id === aid) : []);
      } else {
        // Admin / other roles see all stretches
        const sRes = await stretchesApi.list();
        setStretches(sRes.data);
        setAssignedId(null);
      }
    } catch {}
    setLoading(false);
  }, [user]);

  useEffect(() => {
    navigation.setOptions({ title: 'My Assignments' });
    load();
  }, [load, navigation]);

  const displayedStretches = stretches;

  const mapMarkers = displayedStretches
    .map((s) => ({ stretch: s, point: parseGeoPoint(s.start_point) }))
    .filter((x) => x.point !== null) as { stretch: Stretch; point: { lat: number; lng: number } }[];

  const polylines = displayedStretches
    .map((s) => ({ stretch: s, start: parseGeoPoint(s.start_point), end: parseGeoPoint(s.end_point) }))
    .filter((x) => x.start && x.end) as { stretch: Stretch; start: { lat: number; lng: number }; end: { lat: number; lng: number } }[];

  const initialRegion = mapMarkers.length > 0
    ? { latitude: mapMarkers[0].point.lat, longitude: mapMarkers[0].point.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }
    : { latitude: 17.2478, longitude: 80.1514, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      {/* Seals + header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center' }}>
        <Image source={SEAL} style={{ width: 52, height: 52, borderRadius: 26 }} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#2E7D32', fontWeight: 'bold', fontSize: 16 }}>DISA QR Verify</Text>
          <Text style={{ color: '#666', fontSize: 12 }}>Khammam Municipal Corporation</Text>
        </View>
        <Image source={SEAL} style={{ width: 52, height: 52, borderRadius: 26 }} />
      </View>

      {/* Welcome */}
      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 20 }}>
          Welcome, {user?.name ?? 'Worker'}
        </Text>
        <Text style={{ color: '#666', fontSize: 13, marginTop: 2 }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </Text>
      </View>

      {/* Quick-action nav bar */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 16 }}>
        <QuickActionButton
          icon="time-outline"
          label="My History"
          color="#1565C0"
          onPress={() => router.push('/(worker)/history')}
        />
        <QuickActionButton
          icon="finger-print-outline"
          label="Attendance"
          color="#6A1B9A"
          onPress={() => router.push('/(worker)/attendance')}
        />
        <QuickActionButton
          icon="refresh-outline"
          label="Refresh"
          color="#00695C"
          onPress={load}
        />
      </View>

      {/* Map */}
      <View style={{ width: '100%', height: 260 }}>
        <MapView
          style={{ flex: 1 }}
          mapType="satellite"
          initialRegion={initialRegion}
          provider={PROVIDER_DEFAULT}
        >
          {polylines.map(({ stretch, start, end }) => (
            <Polyline
              key={`poly-${stretch.id}`}
              coordinates={[
                { latitude: start.lat, longitude: start.lng },
                { latitude: end.lat,   longitude: end.lng },
              ]}
              strokeColor={STATUS_COLOR[stretch.status] ?? '#9ca3af'}
              strokeWidth={4}
            />
          ))}
          {mapMarkers.map(({ stretch, point }) => (
            <Marker
              key={stretch.id}
              coordinate={{ latitude: point.lat, longitude: point.lng }}
              pinColor={STATUS_COLOR[stretch.status] ?? '#9ca3af'}
              title={stretch.name}
            />
          ))}
        </MapView>

        {/* Legend */}
        <View style={{
          position: 'absolute', bottom: 8, right: 8,
          backgroundColor: '#fff', borderRadius: 8, padding: 8,
        }}>
          {[
            { color: '#D32F2F', label: 'Pending' },
            { color: '#F9A825', label: 'Active' },
            { color: '#2E7D32', label: 'Done' },
          ].map((item) => (
            <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.color, marginRight: 6 }} />
              <Text style={{ fontSize: 12, color: '#000' }}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Tasks */}
      <Text style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontWeight: 'bold', color: '#000', fontSize: 18 }}>
        {user?.role === 'field_worker' ? 'Your Assigned Task' : 'All Stretches'}
      </Text>

      {loading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator color="#2E7D32" />
        </View>
      ) : displayedStretches.length === 0 ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Ionicons name="alert-circle-outline" size={40} color="#D32F2F" />
          <Text style={{ color: '#666', marginTop: 8, textAlign: 'center' }}>
            {user?.role === 'field_worker'
              ? 'No stretch assigned to you yet. Contact your supervisor.'
              : 'No stretches found.'}
          </Text>
        </View>
      ) : (
        displayedStretches.map((s) => (
          <TouchableOpacity
            key={s.id}
            onPress={() => router.push({ pathname: '/(worker)/task-location', params: { stretchId: s.id } })}
            style={{
              backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14,
              borderBottomWidth: 1, borderColor: '#F0F0F0',
              borderLeftWidth: 4, borderLeftColor: STATUS_COLOR[s.status] ?? '#9ca3af',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontWeight: 'bold', color: '#000', fontSize: 17, flex: 1 }}>{s.name}</Text>
              <StatusBadge status={s.status} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="location-outline" size={14} color="#2E7D32" style={{ marginRight: 4 }} />
              <Text style={{ color: '#555', fontSize: 13, flex: 1 }}>
                {s.road_name ?? 'Navigate to Start Point'}
              </Text>
              <Text style={{ color: '#2E7D32', fontSize: 13, fontWeight: '500' }}>Open →</Text>
            </View>
          </TouchableOpacity>
        ))
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function QuickActionButton({ icon, label, color, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        flex: 1, backgroundColor: color, borderRadius: 10,
        paddingVertical: 12, alignItems: 'center', gap: 4,
      }}
    >
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; label: string }> = {
    not_started: { bg: '#D32F2F', label: 'PENDING' },
    in_progress:  { bg: '#F57C00', label: 'IN PROGRESS' },
    completed:    { bg: '#1565C0', label: 'SUBMITTED' },
    verified:     { bg: '#2E7D32', label: 'APPROVED' },
  };
  const { bg, label } = cfg[status] ?? { bg: '#9ca3af', label: status.toUpperCase() };
  return (
    <View style={{ backgroundColor: bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>{label}</Text>
    </View>
  );
}
