import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { router, useNavigation } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { stretchesApi, taskLogsApi } from '@/lib/endpoints';
import { parseGeoPoint } from '@/utils/navigation';
import { formatIST } from '@/utils/formatIST';
import type { Stretch, TaskLog } from '@/types';

const SEAL = require('../../../assets/images/icon.png');

const STATUS_COLOR: Record<string, string> = {
  not_started: '#D32F2F',
  in_progress:  '#F9A825',
  completed:    '#1565C0',
  verified:     '#2E7D32',
};

export default function AdminDashboardScreen() {
  const navigation = useNavigation();
  const [stretches, setStretches] = useState<Stretch[]>([]);
  const [logs, setLogs]           = useState<TaskLog[]>([]);
  const [loading, setLoading]     = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [sRes, lRes] = await Promise.all([stretchesApi.list(), taskLogsApi.list()]);
      setStretches(sRes.data);
      setLogs(lRes.data.slice(0, 20));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: 'Admin Dashboard' });
    load();
    refreshTimer.current = setInterval(load, 30000);
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [load, navigation]);

  const statusCounts = {
    not_started: stretches.filter((s) => s.status === 'not_started').length,
    in_progress:  stretches.filter((s) => s.status === 'in_progress').length,
    completed:    stretches.filter((s) => s.status === 'completed').length,
    verified:     stretches.filter((s) => s.status === 'verified').length,
  };

  const polylines = stretches.map((s) => ({
    start: parseGeoPoint(s.start_point ?? null),
    end:   parseGeoPoint(s.end_point ?? null),
    color: STATUS_COLOR[s.status] ?? '#9ca3af',
  })).filter((p) => p.start && p.end) as { start: { lat: number; lng: number }; end: { lat: number; lng: number }; color: string }[];

  const mapCenter = polylines.length > 0
    ? { latitude: polylines[0].start.lat, longitude: polylines[0].start.lng, latitudeDelta: 0.06, longitudeDelta: 0.06 }
    : { latitude: 17.2478, longitude: 80.1514, latitudeDelta: 0.06, longitudeDelta: 0.06 };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      {/* Header seals */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
        <Image source={SEAL} style={{ width: 56, height: 56, borderRadius: 28 }} />
        <Image source={SEAL} style={{ width: 56, height: 56, borderRadius: 28 }} />
      </View>

      {/* Status cards */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 }}>
        {[
          { label: 'Pending', count: statusCounts.not_started, color: '#D32F2F' },
          { label: 'Active',  count: statusCounts.in_progress,  color: '#F57C00' },
          { label: 'Done',    count: statusCounts.completed,    color: '#1565C0' },
          { label: 'Approved',count: statusCounts.verified,     color: '#2E7D32' },
        ].map((card) => (
          <View key={card.label} style={{
            width: '48%', margin: '1%', backgroundColor: card.color,
            borderRadius: 12, padding: 14,
          }}>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}>{card.count}</Text>
            <Text style={{ color: '#fff', fontSize: 13, opacity: 0.9 }}>{card.label}</Text>
          </View>
        ))}
      </View>

      {/* Satellite map */}
      <View style={{ width: '100%', height: 300, marginTop: 8 }}>
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
              strokeWidth={4}
            />
          ))}
          {polylines.map((p, i) => (
            <Marker key={`m${i}`} coordinate={{ latitude: p.start.lat, longitude: p.start.lng }} pinColor={p.color} />
          ))}
        </MapView>
      </View>

      {/* Recent logs */}
      <Text style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, fontWeight: 'bold', color: '#000', fontSize: 18 }}>
        Recent Submissions
      </Text>
      {loading ? (
        <View style={{ padding: 32, alignItems: 'center' }}>
          <ActivityIndicator color="#1B5E20" />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(l) => l.id}
          scrollEnabled={false}
          renderItem={({ item: log }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(admin)/task-details', params: { logId: log.id } })}
              style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f0f0f0' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontWeight: 'bold', color: '#000', fontSize: 15, flex: 1 }}>
                  {log.stretch_name ?? '—'}
                </Text>
                <VerifBadge status={log.verification_status} />
              </View>
              <Text style={{ color: '#666', fontSize: 13 }}>
                {log.worker_name ?? 'Unknown Worker'} • {log.scan_type} • {formatIST(log.scanned_at)}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Text style={{ color: '#666' }}>No submissions yet.</Text>
            </View>
          }
        />
      )}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function VerifBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; label: string }> = {
    pending:  { bg: '#F57C00', label: 'PENDING' },
    approved: { bg: '#2E7D32', label: 'APPROVED' },
    rejected: { bg: '#D32F2F', label: 'REJECTED' },
    'n/a':    { bg: '#9ca3af', label: 'N/A' },
  };
  const { bg, label } = cfg[status] ?? { bg: '#9ca3af', label: status };
  return (
    <View style={{ backgroundColor: bg, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>{label}</Text>
    </View>
  );
}
