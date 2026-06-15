import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { taskLogsApi } from '@/lib/endpoints';
import { formatIST } from '@/utils/formatIST';
import type { TaskLog } from '@/types';

export default function VerifierHistoryScreen() {
  const navigation = useNavigation();
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await taskLogsApi.verifiedBy();
      setLogs(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: 'Review History' });
    load();
  }, [load, navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <View style={{ backgroundColor: '#4A148C', padding: 16 }}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>
          My Review History
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>
          {logs.length} reviews completed
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color="#4A148C" size="large" />
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(l) => l.id}
          onRefresh={load}
          refreshing={loading}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item: log }) => (
            <View style={{
              backgroundColor: '#fff',
              marginHorizontal: 12, marginTop: 8,
              borderRadius: 12, padding: 16,
              elevation: 1,
              borderLeftWidth: 4,
              borderLeftColor: log.verification_status === 'approved' ? '#2E7D32' : '#D32F2F',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontWeight: 'bold', color: '#000', fontSize: 15, flex: 1 }}>
                  {log.stretch_name ?? '—'}
                </Text>
                <DecisionBadge status={log.verification_status} />
              </View>
              <Text style={{ color: '#555', fontSize: 13 }}>
                Worker: {log.worker_name ?? 'Unknown'}
              </Text>
              <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                Reviewed: {log.verified_at ? formatIST(log.verified_at) : '—'}
              </Text>
              {log.remark && (
                <View style={{ backgroundColor: '#FFF3E0', borderRadius: 6, padding: 8, marginTop: 8 }}>
                  <Text style={{ color: '#666', fontSize: 13 }}>
                    "{log.remark}"
                  </Text>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
              <Ionicons name="checkmark-done-outline" size={48} color="#ccc" />
              <Text style={{ color: '#888', fontSize: 16, marginTop: 12 }}>No reviews yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function DecisionBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; label: string }> = {
    approved: { bg: '#2E7D32', label: 'APPROVED' },
    rejected: { bg: '#D32F2F', label: 'REJECTED' },
  };
  const { bg, label } = cfg[status] ?? { bg: '#9ca3af', label: status.toUpperCase() };
  return (
    <View style={{ backgroundColor: bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>{label}</Text>
    </View>
  );
}
