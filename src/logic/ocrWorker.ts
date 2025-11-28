import { createWorker, Worker as TesseractWorker, LoggerMessage } from 'tesseract.js';

type Logger = (message: LoggerMessage) => void;

let loggerRef: Logger | null = null;
let workerPromise: Promise<TesseractWorker> | null = null;

const ensureWorker = async () => {
  if (!workerPromise) {
    workerPromise = (async () => {
      const worker = await createWorker('eng', {
        logger: (m) => loggerRef?.(m),
      });
      // createWorker('eng') already loads/initializes, but call explicitly for clarity
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await worker.loadLanguage?.('eng');
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await worker.initialize?.('eng');
      return worker;
    })();
  }
  return workerPromise;
};

export const getSharedOcrWorker = async (logger?: Logger) => {
  loggerRef = logger ?? null;
  return ensureWorker();
};
