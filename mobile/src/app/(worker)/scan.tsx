import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { scanApi, taskLogsApi } from '@/lib/endpoints';
import { useTaskStore } from '@/store/taskStore';

const { width: W } = Dimensions.get('window');
const FRAME = 280;

export default function ScanScreen() {
  const { scanType } = useLocalSearchParams<{ scanType: 'start' | 'end' }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const lastScanned = useRef<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { activeCheckpoint, clearScan } = useTaskStore();

  if (!permission?.granted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <Text style={{ color: '#fff', marginBottom: 16, textAlign: 'center', paddingHorizontal: 32 }}>
          Camera permission is required to scan QR codes.
        </Text>
        <TouchableOpacity onPress={requestPermission} style={{ backgroundColor: '#2E7D32', borderRadius: 8, padding: 14 }}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  async function handleBarcode({ data }: { data: string }) {
    if (loading || scanned) return;
    if (lastScanned.current === data) return;
    lastScanned.current = data;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { lastScanned.current = null; }, 3000);

    const match = data.match(/\/scan\/checkpoint\/([a-f0-9-]{36})/i);
    if (!match) {
      Alert.alert('Invalid QR', 'This QR code is not a valid checkpoint marker.');
      return;
    }
    const checkpointId = match[1];
    setScanned(true);
    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await scanApi.checkpoint(checkpointId);

      if (scanType === 'start') {
        // Submit check-in task log so the stretch transitions to in_progress
        let lat: number | undefined;
        let lng: number | undefined;
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            lat = loc.coords.latitude;
            lng = loc.coords.longitude;
          }
        } catch {}

        try {
          await taskLogsApi.submit({ checkpoint_id: checkpointId, scan_type: 'check-in', lat, lng });
        } catch {}

        clearScan();
        router.back();
      } else {
        // End scan: go to photo upload screen
        router.replace({ pathname: '/(worker)/upload', params: { stretchId: activeCheckpoint?.stretch_id } });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Scan failed.';
      Alert.alert('Scan Error', msg);
      setScanned(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={handleBarcode}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Dark overlays */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 150, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      <View style={{ position: 'absolute', top: 120, bottom: 150, left: 0, width: (W - FRAME) / 2, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      <View style={{ position: 'absolute', top: 120, bottom: 150, right: 0, width: (W - FRAME) / 2, backgroundColor: 'rgba(0,0,0,0.6)' }} />

      {/* Scanning frame */}
      <View style={{
        position: 'absolute',
        top: 120,
        left: (W - FRAME) / 2,
        width: FRAME,
        height: FRAME,
        borderWidth: 3,
        borderColor: '#fff',
        borderRadius: 8,
      }} />

      {/* Label */}
      <View style={{ position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>
          {scanType === 'end' ? 'Scan End QR Code' : 'Scan Start QR Code'}
        </Text>
        {loading && (
          <Text style={{ color: '#4CAF50', fontSize: 14, marginTop: 8 }}>Processing…</Text>
        )}
      </View>

      {/* Cancel */}
      <View style={{ position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' }}>
        <TouchableOpacity
          onPress={() => { clearScan(); router.back(); }}
          style={{ backgroundColor: '#fff', borderRadius: 25, paddingHorizontal: 32, paddingVertical: 12 }}
        >
          <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
