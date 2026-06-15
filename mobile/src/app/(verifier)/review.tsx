import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator,
  TextInput, Alert, Modal,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { taskLogsApi } from '@/lib/endpoints';
import { formatIST } from '@/utils/formatIST';
import type { TaskLog } from '@/types';

export default function VerifierReviewScreen() {
  const { logId } = useLocalSearchParams<{ logId: string }>();
  const navigation = useNavigation();
  const [log, setLog]           = useState<TaskLog | null>(null);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [remark, setRemark]     = useState('');
  const [showReject, setShowReject] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Review Submission' });
    loadLog();
  }, []);

  async function loadLog() {
    try {
      const res = await taskLogsApi.pending();
      setLog(res.data.find((l) => l.id === logId) ?? null);
    } catch {}
    setLoading(false);
  }

  async function handleApprove() {
    Alert.alert('Approve?', 'Confirm this submission looks correct.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Approve', onPress: async () => {
          setSubmitting(true);
          try {
            await taskLogsApi.verify(logId, 'approved');
            router.replace('/(verifier)/');
          } catch (err: unknown) {
            Alert.alert('Error', (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed');
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  }

  async function handleReject() {
    if (!remark.trim()) {
      Alert.alert('Remark Required', 'Please state why this is rejected.');
      return;
    }
    setSubmitting(true);
    try {
      await taskLogsApi.verify(logId, 'rejected', remark.trim());
      setShowReject(false);
      router.replace('/(verifier)/');
    } catch (err: unknown) {
      Alert.alert('Error', (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator color="#4A148C" size="large" />
    </View>
  );

  if (!log) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#666' }}>Submission not found.</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontWeight: 'bold', color: '#000', fontSize: 20, marginBottom: 4 }}>
          {log.stretch_name ?? '—'}
        </Text>
        <Text style={{ color: '#666', fontSize: 14, marginBottom: 12 }}>
          {log.worker_name} • {log.checkpoint_type} • {formatIST(log.scanned_at)}
        </Text>
        {log.duration && (
          <Text style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>
            Duration: {log.duration}
          </Text>
        )}

        {/* Before / After photos side-by-side */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <PhotoPanel label="BEFORE" uri={log.before_photo_url ?? null} />
          <PhotoPanel label="AFTER"  uri={log.after_photo_url  ?? null} />
        </View>

        {/* Action buttons */}
        <TouchableOpacity
          onPress={handleApprove}
          disabled={submitting}
          style={{ backgroundColor: '#2E7D32', height: 52, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Approve</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowReject(true)}
          disabled={submitting}
          style={{ backgroundColor: '#D32F2F', height: 52, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Reject</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Reject Modal */}
      <Modal visible={showReject} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
            <Text style={{ fontWeight: 'bold', color: '#000', fontSize: 18, marginBottom: 12 }}>Reject — Enter Reason</Text>
            <TextInput
              value={remark}
              onChangeText={setRemark}
              placeholder="Describe what needs to be fixed…"
              multiline
              numberOfLines={4}
              style={{
                borderWidth: 1, borderColor: '#ccc', borderRadius: 8,
                padding: 12, fontSize: 15, color: '#000',
                minHeight: 100, textAlignVertical: 'top',
              }}
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => { setShowReject(false); setRemark(''); }}
                style={{ flex: 1, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E0E0E0' }}
              >
                <Text style={{ fontWeight: 'bold', color: '#000' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleReject}
                disabled={submitting}
                style={{ flex: 1, height: 48, borderRadius: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#D32F2F' }}
              >
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={{ fontWeight: 'bold', color: '#fff' }}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PhotoPanel({ label, uri }: { label: string; uri: string | null }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: '#666', fontWeight: '600', fontSize: 12, marginBottom: 6 }}>{label}</Text>
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 10 }} resizeMode="cover" />
      ) : (
        <View style={{ width: '100%', aspectRatio: 3 / 4, backgroundColor: '#e0e0e0', borderRadius: 10, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#999', fontSize: 12 }}>No Photo</Text>
        </View>
      )}
    </View>
  );
}
