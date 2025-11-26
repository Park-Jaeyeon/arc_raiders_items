import { pipeline, env } from '@xenova/transformers';

// 로컬 모델 로딩을 위한 설정 (필요시)
env.allowLocalModels = false;
env.useBrowserCache = true;

// 싱글톤 패턴으로 파이프라인 관리
class AI {
  static instance: any = null;

  static async getInstance(progressCallback: (data: any) => void) {
    if (this.instance === null) {
      // 이미지-투-텍스트 모델 로드
      // 'Xenova/trocr-small-printed'는 손글씨/인쇄체 인식에 강력함
      // 'Xenova/donut-base-finetuned-cord-v2'는 문서 구조 인식에 강력함
      // 여기서는 텍스트 인식 성능이 좋은 trocr-small-printed 선택
      this.instance = await pipeline('image-to-text', 'Xenova/trocr-small-printed', {
        progress_callback: progressCallback
      });
    }
    return this.instance;
  }
}

// 메시지 핸들러
self.addEventListener('message', async (event) => {
  const { type, image, id } = event.data;

  if (type === 'load') {
    try {
      await AI.getInstance((data: any) => {
        self.postMessage({
          type: 'progress',
          data: data
        });
      });
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', error: err });
    }
  } else if (type === 'analyze') {
    try {
      const classifier = await AI.getInstance(() => {});
      
      // 이미지 분석 실행
      // TrOCR은 전체 페이지보다 텍스트 라인 단위 인식에 강함.
      // 하지만 Transformers.js 파이프라인이 어느 정도 처리를 해줌.
      const output = await classifier(image);
      
      self.postMessage({
        type: 'result',
        id: id,
        result: output
      });
    } catch (err) {
      self.postMessage({
        type: 'error',
        id: id,
        error: err
      });
    }
  }
});
