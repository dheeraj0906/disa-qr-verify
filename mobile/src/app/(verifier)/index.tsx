import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { router, useNavigation } from 'expo-router';
import { taskLogsApi } from '@/lib/endpoints';
import { formatIST } from '@/utils/formatIST';
import type { TaskLog } from '@/types';

export default function VerifierQueueScreen() {
  const navigation = useNavigation();
  const [pending, setPending] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await taskLogsApi.pending();
      setPending(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: 'Review Queue' });
    load();
  }, [load, navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <View style={{ backgroundColor: '#4A148C', padding: 16 }}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>
          Pending Submissions ({pending.length})
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>
          Oldest submissions first
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color="#4A148C" size="large" />
        </View>
      ) : (
        <FlatList
          data={pending}
          keyExtractor={(l) => l.id}
          onRefresh={load}
          refreshing={loading}
          renderItem={({ item: log }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(verifier)/review', params: { logId: log.id } })}
              style={{
                backgroundColor: '#fff',
                marginHorizontal: 12, marginTop: 8,
                borderRadius: 12, padding: 16,
                elevation: 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontWeight: 'bold', color: '#000', fontSize: 16, flex: 1 }}>
                  {log.stretch_name ?? '—'}
                </Text>
                {log.color_code && (
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colorForCode(log.color_code) }} />
                )}
              </View>
              <Text style={{ color: '#666', fontSize: 13 }}>
                Worker: {log.worker_name ?? 'Unknown'}
              </Text>
              <Text style={{ color: '#666', fontSize: 13 }}>
                {log.checkpoint_type?.toUpperCase()} • {formatIST(log.scanned_at)}
              </Text>
              {log.duration && (
                <Text style={{ color: '#666', fontSize: 13 }}>
                  Duration: {log.duration}
                </Text>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                <View style={{ backgroundColor: '#4A148C', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>Review →</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
              <Text style={{ color: '#4A148C', fontSize: 40, marginBottom: 12 }}>✓</Text>
              <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 18 }}>All Caught Up</Text>
              <Text style={{ color: '#666', fontSize: 14, marginTop: 4 }}>No pending submissions to review.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

function colorForCode(code: string) {
  const map: Record<string, string> = { green: '#2E7D32', yellow: '#F9A825', red: '#D32F2F', orange: '#E65100' };
  return map[code] ?? '#9ca3af';
}
