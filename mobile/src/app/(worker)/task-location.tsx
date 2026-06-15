import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Dimensions, Animated, ScrollView,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { stretchesApi, checkpointsApi } from '@/lib/endpoints';
import { openNavigation, parseGeoPoint } from '@/utils/navigation';
import { useTaskStore } from '@/store/taskStore';
import type { Stretch, Checkpoint } from '@/types';

const { height: SCREEN_H } = Dimensions.get('window');

export default function TaskLocationScreen() {
  const { stretchId }   = useLocalSearchParams<{ stretchId: string }>();
  const navigation      = useNavigation();
  const { setActiveScan } = useTaskStore();

  const [stretch, setStretch]         = useState<Stretch | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    navigation.setOptions({ title: 'Task Location', headerBackTitle: '← My Assignments' });
    startPulse();
  }, [navigation]);

  // Reload data every time this screen comes into focus (e.g. returning from scan screen)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [stretchId]),
  );

  async function loadData() {
    try {
      const [sRes, cRes] = await Promise.all([stretchesApi.list(), checkpointsApi.list()]);
      const found = sRes.data.find((s) => s.id === stretchId) ?? null;
      setStretch(found);
      setCheckpoints(cRes.data.filter((c) => c.stretch_id === stretchId));
    } catch {}
  }

  function startPulse() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ).start();
  }

  const startCheckpoint = checkpoints.find((c) => c.type === 'start');
  const startPoint      = parseGeoPoint(startCheckpoint?.location ?? null);
  const initialRegion   = startPoint
    ? { latitude: startPoint.lat, longitude: startPoint.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : { latitude: 17.2478, longitude: 80.1514, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  const status = stretch?.status ?? 'not_started';

  return (
    <View style={{ flex: 1 }}>
      {/* Map */}
      <MapView
        style={{ width: '100%', height: SCREEN_H * 0.55 }}
        mapType="satellite"
        initialRegion={initialRegion}
        provider={PROVIDER_DEFAULT}
      >
        {/* Pulsing GPS dot at start point */}
        {startPoint && (
          <Marker coordinate={{ latitude: startPoint.lat, longitude: startPoint.lng }}>
            <View style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View style={{
                width: 30, height: 30, borderRadius: 15,
                backgroundColor: 'rgba(33,150,243,0.3)',
                position: 'absolute',
                opacity: pulseAnim,
              }} />
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#2196F3' }} />
            </View>
          </Marker>
        )}
        {/* Checkpoint markers */}
        {checkpoints.map((cp) => {
          const pt = parseGeoPoint(cp.location ?? null);
          if (!pt) return null;
          return (
            <Marker
              key={cp.id}
              coordinate={{ latitude: pt.lat, longitude: pt.lng }}
              pinColor={cp.type === 'start' ? '#2196F3' : cp.type === 'end' ? '#E65100' : '#F9A825'}
              title={`${cp.type.toUpperCase()} checkpoint`}
            />
          );
        })}
      </MapView>

      {/* Bottom info */}
      <ScrollView style={{ flex: 1, backgroundColor: '#fff', padding: 16 }}>
        <Text style={{ fontWeight: 'bold', color: '#000', fontSize: 22, marginBottom: 4 }}>
          {stretch?.name ?? 'Loading…'}
        </Text>
        {stretch?.road_name ? (
          <Text style={{ color: '#666', fontSize: 14, marginBottom: 8 }}>{stretch.road_name}</Text>
        ) : null}

        <StatusBadgePill status={status} />

        <View style={{ height: 16 }} />

        {/* PENDING state buttons */}
        {(status === 'not_started') && (
          <View style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={() => startPoint && openNavigation(startPoint.lat, startPoint.lng, stretch?.name)}
              style={{ backgroundColor: '#D32F2F', height: 52, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>🚩 Navigate to Start Point</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (startCheckpoint && stretch) {
                  setActiveScan(startCheckpoint, stretch, 'start');
                  router.push({ pathname: '/(worker)/scan', params: { stretchId, scanType: 'start' } });
                }
              }}
              style={{ backgroundColor: '#1565C0', height: 52, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>📷 Scan Start QR at Source</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* IN PROGRESS state buttons */}
        {(status === 'in_progress') && (
          <View style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={() => startPoint && openNavigation(startPoint.lat, startPoint.lng, stretch?.name)}
              style={{ backgroundColor: '#D32F2F', height: 52, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>🚩 Re-Navigate to Start</Text>
            </TouchableOpacity>
            {(() => {
              const endCp = checkpoints.find((c) => c.type === 'end');
              return (
                <TouchableOpacity
                  onPress={() => {
                    if (endCp && stretch) {
                      setActiveScan(endCp, stretch, 'end');
                      router.push({ pathname: '/(worker)/scan', params: { stretchId, scanType: 'end' } });
                    }
                  }}
                  style={{ backgroundColor: '#E65100', height: 52, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>📷 Scan End QR at Destination</Text>
                </TouchableOpacity>
              );
            })()}
          </View>
        )}

        {/* COMPLETED state */}
        {(status === 'completed' || status === 'verified') && (
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/(worker)/upload', params: { stretchId } })}
            style={{ backgroundColor: '#2E7D32', height: 52, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
              📸 Capture Final Proof for Supervisor
            </Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function StatusBadgePill({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; label: string }> = {
    not_started: { bg: '#D32F2F', label: 'PENDING' },
    in_progress:  { bg: '#F57C00', label: 'IN PROGRESS' },
    completed:    { bg: '#1565C0', label: 'SUBMITTED' },
    verified:     { bg: '#2E7D32', label: 'APPROVED' },
  };
  const { bg, label } = cfg[status] ?? { bg: '#9ca3af', label: status };
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: bg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 16 }}>
      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{label}</Text>
    </View>
  );
}
