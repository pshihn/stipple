import { Voronoi } from './voronoi';

export interface BitmapData {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  pointCount: number;
}

export interface StippleInfo {
  points: Float32Array;
  width: number;
  height: number;
}

function grayValue(i: number, rgba: Uint8ClampedArray): number {
  const offset = i * 4;
  return 1 - (0.299 * rgba[offset] + 0.587 * rgba[offset + 1] + 0.114 * rgba[offset + 2]) / 254;
}

export function stipple({ buffer, width, height, pointCount: n }: BitmapData, iterations = 80): StippleInfo {
  const points = new Float32Array(n * 2);
  const rgba = new Uint8ClampedArray(buffer);
  const c = new Float64Array(n * 2);
  const s = new Float64Array(n);
  // Initialize the points using rejection sampling.
  for (let i = 0; i < n; ++i) {
    for (let j = 0; j < 60; ++j) {
      const x = points[i * 2] = Math.floor(Math.random() * width);
      const y = points[i * 2 + 1] = Math.floor(Math.random() * height);
      if (Math.random() < grayValue(y * width + x, rgba)) break;
    }
  }

  const voronoi = new Voronoi(points, [0, 0, width, height]);
  for (let k = 0; k < iterations; ++k) {
    // Compute the weighted centroid for each Voronoi cell.
    c.fill(0);
    s.fill(0);
    for (let y = 0, i = 0; y < height; ++y) {
      for (let x = 0; x < width; ++x) {
        const w = grayValue(y * width + x, rgba);
        i = voronoi.find(x + 0.5, y + 0.5, i);
        s[i] += w;
        c[i * 2] += w * (x + 0.5);
        c[i * 2 + 1] += w * (y + 0.5);
      }
    }

    // Relax the diagram by moving points to the weighted centroid.
    // Wiggle the points a little bit so they don’t get stuck.
    const w = Math.pow(k + 1, -0.8) * 10;
    for (let i = 0; i < n; ++i) {
      const x0 = points[i * 2], y0 = points[i * 2 + 1];
      const x1 = s[i] ? c[i * 2] / s[i] : x0, y1 = s[i] ? c[i * 2 + 1] / s[i] : y0;
      points[i * 2] = x0 + (x1 - x0) * 1.8 + (Math.random() - 0.5) * w;
      points[i * 2 + 1] = y0 + (y1 - y0) * 1.8 + (Math.random() - 0.5) * w;
    }
    voronoi.update();
  }
  return {
    points,
    width,
    height
  };
}