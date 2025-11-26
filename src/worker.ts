import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

class AI {
  static instance: any = null;

  static async getInstance(progressCallback: (data: any) => void) {
    if (this.instance === null) {
      // CLIP 모델: 이미지와 텍스트 사이의 연관성을 이해함
      // 'Xenova/clip-vit-base-patch32'는 브라우저에서 돌리기에 적당한 크기와 성능
      this.instance = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32', {
        progress_callback: progressCallback
      });
    }
    return this.instance;
  }
}

self.addEventListener('message', async (event) => {
  const { type, image, labels, id } = event.data;

  if (type === 'load') {
    try {
      await AI.getInstance((data: any) => {
        self.postMessage({ type: 'progress', data });
      });
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', error: err });
    }
  } else if (type === 'analyze') {
    try {
      const classifier = await AI.getInstance(() => {});
      
      // 프롬프트 엔지니어링: 단순 단어보다 문맥을 주면 더 잘 알아들음
      // 예: "Standard Ammo" -> "an icon of Standard Ammo"
      const enhancedLabels = labels.map((l: string) => `an icon of ${l} in a video game inventory`);

      // CLIP 분석 실행
      const output = await classifier(image, enhancedLabels);
      
      // output은 [{ label: "...", score: ... }, ...] 형태로 옴 (내림차순 정렬됨)
      // 상위 3개만 추려서 반환
      // 주의: enhancedLabels를 썼으므로 결과 label도 문장 형태일 수 있음. 다시 원래 단어로 매핑 필요.
      // Transformers.js의 zero-shot-image-classification은 입력 label 그대로 돌려줌.
      
      const top3 = output.slice(0, 3).map((item: any) => {
         // "an icon of {Item} ..." 에서 {Item}만 추출
         // 입력했던 labels 배열의 인덱스를 알면 좋겠지만, output 순서가 섞임.
         // 문자열 파싱으로 복구
         const originalLabel = item.label.replace('an icon of ', '').replace(' in a video game inventory', '');
         return {
            label: originalLabel,
            score: item.score
         };
      });
      
      self.postMessage({
        type: 'result',
        id: id,
        result: top3
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