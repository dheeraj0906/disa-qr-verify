import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Dimensions,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { stretchesApi, taskLogsApi, checkpointsApi } from '@/lib/endpoints';
import { parseGeoPoint } from '@/utils/navigation';
import { formatIST } from '@/utils/formatIST';
import type { TaskLog, Stretch, Checkpoint } from '@/types';

const { height: H } = Dimensions.get('window');

export default function TaskDetailsScreen() {
  const { logId } = useLocalSearchParams<{ logId: string }>();
  const navigation = useNavigation();
  const [log, setLog]             = useState<TaskLog | null>(null);
  const [stretch, setStretch]     = useState<Stretch | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    navigation.setOptions({ title: 'Task Details' });
    loadData();
  }, []);

  async function loadData() {
    try {
      const [logsRes, stretchesRes, checkpointsRes] = await Promise.all([
        taskLogsApi.list(),
        stretchesApi.list(),
        checkpointsApi.list(),
      ]);
      const foundLog = logsRes.data.find((l) => l.id === logId) ?? null;
      setLog(foundLog);
      if (foundLog) {
        const foundStretch = stretchesRes.data.find((s) => s.name === foundLog.stretch_name) ?? null;
        setStretch(foundStretch);
        if (foundStretch) {
          setCheckpoints(checkpointsRes.data.filter((c) => c.stretch_id === foundStretch.id));
        }
      }
    } catch {}
    setLoading(false);
  }

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color="#1B5E20" size="large" />
    </View>
  );

  if (!log) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#666' }}>Task log not found.</Text>
    </View>
  );

  const startPt = parseGeoPoint(stretch?.start_point ?? null);
  const endPt   = parseGeoPoint(stretch?.end_point ?? null);
  const mapRegion = startPt
    ? { latitude: startPt.lat, longitude: startPt.lng, latitudeDelta: 0.015, longitudeDelta: 0.015 }
    : { latitude: 17.2478, longitude: 80.1514, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      {/* Map */}
      <View style={{ width: '100%', height: H * 0.4 }}>
        <MapView
          style={{ flex: 1 }}
          mapType="satellite"
          initialRegion={mapRegion}
          provider={PROVIDER_DEFAULT}
        >
          {startPt && endPt && (
            <Polyline
              coordinates={[
                { latitude: startPt.lat, longitude: startPt.lng },
                { latitude: endPt.lat,   longitude: endPt.lng },
              ]}
              strokeColor="#2E7D32"
              strokeWidth={5}
            />
          )}
          {startPt && <Marker coordinate={{ latitude: startPt.lat, longitude: startPt.lng }} pinColor="#2196F3" title="Start" />}
          {endPt   && <Marker coordinate={{ latitude: endPt.lat,   longitude: endPt.lng }}   pinColor="#E65100" title="End" />}
          {checkpoints.map((cp) => {
            const pt = parseGeoPoint(cp.location ?? null);
            if (!pt || cp.type === 'start' || cp.type === 'end') return null;
            return <Marker key={cp.id} coordinate={{ latitude: pt.lat, longitude: pt.lng }} pinColor="#F9A825" title="Checkpoint" />;
          })}
        </MapView>
      </View>

      <View style={{ padding: 16 }}>
        <Text style={{ fontWeight: 'bold', color: '#000', fontSize: 22, marginBottom: 4 }}>
          {log.stretch_name ?? '—'}
        </Text>
        <Text style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>
          {log.checkpoint_type?.toUpperCase()} checkpoint • {formatIST(log.scanned_at)}
        </Text>

        {/* Worker / scan info */}
        <InfoRow label="Worker"    value={log.worker_name ?? '—'} />
        <InfoRow label="Scan Type" value={log.scan_type} />
        <InfoRow label="Duration"  value={log.duration ?? '—'} />
        <InfoRow label="Status"    value={log.verification_status} />
        {log.remark && <InfoRow label="Remark" value={log.remark} />}

        {/* Photos */}
        {(log.before_photo_url || log.after_photo_url) && (
          <>
            <Text style={{ fontWeight: 'bold', color: '#000', fontSize: 16, marginTop: 20, marginBottom: 12 }}>Photos</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {log.before_photo_url && (
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#666', marginBottom: 4 }}>Before</Text>
                  <Image source={{ uri: log.before_photo_url }} style={{ width: '100%', height: 160, borderRadius: 8 }} resizeMode="cover" />
                </View>
              )}
              {log.after_photo_url && (
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#666', marginBottom: 4 }}>After</Text>
                  <Image source={{ uri: log.after_photo_url }} style={{ width: '100%', height: 160, borderRadius: 8 }} resizeMode="cover" />
                </View>
              )}
            </View>
          </>
        )}

        {/* Review button if pending */}
        {log.verification_status === 'pending' && (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/(admin)/review', params: { logId: log.id } })}
            style={{ backgroundColor: '#1B5E20', height: 52, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginTop: 24 }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Review This Submission</Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 40 }} />
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#f0f0f0' }}>
      <Text style={{ color: '#666', width: 100, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: '#000', flex: 1, fontSize: 14, fontWeight: '500' }}>{value}</Text>
    </View>
  );
}
