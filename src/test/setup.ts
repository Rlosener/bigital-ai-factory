import "@testing-library/jest-dom/vitest";

// Node 26 exposes an optional global localStorage implementation that is
// unavailable unless a file is configured. Give jsdom tests their own isolated,
// browser-compatible storage so the suite does not depend on the host process.
const memoryStorage = (() => {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key: string) {
      return entries.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(entries.keys())[index] ?? null;
    },
    removeItem(key: string) {
      entries.delete(key);
    },
    setItem(key: string, value: string) {
      entries.set(key, String(value));
    },
  } satisfies Storage;
})();

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: memoryStorage,
});

if (globalThis !== window) {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: memoryStorage,
  });
}
