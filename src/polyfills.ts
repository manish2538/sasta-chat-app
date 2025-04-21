// Polyfill for global object in browser environment
if (typeof window !== 'undefined') {
  (window as any).global = window;
} 