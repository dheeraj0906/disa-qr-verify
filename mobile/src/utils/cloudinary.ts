const CLOUD_NAME     = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET  = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export async function uploadPhotoToCloudinary(uri: string): Promise<string> {
  if (!CLOUD_NAME || CLOUD_NAME === 'placeholder' || !UPLOAD_PRESET) {
    return uri;
  }

  const formData = new FormData();
  formData.append('file', { uri, type: 'image/jpeg', name: 'photo.jpg' } as unknown as Blob);
  formData.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData },
  );

  if (!res.ok) return uri;

  const data = (await res.json()) as { secure_url?: string };
  return data.secure_url ?? uri;
}
