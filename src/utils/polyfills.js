/**
 * ES2024 `Map.prototype.getOrInsert` / `getOrInsertComputed` polyfill.
 *
 * pdf.js 6.x (and several other modern libraries) rely on these methods, which
 * ship in Safari 18 / Chrome 133+ and Node 22. On older engines pdf.js throws
 *   TypeError: this[#methodPromises].getOrInsertComputed is not a function
 * and every page renders blank.
 *
 * Installing the polyfill before pdf.js is imported keeps OmniDoc working on
 * macOS versions below 15 as well as in CI browsers.
 */
if (typeof Map.prototype.getOrInsert !== 'function') {
  Object.defineProperty(Map.prototype, 'getOrInsert', {
    value: function (key, valueInMap) {
      const map = this;
      if (map.has(key)) return map.get(key);
      map.set(key, valueInMap);
      return valueInMap;
    },
    writable: true,
    configurable: true,
  });
}

if (typeof Map.prototype.getOrInsertComputed !== 'function') {
  Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
    value: function (key, callback) {
      const map = this;
      if (map.has(key)) return map.get(key);
      const value = callback(key);
      map.set(key, value);
      return value;
    },
    writable: true,
    configurable: true,
  });
}

/**
 * `Math.sumPrecise` polyfill (Safari 18.2+). pdf.js uses it for accurate
 * summation in a few layout paths.
 */
if (typeof Math.sumPrecise !== 'function') {
  Math.sumPrecise = function (items) {
    let sum = 0;
    if (items) {
      for (const item of items) {
        sum += Number(item) || 0;
      }
    }
    return sum;
  };
}

export {};
