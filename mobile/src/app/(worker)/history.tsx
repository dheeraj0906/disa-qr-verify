import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { taskLogsApi } from '@/lib/endpoints';
import { formatIST } from '@/utils/formatIST';
import type { TaskLog } from '@/types';

const SCAN_LABEL: Record<string, string> = {
  'check-in':   'Check-In',
  'progress':   'Progress',
  'completion': 'Completion',
};

export default function WorkerHistoryScreen() {
  const navigation = useNavigation();
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await taskLogsApi.my();
      setLogs(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    navigation.setOptions({ title: 'My History' });
    load();
  }, [load, navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <View style={{ backgroundColor: '#1565C0', padding: 16 }}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>
          My Task History
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>
          {logs.length} submissions
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color="#1565C0" size="large" />
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
              borderLeftColor: statusColor(log.verification_status),
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ fontWeight: 'bold', color: '#000', fontSize: 15, flex: 1 }}>
                  {log.stretch_name ?? '—'}
                </Text>
                <VerifBadge status={log.verification_status} />
              </View>
              <Text style={{ color: '#555', fontSize: 13 }}>
                {SCAN_LABEL[log.scan_type] ?? log.scan_type} • {log.checkpoint_type ?? '—'}
              </Text>
              <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                {formatIST(log.scanned_at)}
              </Text>
              {log.duration && (
                <Text style={{ color: '#888', fontSize: 12 }}>Duration: {log.duration}</Text>
              )}
              {log.remark && (
                <View style={{ backgroundColor: '#FFF3E0', borderRadius: 6, padding: 8, marginTop: 8 }}>
                  <Text style={{ color: '#E65100', fontSize: 13 }}>
                    Remark: {log.remark}
                  </Text>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
              <Ionicons name="document-text-outline" size={48} color="#ccc" />
              <Text style={{ color: '#888', fontSize: 16, marginTop: 12 }}>No submissions yet.</Text>
              <Text style={{ color: '#bbb', fontSize: 13, marginTop: 4 }}>
                Your task logs will appear here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending:  '#F57C00',
    approved: '#2E7D32',
    rejected: '#D32F2F',
    'n/a':    '#9ca3af',
  };
  return map[status] ?? '#9ca3af';
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
    <View style={{ backgroundColor: bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 11 }}>{label}</Text>
    </View>
  );
}
