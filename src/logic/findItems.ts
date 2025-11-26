import { ITEMS_DB } from '../data/items';
import { RawItem } from '../types';
import { getSimilarity } from './stringUtils';

/**
 * 텍스트에서 알려진 아이템들을 능동적으로 찾아냅니다.
 * 1. 텍스트를 라인별로 나눕니다.
 * 2. 각 라인이 DB의 아이템 이름과 얼마나 유사한지 비교합니다.
 * 3. 일정 유사도(예: 0.6) 이상이면 해당 아이템으로 간주합니다.
 * 4. 아이템 이름 뒤에 있는 숫자를 수량으로 추출합니다.
 */
export function findKnownItems(text: string): RawItem[] {
  const lines = text.split('\n');
  const foundItems: RawItem[] = [];
  
  // 이미 찾은 라인은 중복 처리 방지
  const processedLines = new Set<number>();

  const dbItems = Object.values(ITEMS_DB);

  lines.forEach((line, lineIdx) => {
    const cleanLine = line.trim();
    if (!cleanLine || cleanLine.length < 3) return;

    let bestMatchItem = null;
    let bestScore = 0;

    // 1. DB의 모든 아이템과 현재 라인을 비교
    for (const dbItem of dbItems) {
      // 라인에 아이템 이름이 포함되어 있는지 확인 (부분 일치 우선)
      // OCR 오타를 고려해 "Assorted Seeds" -> "Asso rted Se" 정도도 매칭해야 함
      
      // 전략 A: 라인 앞부분이 아이템 이름과 유사한지 확인
      // "Assorted Seeds x40" -> 앞부분 "Assorted Seeds" 추출 시도
      const words = cleanLine.split(' ');
      
      // 윈도우 슬라이딩 방식으로 부분 문자열 비교
      // 아이템 이름 길이(단어 수)만큼의 윈도우를 만들어서 비교
      const nameParts = dbItem.name.split(' ');
      const windowSize = nameParts.length;
      
      if (words.length < windowSize) continue;

      // 라인의 앞쪽 단어들만 조합해서 비교 (보통 "이름 x수량" 순서이므로)
      // 조금 더 유연하게 라인 전체에서 검색
      for (let i = 0; i <= words.length - windowSize; i++) {
        const targetPhrase = words.slice(i, i + windowSize).join(' ');
        const score = getSimilarity(dbItem.name.toLowerCase(), targetPhrase.toLowerCase());

        if (score > bestScore) {
          bestScore = score;
          bestMatchItem = dbItem;
        }
      }
    }

    // 유사도 임계값 (0.6 정도면 꽤 관대하게 오타 허용)
    if (bestMatchItem && bestScore > 0.55) {
      // 아이템을 찾았음! 이제 수량을 찾자.
      // 아이템 이름 뒤에 나오는 숫자, 혹은 라인 끝의 숫자를 찾는다.
      
      // 숫자 추출 정규식
      const qtyMatch = cleanLine.match(/(\d+)\s*$/) || cleanLine.match(/[xX×:\[]\s*(\d+)/);
      
      let qty = 1; // 기본값
      if (qtyMatch) {
        qty = parseInt(qtyMatch[1], 10);
      }

      // 중복 방지 (같은 아이템이 여러 줄에 걸쳐 인식될 수도 있음)
      // 여기서는 단순하게 추가
      foundItems.push({
        name: bestMatchItem.name,
        qty: qty
      });
      
      processedLines.add(lineIdx);
    }
  });

  return foundItems;
}
