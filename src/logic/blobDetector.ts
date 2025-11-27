/**
 * Advanced Blob Detection Logic (Pixel-based with Morphological Operations)
 * Uses Dilation + Connected Component Analysis (CCL) to robustly detect UI slots.
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

/**
 * Performs morphological dilation (expansion) on a binary image.
 * Uses a sliding window approach (Separable Filter) for O(N) performance.
 * 
 * @param data Binary data (0 or 1)
 * @param width Image width
 * @param height Image height
 * @param radius Dilation radius (e.g., 3 pixels)
 */
function dilate(data: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const size = width * height;
  const temp = new Uint8Array(size);
  const result = new Uint8Array(size);

  // 1. Horizontal Pass
  for (let y = 0; y < height; y++) {
    let sum = 0;
    const rowOffset = y * width;

    // Initialize window for the first pixel [0, radius]
    // Note: window range is effectively [x - radius, x + radius]
    // but clipped to image bounds.
    for (let i = 0; i <= radius && i < width; i++) {
      if (data[rowOffset + i]) sum++;
    }

    for (let x = 0; x < width; x++) {
      // If any pixel in window is active, center is active
      if (sum > 0) temp[rowOffset + x] = 1;

      // Slide window right
      // Remove pixel leaving the window: (x - radius)
      const leavingIdx = x - radius;
      if (leavingIdx >= 0) {
        if (data[rowOffset + leavingIdx]) sum--;
      }
      
      // Add pixel entering the window: (x + radius + 1)
      const enteringIdx = x + radius + 1;
      if (enteringIdx < width) {
        if (data[rowOffset + enteringIdx]) sum++;
      }
    }
  }

  // 2. Vertical Pass (read from temp, write to result)
  for (let x = 0; x < width; x++) {
    let sum = 0;

    // Initialize window
    for (let i = 0; i <= radius && i < height; i++) {
      if (temp[i * width + x]) sum++;
    }

    for (let y = 0; y < height; y++) {
      if (sum > 0) result[y * width + x] = 1;

      // Slide window down
      const leavingIdx = y - radius;
      if (leavingIdx >= 0) {
        if (temp[leavingIdx * width + x]) sum--;
      }

      const enteringIdx = y + radius + 1;
      if (enteringIdx < height) {
        if (temp[enteringIdx * width + x]) sum++;
      }
    }
  }

  return result;
}

export function findItemBlobs(imageData: ImageData, threshold: number = 50): Rect[] {
  const { width, height, data } = imageData;
  const size = width * height;

  // 1. Preprocessing: Grayscale & Binarization
  const binary = new Uint8Array(size);
  
  for (let i = 0; i < size; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    binary[i] = gray > threshold ? 1 : 0;
  }

  // 2. Morphological Dilation
  // Radius 3 expands blobs by 3px in all directions, closing gaps up to ~6px.
  // This connects fragmented parts of the same item icon.
  const dilated = dilate(binary, width, height, 3);

  // 3. Connected Component Labeling (Two-Pass)
  const labels = new Int32Array(size).fill(0);
  let nextLabel = 1;
  const uf = new UnionFind(Math.ceil(size / 2) + 1);

  // Pass 1: Assign labels
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (dilated[idx] === 0) continue;

      // Check left and top neighbors
      const left = (x > 0) ? labels[idx - 1] : 0;
      const top = (y > 0) ? labels[idx - width] : 0;

      if (left === 0 && top === 0) {
        labels[idx] = nextLabel++;
      } else if (left !== 0 && top === 0) {
        labels[idx] = left;
      } else if (left === 0 && top !== 0) {
        labels[idx] = top;
      } else {
        // Both labeled
        labels[idx] = Math.min(left, top);
        if (left !== top) uf.union(left, top);
      }
    }
  }

  // Pass 2: Aggregate blobs
  const blobs = new Map<number, { minX: number, maxX: number, minY: number, maxY: number }>();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (labels[idx] === 0) continue;

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

  // 4. Initial Rect Extraction
  let rects: Rect[] = [];
  blobs.forEach(b => {
    rects.push({
      x: b.minX,
      y: b.minY,
      width: b.maxX - b.minX + 1,
      height: b.maxY - b.minY + 1
    });
  });

  // 5. Post-Processing: Filter Small Noise
  rects = rects.filter(r => r.width >= 20 && r.height >= 20);

  // 6. Post-Processing: Merge Overlapping/Nearby Rects
  // We iterate until no more merges happen.
  // "Nearby" defined as distance <= 5px.
  const MERGE_MARGIN = 5;
  let changed = true;
  
  while (changed) {
    changed = false;
    const merged: Rect[] = [];
    const used = new Uint8Array(rects.length).fill(0); // 0: unused, 1: used

    for (let i = 0; i < rects.length; i++) {
      if (used[i]) continue;
      
      let master = { ...rects[i] };
      used[i] = 1;

      // Try to merge with all subsequent rects
      for (let j = i + 1; j < rects.length; j++) {
        if (used[j]) continue;
        
        const candidate = rects[j];

        // Calculate distance between two rectangles
        // If they overlap, distance is 0.
        const dx = Math.max(0, master.x - (candidate.x + candidate.width), candidate.x - (master.x + master.width));
        const dy = Math.max(0, master.y - (candidate.y + candidate.height), candidate.y - (master.y + master.height));
        
        if (dx <= MERGE_MARGIN && dy <= MERGE_MARGIN) {
          // Merge them
          const minX = Math.min(master.x, candidate.x);
          const minY = Math.min(master.y, candidate.y);
          const maxX = Math.max(master.x + master.width, candidate.x + candidate.width);
          const maxY = Math.max(master.y + master.height, candidate.y + candidate.height);
          
          master = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
          };
          
          used[j] = 1;
          changed = true;
        }
      }
      merged.push(master);
    }
    rects = merged;
  }

  // 7. Post-Processing: Containment Filter
  // Remove rects strictly contained inside another rect (e.g. text inside icon)
  // Sort by area descending to keep largest containers
  rects.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  
  const finalRects: Rect[] = [];
  for (let i = 0; i < rects.length; i++) {
    const inner = rects[i];
    let isContained = false;
    
    for (let j = 0; j < finalRects.length; j++) {
      const outer = finalRects[j];
      // Check if inner is inside outer with small tolerance
      if (
        inner.x >= outer.x &&
        inner.y >= outer.y &&
        inner.x + inner.width <= outer.x + outer.width &&
        inner.y + inner.height <= outer.y + outer.height
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
