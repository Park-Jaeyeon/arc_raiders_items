interface Props {
  text: string;
  onChange: (text: string) => void;
}

export function InventoryTextInput({ text, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2 h-full">
      <label className="text-sm font-medium text-neutral-400">추출된 텍스트 / 직접 입력</label>
      <textarea
        className="w-full h-full min-h-[200px] bg-neutral-950 border border-neutral-700 rounded-lg p-4 text-sm text-neutral-300 font-mono focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none resize-none"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`예시:\nAssorted Seeds x40\nRusted Medical Kit x5`}
      />
      <p className="text-xs text-neutral-600">
        * OCR 인식이 부정확할 경우 직접 수정해서 결과를 확인할 수 있습니다.
      </p>
    </div>
  );
}
