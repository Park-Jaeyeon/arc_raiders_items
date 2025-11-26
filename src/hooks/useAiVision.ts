import { useState, useEffect, useRef, useCallback } from 'react';
import { ITEMS_DB } from '../data/items';
import { detectItemSlots } from '../logic/blobDetector';

interface AnalysisResult {
  imageUrl: string;
  topLabel: string;
  score: number;
}

export function useAiVision() {
  const [status, setStatus] = useState<'idle' | 'loading_model' | 'ready' | 'analyzing' | 'error'>('idle');
  const [progress, setProgress] = useState<{ file: string; progress: number; status: string } | null>(null);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const workerRef = useRef<Worker | null>(null);

  // CLIP에게 물어볼 후보군 (DB에 있는 모든 아이템 이름)
  const labels = Object.keys(ITEMS_DB);

  useEffect(() => {
    const worker = new Worker(new URL('../worker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, data, result, id } = e.data;

      if (type === 'progress') {
        setStatus('loading_model');
        setProgress(data);
      } else if (type === 'ready') {
        setStatus('ready');
        setProgress(null);
      } else if (type === 'result') {
        // result: [{ label: "Assorted Seeds", score: 0.95 }, ...]
        if (Array.isArray(result) && result.length > 0) {
          const topMatch = result[0]; // 가장 높은 점수
          
          setResults(prev => {
            // 해당 ID(이미지 인덱스 등)에 매핑해야 하지만 
            // 여기서는 단순 추가 방식으로 구현 (실제로는 id로 매핑 필요)
            // 간소화를 위해 마지막 결과 업데이트
            return [...prev, {
              imageUrl: "", // 워커에서 이미지를 다시 받진 않으므로 placeholder, 실제론 관리 필요
              topLabel: topMatch.label,
              score: topMatch.score
            }];
          });
        }
        setStatus('ready');
      } else if (type === 'error') {
        console.error("AI Worker Error:", e.data.error);
        setStatus('error');
      }
    };

    worker.postMessage({ type: 'load' });

    return () => {
      worker.terminate();
    };
  }, []);

  const analyzeImage = useCallback(async (file: File) => {
    if (!workerRef.current) return;
    
    setStatus('analyzing');
    setResults([]); // 초기화

    try {
      // 1. 이미지에서 아이템 슬롯(Blob)들을 잘라냅니다.
      const itemImages = await detectItemSlots(file);
      
      if (itemImages.length === 0) {
        console.warn("No items detected via blob detection.");
        setStatus('ready');
        return;
      }

      console.log(`Detected ${itemImages.length} item slots. analyzing...`);

      // 2. 각 조각 이미지를 워커(CLIP)에게 보냅니다.
      itemImages.forEach((imgUrl, idx) => {
        workerRef.current?.postMessage({
          type: 'analyze',
          image: imgUrl,
          labels: labels,
          id: idx
        });
      });

    } catch (err) {
      console.error("Vision Analysis Failed:", err);
      setStatus('error');
    }
  }, [labels]);

  return { analyzeImage, status, progress, results };
}
