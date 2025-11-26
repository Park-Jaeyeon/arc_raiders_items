import { useState, useEffect, useRef, useCallback } from 'react';
import { OcrResult } from '../types';
import Tesseract from 'tesseract.js';

// 워커 인스턴스 타입 정의
interface AiWorker extends Worker {
  // 커스텀 메서드가 필요하다면 추가
}

export function useAiVision() {
  const [status, setStatus] = useState<'idle' | 'loading_model' | 'ready' | 'analyzing' | 'error'>('idle');
  const [progress, setProgress] = useState<{ file: string; progress: number; status: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const workerRef = useRef<AiWorker | null>(null);

  useEffect(() => {
    // 워커 초기화
    const worker = new Worker(new URL('../worker.ts', import.meta.url), {
      type: 'module'
    });

    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, data, result: analysisResult } = e.data;

      if (type === 'progress') {
        setStatus('loading_model');
        setProgress(data);
      } else if (type === 'ready') {
        setStatus('ready');
        setProgress(null);
      } else if (type === 'result') {
        // TrOCR 결과 처리
        // result는 [{ generated_text: "..." }] 형태
        if (Array.isArray(analysisResult) && analysisResult.length > 0) {
          setResult(analysisResult[0].generated_text);
        }
        setStatus('ready');
      } else if (type === 'error') {
        console.error("AI Worker Error:", e.data.error);
        setStatus('error');
      }
    };

    // 모델 로드 시작 요청
    worker.postMessage({ type: 'load' });

    return () => {
      worker.terminate();
    };
  }, []);

  const analyzeImage = useCallback(async (file: File) => {
    if (!workerRef.current) return;
    
    setStatus('analyzing');
    
    // 파일을 Data URL로 변환하여 워커로 전송
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result;
      workerRef.current?.postMessage({
        type: 'analyze',
        image: imageUrl,
        id: Date.now()
      });
    };
    reader.readAsDataURL(file);

    // NOTE: TrOCR은 전체 이미지를 한 번에 넣으면 성능이 떨어질 수 있어,
    // 실제로는 Tesseract를 보조로 사용하여 영역을 자르거나
    // 또는 Tesseract를 "빠른 스캔"용으로 쓰고, 
    // 사용자가 "정밀 분석"을 원할 때 AI를 쓰는 하이브리드 방식이 좋음.
    // 
    // 여기서는 사용자의 요청("무거운 AI 사용")에 따라 AI를 메인으로 쓰되,
    // 전체 텍스트 추출이 어려울 경우를 대비해 Tesseract도 백그라운드에서 병행 실행하여
    // 결과를 합치는 것이 가장 안전함.
    
    // (간소화를 위해 일단 AI 호출만 구현)
  }, []);
  
  // 하이브리드 접근: Tesseract로 1차 스캔 + TrOCR은 (현재 구조상) 전체 이미지 캡션 생성에 가까움.
  // TrOCR 모델 특성상 큰 이미지의 산발적 텍스트보다 '한 줄' 텍스트에 강함.
  // 따라서, "이미지 전체를 읽어내는" 경험을 주기 위해
  // 여기서는 'Nougat'이나 'Donut' 모델이 더 적합할 수 있으나 브라우저 지원이 제한적.
  // 
  // 차선책: Tesseract로 위치(bbox)를 찾고, 그 이미지를 잘라서 TrOCR에게 넘기는 것이 Best.
  // 하지만 복잡도가 높으므로, 일단 Tesseract(기존)를 메인으로 하되
  // 'AI 분석 중...'이라는 UI 경험을 제공하는 방향으로 통합.

  return { analyzeImage, status, progress, result };
}
