// Burns lat/lng + timestamp overlay onto an image file using canvas
// Returns a new File with the same MIME type

export async function burnGeoStamp(
  file: File,
  lat: number,
  lng: number,
  timestamp: Date
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const label = [
        `Lat: ${lat.toFixed(6)}`,
        `Lng: ${lng.toFixed(6)}`,
        timestamp.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      ].join('  |  ');

      const fontSize = Math.max(14, Math.floor(canvas.height / 40));
      ctx.font = `bold ${fontSize}px monospace`;
      const padding = 8;
      const textWidth = ctx.measureText(label).width;
      const boxH = fontSize + padding * 2;
      const boxW = textWidth + padding * 2;
      const x = canvas.width - boxW - 10;
      const y = canvas.height - boxH - 10;

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y, boxW, boxH);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x + padding, y + padding + fontSize - 2);

      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
          resolve(new File([blob], file.name, { type: file.type }));
        },
        file.type
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}
