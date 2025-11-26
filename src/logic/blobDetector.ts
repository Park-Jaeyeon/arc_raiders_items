/**
 * 이미지에서 아이템 슬롯(밝은 영역)을 찾아내어 좌표(Bounding Box)를 반환합니다.
 * OpenCV 없이 픽셀 순회로 간단한 Blob Detection을 수행합니다.
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function detectItemSlots(file: File, threshold: number = 100): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error("No context")); return; }

      // 성능을 위해 리사이징해서 분석
      const scale = 0.5;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;

      // 1. 이진화 (Binarization) & 방문 배열 초기화
      const visited = new Uint8Array(width * height); // 0: unvisited, 1: visited
      const blobs: BoundingBox[] = [];

      const getIdx = (x: number, y: number) => (y * width + x);

      // 2. Connected Components Labeling (단순화된 버전)
      for (let y = 0; y < height; y += 4) { // 스킵하면서 스캔
        for (let x = 0; x < width; x += 4) {
          const idx = getIdx(x, y);
          if (visited[idx]) continue;

          // 밝기 확인
          const r = data[idx * 4];
          const g = data[idx * 4 + 1];
          const b = data[idx * 4 + 2];
          const brightness = (r + g + b) / 3;

          if (brightness > threshold) {
            // 새로운 Blob 발견! Flood Fill 시작
            const stack = [[x, y]];
            let minX = x, maxX = x, minY = y, maxY = y;
            let pixelCount = 0;

            while (stack.length > 0) {
              const [cx, cy] = stack.pop()!;
              const cIdx = getIdx(cx, cy);
              
              if (visited[cIdx]) continue;
              visited[cIdx] = 1;
              pixelCount++;

              minX = Math.min(minX, cx);
              maxX = Math.max(maxX, cx);
              minY = Math.min(minY, cy);
              maxY = Math.max(maxY, cy);

              // 4방향 탐색
              const neighbors = [[cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]];
              for (const [nx, ny] of neighbors) {
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  const nIdx = getIdx(nx, ny);
                  if (!visited[nIdx]) {
                    const nr = data[nIdx * 4];
                    const ng = data[nIdx * 4 + 1];
                    const nb = data[nIdx * 4 + 2];
                    const nbright = (nr + ng + nb) / 3;
                    // 비슷한 밝기면 같은 덩어리로 간주
                    if (nbright > threshold * 0.8) {
                      stack.push([nx, ny]);
                    }
                  }
                }
              }
            }

            // Blob 유효성 검사 (너무 작거나 너무 큰 것은 제외)
            const w = maxX - minX;
            const h = maxY - minY;
            if (w > 20 && h > 20 && w < width / 2 && h < height / 2) {
              // 원본 스케일로 복구
              blobs.push({
                x: minX / scale,
                y: minY / scale,
                width: w / scale,
                height: h / scale
              });
            }
          }
        }
      }

      // 3. 각 Blob 영역을 잘라낸(Crop) 이미지 URL 배열 생성
      // 원본 이미지를 다시 그릴 캔버스
      const cropCanvas = document.createElement('canvas');
      const cropCtx = cropCanvas.getContext('2d');
      
      if (!cropCtx) { resolve([]); return; }

      const itemImages: string[] = [];
      
      // 너무 많은 Blob은 성능 저하 -> 상위 10개만 테스트 (또는 적절히 필터링)
      // 여기서는 겹치는 박스 제거(NMS) 등은 생략하고 단순 반환
      const validBlobs = blobs.slice(0, 12); // 최대 12개 슬롯만 분석 (데모용)

      validBlobs.forEach(blob => {
        cropCanvas.width = blob.width;
        cropCanvas.height = blob.height;
        
        // 원본 이미지에서 해당 영역만 그리기
        cropCtx.drawImage(
          img, 
          blob.x, blob.y, blob.width, blob.height, 
          0, 0, blob.width, blob.height
        );
        itemImages.push(cropCanvas.toDataURL('image/jpeg'));
      });

      resolve(itemImages);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
