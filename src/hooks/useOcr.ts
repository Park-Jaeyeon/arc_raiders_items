import { useState, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import { OcrResult } from '../types';

interface PreprocessOptions {
  threshold: number; // 0~255, 이 값보다 밝은 픽셀만 남김
  invert: boolean;   // 색상 반전 여부
}

function preprocessImage(file: File, options: PreprocessOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const { threshold, invert } = options;

      // 픽셀 조작: "특정 밝기 이상만 남기기 (High-pass filter)"
      // 아이콘 그림(중간 밝기)을 제거하고, 흰색 글씨(가장 밝음)만 남기는 전략
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // 1. 밝기(Luminance) 계산
        const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        
        // 2. Thresholding (이진화)
        // threshold보다 밝으면 흰색(255), 아니면 검은색(0)
        let val = gray >= threshold ? 255 : 0;

        if (invert) {
          val = 255 - val;
        }

        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        // Alpha는 그대로 (255)
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg'));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function useOcr() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const processImage = useCallback(async (file: File, options: PreprocessOptions = { threshold: 180, invert: false }): Promise<OcrResult | null> => {
    setLoading(true);
    setError(null);
    setProgress(0);

    try {
      // 1. 전처리 수행
      const preprocessedImageUrl = await preprocessImage(file, options);

      // 2. OCR 수행
      const recognitionOptions = {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            setProgress(m.progress);
          }
        },
        // 설정 튜닝 (공식 타입에는 없어서 캐스팅)
        tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:xX()[]/-. ',
      } as const;

      const result = await Tesseract.recognize(
        preprocessedImageUrl,
        'eng',
        recognitionOptions as unknown as Tesseract.WorkerOptions
      );

      // Page Segmentation Mode 설정 (11: Sparse text = 띄엄띄엄 있는 텍스트)
      // Tesseract.js에서는 recognize의 3번째 인자나, setParameters로 해야 함.
      // 여기서는 간단히 recognize로 처리.
      
      return {
        rawText: result.data.text,
        lines: result.data.lines.map(l => l.text)
      };

    } catch (err) {
      console.error("OCR Error:", err);
      setError("이미지 처리에 실패했습니다.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // 전처리된 이미지 미리보기를 얻기 위한 헬퍼 함수
  const getPreview = useCallback((file: File, options: PreprocessOptions): Promise<string> => {
    return preprocessImage(file, options);
  }, []);

  return { processImage, getPreview, loading, error, progress };
}
