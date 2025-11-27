/**
 * Advanced Blob Detection Logic (Pixel-based)
 * Uses Connected Component Analysis (CCL) to detect UI slots.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BoundingBox = Rect;

/**
 * Efficient Union-Find structure for Connected Component Labeling
 */
class UnionFind {
  parent: Int32Array;

  constructor(size: number) {
    this.parent = new Int32Array(size);
    for (let i = 0; i < size; i++) {
      this.parent[i] = i;
    }
  }

  find(i: number): number {
    let root = i;
    while (root !== this.parent[root]) {
      root = this.parent[root];
    }
    
    // Path compression
    let curr = i;
    while (curr !== root) {
      let next = this.parent[curr];
      this.parent[curr] = root;
      curr = next;
    }
    return root;
  }

  union(i: number, j: number) {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) {
      this.parent[rootI] = rootJ;
    }
  }
}

export function findItemBlobs(imageData: ImageData, threshold: number = 50): Rect[] {
  const { width, height, data } = imageData;
  const size = width * height;

  // 1. Preprocessing: Grayscale & Binarization
  // We use a Uint8Array to store the binary mask (0 or 1)
  const binary = new Uint8Array(size);
  
  for (let i = 0; i < size; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    
    // Standard Luminance conversion
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Thresholding:
    // ARC Raiders UI slots are typically brighter borders/backgrounds against dark.
    // OR dark slots against lighter backdrop. 
    // The 'threshold' param from UI slider (0-255) determines the cutoff.
    binary[i] = gray > threshold ? 1 : 0;
  }

  // 2. Connected Component Labeling (Two-Pass Algorithm)
  const labels = new Int32Array(size).fill(0);
  let nextLabel = 1;
  
  // We need a UnionFind structure large enough to handle potential max labels.
  // In worst case (checkerboard), max labels = pixels / 2.
  const uf = new UnionFind(Math.ceil(size / 2) + 1);

  // First Pass: Assign temporary labels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binary[idx] === 0) continue;

      // Check neighbors (4-connectivity is usually enough for boxes)
      // Left
      const leftLabel = (x > 0) ? labels[idx - 1] : 0;
      // Top
      const topLabel = (y > 0) ? labels[idx - width] : 0;

      if (leftLabel === 0 && topLabel === 0) {
        labels[idx] = nextLabel++;
      } else if (leftLabel !== 0 && topLabel === 0) {
        labels[idx] = leftLabel;
      } else if (leftLabel === 0 && topLabel !== 0) {
        labels[idx] = topLabel;
      } else {
        // Both neighbors are labeled
        labels[idx] = Math.min(leftLabel, topLabel);
        if (leftLabel !== topLabel) {
          uf.union(leftLabel, topLabel);
        }
      }
    }
  }

  // Second Pass & Blob Aggregation
  // Map: Label Root -> Bounding Box { minX, minY, maxX, maxY }
  const blobs = new Map<number, { minX: number, maxX: number, minY: number, maxY: number }>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (labels[idx] === 0) continue;

      // Find canonical root label
      const root = uf.find(labels[idx]);
      
      const blob = blobs.get(root);
      if (!blob) {
        blobs.set(root, { minX: x, maxX: x, minY: y, maxY: y });
      } else {
        if (x < blob.minX) blob.minX = x;
        if (x > blob.maxX) blob.maxX = x;
        if (y < blob.minY) blob.minY = y;
        if (y > blob.maxY) blob.maxY = y;
      }
    }
  }

  // 3. Convert to Rects and Basic Filtering
  let rects: Rect[] = [];
  
  blobs.forEach((b) => {
    const w = b.maxX - b.minX + 1;
    const h = b.maxY - b.minY + 1;

    // [Filter 1] Size: Ignore noise smaller than 30x30
    if (w < 30 || h < 30) return;

    // [Filter 2] Aspect Ratio: Ignore extreme shapes (lines)
    // Valid slots are usually roughly square or 1:2 / 2:1
    const ratio = w / h;
    if (ratio < 0.5 || ratio > 2.5) return;

    rects.push({
      x: b.minX,
      y: b.minY,
      width: w,
      height: h
    });
  });

  // 4. Advanced Filtering: Containment Check
  // Remove boxes that are inside other boxes (e.g. icon detail inside the slot border)
  // Sort by area descending (largest first) to safely remove smaller inner ones
  rects.sort((a, b) => (b.width * b.height) - (a.width * a.height));

  const finalRects: Rect[] = [];
  
  for (let i = 0; i < rects.length; i++) {
    const inner = rects[i];
    let isContained = false;

    for (let j = 0; j < finalRects.length; j++) {
      const outer = finalRects[j];
      
      // Check if 'inner' is strictly inside 'outer'
      // Allow small margin of error (e.g. 2px)
      if (
        inner.x >= outer.x - 2 &&
        inner.y >= outer.y - 2 &&
        inner.x + inner.width <= outer.x + outer.width + 2 &&
        inner.y + inner.height <= outer.y + outer.height + 2
      ) {
        isContained = true;
        break;
      }
    }

    if (!isContained) {
      finalRects.push(inner);
    }
  }

  return finalRects;
}

export const getItemSlots = async (file: File, threshold: number): Promise<BoundingBox[]> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      resolve(findItemBlobs(imageData, threshold));
    };
    img.src = URL.createObjectURL(file);
  });
};
