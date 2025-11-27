import { useState, useEffect, useCallback, useRef } from 'react';
import { ITEMS } from '../data/items';

interface AnalysisResult {
  label: string;
  score: number;
}

// Levenshtein Distance Helper
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, 
          Math.min(
            matrix[i][j - 1] + 1, 
            matrix[i - 1][j] + 1 
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// --- Worker Singleton ---
// 워커 인스턴스를 모듈 스코프에 두어 앱 생명주기 동안 유지합니다.
let globalWorker: Worker | null = null;
const workerPendingPromises = new Map<string, (result: any) => void>();

// 워커 초기화 함수 (최초 1회만 실행됨)
function getWorker(): Worker {
  if (!globalWorker) {
    globalWorker = new Worker(new URL('../worker.ts', import.meta.url), {
      type: 'module',
    });

    globalWorker.onmessage = (e) => {
      const { id, status, result, error } = e.data;
      const resolver = workerPendingPromises.get(id);
      
      if (resolver) {
        if (status === 'success') {
          resolver(result);
        } else {
          console.error(error);
          resolver(null);
        }
        workerPendingPromises.delete(id);
      }
    };
    
    console.log("[AiVision] Worker initialized (Singleton)");
  }
  return globalWorker;
}

export const useAiVision = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 컴포넌트 마운트 시 워커가 준비되었는지 확인하고 초기화
    const w = getWorker();
    // 워커는 비동기 로딩이 아니므로(스크립트 로딩 제외) 즉시 사용 가능 간주
    // 실제 모델 로딩은 워커 내부에서 첫 요청 시 이루어짐
    setIsReady(true);
    
    // Cleanup: 전역 워커이므로 컴포넌트 언마운트 시 terminate 하지 않음!
  }, []);

  const analyzeImage = useCallback(async (
    imageBlob: Blob, 
    hintText: string = ''
  ): Promise<AnalysisResult | null> => {
    const worker = getWorker(); // 항상 동일한 인스턴스 반환

    const id = Math.random().toString(36).substring(7);
    const imageUrl = URL.createObjectURL(imageBlob);

    let candidateLabels: string[] = [];
    
    if (hintText && hintText.length > 2) {
      const cleanHint = hintText.toLowerCase().trim();
      
      const scoredItems = ITEMS.map((item: any) => {
        const dist = levenshteinDistance(cleanHint, item.name.toLowerCase());
        return { name: item.name, dist };
      });

      scoredItems.sort((a: any, b: any) => a.dist - b.dist);

      if (scoredItems[0].dist <= 2) {
        candidateLabels = scoredItems.slice(0, 3).map((i: any) => i.name);
      } else {
        candidateLabels = scoredItems.slice(0, 10).map((i: any) => i.name);
      }
    }

    return new Promise((resolve) => {
      workerPendingPromises.set(id, resolve);
      worker.postMessage({ 
        id, 
        image: imageUrl,
        candidateLabels 
      });
    });
  }, []);

  return { analyzeImage, isReady };
};