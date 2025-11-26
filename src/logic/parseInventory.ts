import { RawItem } from '../types';

/**
 * OCR 결과 텍스트를 분석하여 아이템 이름과 수량을 추출합니다.
 * 노이즈 제거 및 다양한 형식 대응 로직 포함
 */
export function parseInventory(text: string): RawItem[] {
  const lines = text.split('\n');
  const items: RawItem[] = [];

  // 1. 기본 패턴: "Item Name x10"
  // x 대신 잘못 인식될 수 있는 문자들: «, (, [, <, K, X
  const mainPattern = /^(.+?)\s*([xX×«(\[<K])\s*(\d+)\s*$/;
  
  // 2. 숫자만 뒤에 있는 패턴: "Item Name 10" (위험할 수 있으나 보조용)
  const fallbackPattern = /^(.+?)\s+(\d+)\s*$/;

  // 무시할 짧은 라인이나 노이즈
  const ignorePatterns = [
    /^\d+\/\d+/, // "486/500" 같은 무게 표시
    /^[0-9\W]+$/, // 숫자와 특수문자로만 구성된 라인
    /^A\s+\d+/,   // "A 486..." 같은 노이즈
    /^EB\s+\d+/,
  ];

  for (const line of lines) {
    let cleanLine = line.trim();
    if (!cleanLine) continue;

    // 노이즈 필터링
    if (ignorePatterns.some(p => p.test(cleanLine))) continue;

    // 불필요한 앞쪽 숫자/기호 제거 (예: "01 Assorted Seeds..." -> "Assorted Seeds...")
    // 단, 아이템 이름이 숫자로 시작할 수도 있으니 조심해야 함. 
    // 여기서는 "숫자 + 공백"으로 시작하는 경우 제거
    cleanLine = cleanLine.replace(/^\d+\s+/, '');
    
    // 이상한 기호 제거 (®, © 등)
    cleanLine = cleanLine.replace(/[®©™]/g, '');

    let name = '';
    let qty = 0;

    const match = cleanLine.match(mainPattern);
    if (match) {
      name = match[1].trim();
      qty = parseInt(match[3], 10);
    } else {
      const matchFallback = cleanLine.match(fallbackPattern);
      if (matchFallback) {
        name = matchFallback[1].trim();
        qty = parseInt(matchFallback[2], 10);
      }
    }

    if (name && !isNaN(qty)) {
      // 이름 정제
      // 끝에 남은 특수문자 제거
      name = name.replace(/[:\-]+$/, '').trim();
      
      if (name.length > 2) { // 너무 짧은 이름은 무시
        items.push({ name, qty });
      }
    }
  }

  return items;
}
