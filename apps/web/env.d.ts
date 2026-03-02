export {};

declare global {
  interface Window {
    __ENV__?: {
      VITE_API_URL?: string;
    };
  }
}
