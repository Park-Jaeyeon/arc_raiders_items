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
      
      // CLIP에게 물어봅니다: "이 이미지가 다음 라벨들 중 무엇에 가장 가깝니?"
      // labels: ["Standard Ammo", "Assorted Seeds", "Medical Kit", ...]
      const output = await classifier(image, labels);
      
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