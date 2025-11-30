import { createWorker, Worker as TesseractWorker, LoggerMessage } from 'tesseract.js';

type Logger = (message: LoggerMessage) => void;

let loggerRef: Logger | null = null;
let workerPromise: Promise<TesseractWorker> | null = null;

const ensureWorker = async () => {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('eng', 1, {
        logger: (m) => loggerRef?.(m),
      });
      return worker;
    })();
  }
  return workerPromise;
};

export const getSharedOcrWorker = async (logger?: Logger) => {
  loggerRef = logger ?? null;
  return ensureWorker();
};
