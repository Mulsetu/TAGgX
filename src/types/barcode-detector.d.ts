export {};

// Browser API constructor; referenced via Window.BarcodeDetector.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare class BarcodeDetector {
  constructor(options?: { formats?: string[] });
  detect(image: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: typeof BarcodeDetector;
  }
}
