/**
 * Dynamic Blob Detection Logic
 * Replaces rigid grid with computer vision based object detection
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BoundingBox = Rect;

// Union-Find data structure for efficient component labeling
class UnionFind {
  parent: number[];
  constructor(size: number) {
    this.parent = Array(size).fill(0).map((_, i) => i);
  }
  find(i: number): number {
    if (this.parent[i] === i) return i;
    this.parent[i] = this.find(this.parent[i]);
    return this.parent[i];
  }
  union(i: number, j: number) {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) this.parent[rootI] = rootJ;
  }
}

export function findItemBlobs(imageData: ImageData, threshold: number = 50): Rect[] {
  const { width, height, data } = imageData;
  const TILE_SIZE = 10;
  const COLS = Math.ceil(width / TILE_SIZE);
  const ROWS = Math.ceil(height / TILE_SIZE);
  
  // 1. Tile Analysis: Mark tiles that have enough activity (edges/variance)
  const activeTiles = new Uint8Array(COLS * ROWS);
  
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      let minVal = 255, maxVal = 0;
      
      // Check pixels within this tile
      const startX = x * TILE_SIZE;
      const startY = y * TILE_SIZE;
      const endX = Math.min(startX + TILE_SIZE, width);
      const endY = Math.min(startY + TILE_SIZE, height);
      
      for (let py = startY; py < endY; py += 2) { // Skip every other pixel for speed
        for (let px = startX; px < endX; px += 2) {
          const idx = (py * width + px) * 4;
          // Convert to approx grayscale brightness
          const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          if (brightness < minVal) minVal = brightness;
          if (brightness > maxVal) maxVal = brightness;
        }
      }
      
      // If contrast in this tile > threshold, mark as active
      if ((maxVal - minVal) > (255 - threshold)) { // Invert logic: Higher threshold from UI = More sensitive? 
        // Actually let's stick to: input threshold is "sensitivity".
        // If input is 100 (high), we want to detect MORE. 
        // So we check if (max - min) > (CONST / threshold)? 
        // Let's assume the UI passes 0-255.
        // If UI threshold is 50, we ignore contrast < 50.
        // Wait, usually threshold means "cutoff". 
        // If I set threshold 200, I expect ONLY very strong edges.
        // If I set threshold 10, I expect almost everything.
        if ((maxVal - minVal) > threshold) {
           activeTiles[y * COLS + x] = 1;
        }
      }
    }
  }

  // 2. Connected Components (Union-Find)
  const uf = new UnionFind(COLS * ROWS);
  
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const idx = y * COLS + x;
      if (activeTiles[idx] === 0) continue;

      // Check right neighbor
      if (x + 1 < COLS && activeTiles[idx + 1] === 1) {
        uf.union(idx, idx + 1);
      }
      // Check bottom neighbor
      if (y + 1 < ROWS && activeTiles[idx + COLS] === 1) {
        uf.union(idx, idx + COLS);
      }
    }
  }

  // 3. Group into bounding boxes
  const groups = new Map<number, { minX: number, minY: number, maxX: number, maxY: number }>();
  
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const idx = y * COLS + x;
      if (activeTiles[idx] === 0) continue;
      
      const root = uf.find(idx);
      
      if (!groups.has(root)) {
        groups.set(root, { minX: x, minY: y, maxX: x, maxY: y });
      } else {
        const g = groups.get(root)!;
        if (x < g.minX) g.minX = x;
        if (x > g.maxX) g.maxX = x;
        if (y < g.minY) g.minY = y;
        if (y > g.maxY) g.maxY = y;
      }
    }
  }

  // 4. Convert back to pixel coordinates and filter
  const detectedRects: Rect[] = [];
  
  groups.forEach(g => {
    // Add padding
    const x = g.minX * TILE_SIZE;
    const y = g.minY * TILE_SIZE;
    const w = (g.maxX - g.minX + 1) * TILE_SIZE;
    const h = (g.maxY - g.minY + 1) * TILE_SIZE;
    
    // Filter noise: must be at least 30x30 pixels
    if (w >= 30 && h >= 30) {
       detectedRects.push({ x, y, width: w, height: h });
    }
  });

  return detectedRects;
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
      
      // UI threshold is usually 0-255. Let's map it directly.
      // If default is 100, it filters out low contrast noise.
      resolve(findItemBlobs(imageData, threshold));
    };
    img.src = URL.createObjectURL(file);
  });
};
