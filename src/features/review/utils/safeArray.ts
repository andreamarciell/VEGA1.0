/**
 * Ensures the value is always returned as an array.
 * If the input is already an array, it is returned unchanged.
 * For undefined, null, empty string or any non‑array value,
 * an empty array is returned so that `.map()` calls are safe.
 */
export function safeArray<T>(val: T[] | T | null | undefined): T[] {
  return Array.isArray(val) ? (val as T[]) : [];
}

// Provide also a default export for compatibility with default imports.
export default safeArray;
