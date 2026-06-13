const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const cloudinaryConfigured =
  !!CLOUD_NAME && CLOUD_NAME !== 'placeholder' && !!UPLOAD_PRESET;

export async function uploadToCloudinary(file: File): Promise<string> {
  if (!cloudinaryConfigured) {
    // Return a data URL stub so the app flow completes without real Cloudinary
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: form }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? 'Cloudinary upload failed');
  }

  const data = await res.json() as { secure_url: string };
  return data.secure_url;
}
