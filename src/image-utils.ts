export async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject();
    image.onabort = () => reject();
    image.src = url;
  });
}

function computeRasterSize(image: HTMLImageElement): [number, number] {
  let w = Math.min(window.innerWidth, 600, image.width);
  let h = (image.height / image.width) * w;
  if (h > 800) {
    h = 800;
    w = (image.width / image.height) * h;
  }
  return [w, h];
}

function createContext(size: [number, number]) {
  const canvas = ('OffscreenCanvas' in window) ? new OffscreenCanvas(size[0], size[1]) : document.createElement('canvas');
  canvas.width = size[0];
  canvas.height = size[1];
  return canvas.getContext('2d')!;
}

export async function loadImageData(url: string): Promise<ImageData> {
  const image = await loadImage(url);
  const size = computeRasterSize(image);
  const ctx = createContext(size);
  ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, ...size);
  return ctx.getImageData(0, 0, ...size);
}