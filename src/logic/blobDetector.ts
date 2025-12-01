/**
 * Inventory Item Detector (Dynamic)
 * 목표: 고정된 그리드(7x4)가 아닌, 화면에 존재하는 개별 아이템 슬롯들을 유연하게 감지.
 * 1x1, 2x2, 7x4 등 어떤 배열이든 상관없이 아이템이 있는 영역(Blob)을 각각 추출함.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BoundingBox = Rect;

// Morphological Dilation (팽창)
const dilate = (data: Uint8Array, width: number, height: number, kernelSize: number) => {
  const output = new Uint8Array(data.length);
  const offset = Math.floor(kernelSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x] === 1) {
        for (let ky = -offset; ky <= offset; ky++) {
          for (let kx = -offset; kx <= offset; kx++) {
            const ny = y + ky;
            const nx = x + kx;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              output[ny * width + nx] = 1;
            }
          }
        }
      }
    }
  }
  return output;
};

/**
 * 개별 아이템 영역 감지
 */
export const detectInventorySlots = (imageData: ImageData, _threshold = 50): Rect[] => {
  const { width, height } = imageData;
  const size = width * height;
  
  // 1. 이진화 (Thresholding)
  // 여러 임계값을 시도하는 대신, 중간값 하나를 사용하거나 적응형으로 가는 게 좋지만,
  // 여기서는 밝은 아이템을 잡기 위해 약간 높은 값을 기본으로 사용.
  const th = 45; 
  const binary = new Uint8Array(size);
  
  for (let i = 0; i < size; i++) {
    const r = imageData.data[i * 4];
    const g = imageData.data[i * 4 + 1];
    const b = imageData.data[i * 4 + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    binary[i] = gray > th ? 1 : 0;
  }

  // 2. Dilation (팽창) - 아주 작게 적용
  // 아이템 내부의 빈 공간은 메우되, 아이템끼리는 붙지 않도록 커널 크기를 2~3으로 설정.
  const dilated = dilate(binary, width, height, 3);

  // 3. CCL (Connected Component Labeling)
  const labels = new Int32Array(size).fill(0);
  let nextLabel = 1;
  const parent: number[] = [];
  const find = (x: number): number => {
    if (parent[x] === x) return x;
    return parent[x] = find(parent[x]);
  };
  const unite = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  // 1-Pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (dilated[idx] === 0) continue;
      
      const left = x > 0 ? labels[idx - 1] : 0;
      const top = y > 0 ? labels[idx - width] : 0;

      if (left === 0 && top === 0) {
        labels[idx] = nextLabel;
        parent[nextLabel] = nextLabel;
        nextLabel++;
      } else if (left !== 0 && top === 0) {
        labels[idx] = left;
      } else if (left === 0 && top !== 0) {
        labels[idx] = top;
      } else {
        labels[idx] = Math.min(left, top);
        unite(left, top);
      }
    }
  }

  // 2-Pass (Resolve Labels & Build Blobs)
  const blobs = new Map<number, Rect>();
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (labels[idx] === 0) continue;
      
      const root = find(labels[idx]);
      const blob = blobs.get(root);
      
      if (!blob) {
        blobs.set(root, { x: x, y: y, width: 1, height: 1 }); // width/height를 max값 추적용으로 잠시 사용
      } else {
        // x, y는 minX, minY
        // width, height는 maxX, maxY로 사용하여 업데이트
        blob.x = Math.min(blob.x, x);
        blob.width = Math.max(blob.width, x); // 임시로 maxX 저장
        blob.y = Math.min(blob.y, y);
        blob.height = Math.max(blob.height, y); // 임시로 maxY 저장
      }
    }
  }

  // 4. Blob 필터링 및 변환
  const validSlots: Rect[] = [];
  const minArea = size * 0.005; // 화면의 0.5% 이상 (너무 작은 노이즈 제거)
  const maxArea = size * 0.3;   // 화면의 30% 이하 (배경 전체 제거)

  blobs.forEach((b) => {
    // 임시 저장된 maxX, maxY를 실제 width, height로 변환
    const realX = b.x;
    const realY = b.y;
    const realW = b.width - b.x + 1;
    const realH = b.height - b.y + 1;

    const area = realW * realH;
    const aspect = realW / realH;

    // 조건 1: 크기
    if (area < minArea || area > maxArea) return;

    // 조건 2: 비율 (아이템은 대체로 정사각형 ~ 직사각형)
    // 1x1(1.0), 2x1(2.0), 1x2(0.5) 등을 모두 포용하기 위해 범위를 넓게 잡음.
    if (aspect < 0.4 || aspect > 3.0) return;

    // 조건 3: 화면 가장자리에 붙은 잘린 이미지는 제외 (선택적)
    const margin = 2;
    if (realX <= margin || realY <= margin || 
        realX + realW >= width - margin || realY + realH >= height - margin) {
      return;
    }

    validSlots.push({
      x: realX,
      y: realY,
      width: realW,
      height: realH
    });
  });

  // 5. 정렬 (상단 -> 하단, 좌 -> 우 순서)
  // y좌표가 비슷하면 x좌표로 정렬 (줄바꿈 고려)
  validSlots.sort((a, b) => {
    const yDiff = Math.abs(a.y - b.y);
    if (yDiff < height * 0.05) { // 같은 줄(Row)로 간주할 오차 범위
      return a.x - b.x;
    }
    return a.y - b.y;
  });

  return validSlots;
};

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
      resolve(detectInventorySlots(imageData, threshold));
    };
    img.src = URL.createObjectURL(file);
  });
};
