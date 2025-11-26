import { ChangeEvent, useEffect, useState } from 'react';
import { Upload, Image as ImageIcon, Loader2, Settings2, RefreshCw } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  file: File | null;
  previewUrl: string | null;
  loading: boolean;
  progress: number;
  onFileSelect: (file: File) => void;
  onReanalyze: (options: { threshold: number; invert: boolean }) => void;
}

export function InventoryImageInput({ file, previewUrl: initialPreview, loading, progress, onFileSelect, onReanalyze }: Props) {
  const [processedPreview, setProcessedPreview] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(160); // 기본값: 밝은 회색 이상만
  const [invert, setInvert] = useState(false);
  const [showControls, setShowControls] = useState(false);

  // 파일이 바뀌면 초기화
  useEffect(() => {
    setProcessedPreview(null);
    setThreshold(160);
    setInvert(false);
  }, [file]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleApplyFilter = () => {
    onReanalyze({ threshold, invert });
  };

  const currentPreview = processedPreview || initialPreview;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-neutral-800/50 border border-neutral-700 rounded-lg p-6 flex flex-col items-center gap-4 relative overflow-hidden">
        {currentPreview ? (
          <div className="relative w-full bg-neutral-950 flex justify-center rounded-md overflow-hidden border border-neutral-800">
            <img 
              src={currentPreview} 
              alt="Inventory Preview" 
              className="object-contain max-h-80 w-full opacity-90" 
            />
            {loading && (
              <div className="absolute inset-0 bg-neutral-900/70 flex flex-col items-center justify-center text-amber-500 gap-2 backdrop-blur-sm z-10">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-sm font-medium tracking-wider">이미지 분석 중... {Math.round(progress * 100)}%</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-40 border-2 border-dashed border-neutral-700 rounded-lg flex flex-col items-center justify-center text-neutral-500 gap-2 hover:border-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer relative bg-neutral-900/30">
            <ImageIcon className="w-8 h-8" />
            <span className="text-sm">여기를 클릭하거나 스크린샷을 드래그하세요</span>
            <input 
              type="file" 
              accept="image/*" 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              onChange={handleChange}
            />
          </div>
        )}

        {/* 컨트롤 패널 */}
        {file && !loading && (
          <div className="w-full flex flex-col gap-3 mt-2">
            <div className="flex gap-2">
              <button 
                onClick={() => setShowControls(!showControls)}
                className={clsx(
                  "flex-1 py-2 px-4 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors",
                  showControls ? "bg-neutral-700 text-white" : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                )}
              >
                <Settings2 className="w-4 h-4" />
                필터 설정 {showControls ? '닫기' : '열기'}
              </button>
              
              <label className="flex-1 py-2 px-4 bg-neutral-800 text-neutral-400 hover:bg-neutral-700 rounded text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                이미지 변경
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleChange}
                />
              </label>
            </div>

            {showControls && (
              <div className="bg-neutral-900/80 p-4 rounded-lg border border-neutral-700 space-y-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>글자 선명도 (Threshold)</span>
                    <span>{threshold}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="255" 
                    value={threshold} 
                    onChange={(e) => setThreshold(parseInt(e.target.value))}
                    className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <p className="text-xs text-neutral-500">
                    * 값을 높이면 밝은 글자만 남고 배경이 사라집니다. (글자가 사라지면 값을 낮추세요)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="invert"
                    checked={invert}
                    onChange={(e) => setInvert(e.target.checked)}
                    className="rounded border-neutral-600 bg-neutral-800 text-amber-500 focus:ring-amber-500"
                  />
                  <label htmlFor="invert" className="text-sm text-neutral-300">색상 반전 (검은 글씨일 때 체크)</label>
                </div>

                <button 
                  onClick={handleApplyFilter}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  이 설정으로 다시 분석하기
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}