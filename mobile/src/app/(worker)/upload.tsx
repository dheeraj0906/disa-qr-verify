import { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView,
  ActivityIndicator, Alert, Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImageManipulator from 'expo-image-manipulator';
import NetInfo from '@react-native-community/netinfo';
import { taskLogsApi } from '@/lib/endpoints';
import { useTaskStore } from '@/store/taskStore';
import { uploadPhotoToCloudinary } from '@/utils/cloudinary';

type PhotoSlot = 'before' | 'after';

export default function UploadProofScreen() {
  const { stretchId }  = useLocalSearchParams<{ stretchId: string }>();
  const { activeCheckpoint, clearScan } = useTaskStore();

  const [beforeUri, setBeforeUri] = useState<string | null>(null);
  const [afterUri, setAfterUri]   = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<PhotoSlot>('before');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [facing, setFacing]         = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading]       = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  async function openCamera(slot: PhotoSlot) {
    if (!permission?.granted) {
      await requestPermission();
      return;
    }
    setActiveSlot(slot);
    setCameraOpen(true);
  }

  async function capturePhoto() {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo) {
        const compressed = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 1200 } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
        );
        if (activeSlot === 'before') setBeforeUri(compressed.uri);
        else setAfterUri(compressed.uri);
        setCameraOpen(false);
      }
    } catch {
      Alert.alert('Error', 'Failed to capture photo.');
    }
  }

  async function handleSubmit() {
    if (!afterUri) {
      Alert.alert('After Photo Required', 'Please take an "After" photo showing the completed work.');
      return;
    }

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      Alert.alert('No Connection', 'Please check your internet and try again.');
      return;
    }

    if (!activeCheckpoint) {
      Alert.alert('Error', 'No active checkpoint. Please go back and scan again.');
      return;
    }

    setLoading(true);
    try {
      // GPS
      let lat: number | undefined;
      let lng: number | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      } catch {}

      // Upload photos to Cloudinary
      const [beforeUrl, afterUrl] = await Promise.all([
        beforeUri ? uploadPhotoToCloudinary(beforeUri) : Promise.resolve(undefined),
        uploadPhotoToCloudinary(afterUri),
      ]);

      await taskLogsApi.submit({
        checkpoint_id: activeCheckpoint.id,
        scan_type: 'completion',
        lat, lng,
        before_photo_url: beforeUrl ?? null,
        after_photo_url: afterUrl,
      });

      setShowSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Submission failed.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontWeight: 'bold', color: '#000', fontSize: 20, marginBottom: 4 }}>
          Submit Completion Proof
        </Text>
        <Text style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>
          Take before &amp; after photos to document your work.
        </Text>

        {/* Photo slots */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          <PhotoSlotCard
            label="BEFORE"
            uri={beforeUri}
            required={false}
            onPress={() => openCamera('before')}
          />
          <PhotoSlotCard
            label="AFTER"
            uri={afterUri}
            required
            onPress={() => openCamera('after')}
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading || !afterUri}
          style={{
            backgroundColor: !afterUri ? '#9ca3af' : loading ? '#4a9e4f' : '#2E7D32',
            height: 54, borderRadius: 10,
            justifyContent: 'center', alignItems: 'center',
          }}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Submit Work</Text>
          }
        </TouchableOpacity>

        {!afterUri && (
          <Text style={{ color: '#666', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
            After photo is required to submit
          </Text>
        )}
      </ScrollView>

      {/* Camera Modal */}
      <Modal visible={cameraOpen} animationType="slide" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing={facing} />
          <Text style={{ color: '#fff', textAlign: 'center', fontSize: 13, letterSpacing: 2, paddingVertical: 8, backgroundColor: '#000' }}>
            {activeSlot === 'before' ? 'BEFORE PHOTO' : 'AFTER PHOTO'}
          </Text>
          <View style={{
            backgroundColor: '#000', height: 120,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
          }}>
            <TouchableOpacity onPress={() => setCameraOpen(false)}>
              <Ionicons name="close" size={30} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={capturePhoto}
              style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: '#fff', borderWidth: 3, borderColor: '#fff' }}
            />
            <TouchableOpacity onPress={() => setFacing((f) => f === 'back' ? 'front' : 'back')}>
              <Ionicons name="camera-reverse-outline" size={30} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Loading overlay */}
      {loading && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center', alignItems: 'center',
        }}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: '#fff', marginTop: 16, fontWeight: 'bold' }}>Uploading…</Text>
        </View>
      )}

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 28, marginHorizontal: 40, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Ionicons name="checkmark-circle" size={44} color="#2E7D32" />
            </View>
            <Text style={{ fontWeight: 'bold', color: '#000', fontSize: 20, marginBottom: 8 }}>Submitted!</Text>
            <Text style={{ color: '#666', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>
              Your task has been submitted for supervisor review.
            </Text>
            <TouchableOpacity
              onPress={() => { setShowSuccess(false); clearScan(); router.replace('/(worker)/'); }}
              style={{ backgroundColor: '#2E7D32', borderRadius: 8, height: 44, paddingHorizontal: 32, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ fontWeight: 'bold', color: '#fff', fontSize: 16 }}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PhotoSlotCard({ label, uri, required, onPress }: {
  label: string; uri: string | null; required: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flex: 1, borderRadius: 12, overflow: 'hidden', aspectRatio: 3 / 4 }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      ) : (
        <View style={{
          flex: 1, backgroundColor: '#e0e0e0',
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Ionicons name="camera-outline" size={32} color="#999" />
          <Text style={{ color: '#999', fontSize: 13, marginTop: 4 }}>Tap to take</Text>
        </View>
      )}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 6, alignItems: 'center',
        flexDirection: 'row', justifyContent: 'center', gap: 4,
      }}>
        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{label}</Text>
        {required && <Text style={{ color: '#FF7043', fontSize: 13 }}>*</Text>}
      </View>
    </TouchableOpacity>
  );
}
