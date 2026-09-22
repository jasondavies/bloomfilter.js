const MAX_BITS = 0x100000000;
const MAX_BUCKETS = MAX_BITS / 32;
const SERIALISATION_VERSION = 1;

export class BloomFilter {

  /**
   * @param {number|ArrayLike} m - Number of bits, or an array of integers to load.
   * @param {number} k - Number of hashing functions.
   */
  constructor(m, k) {
    let a;
    if (typeof m !== "number") {
      assertBucketArrayLike(m);
      a = m;
      m = a.length * 32;
    } else {
      assertBitSize(m);
    }
    assertHashCount(k);

    const n = Math.ceil(m / 32);
    m = n * 32;
    this.m = m;
    this.k = k;

    const kbytes = 1 << Math.ceil(Math.log2(Math.ceil(Math.log2(m) / 8)));
    const ArrayType = kbytes === 1 ? Uint8Array : kbytes === 2 ? Uint16Array : Uint32Array;
    const kbuffer = new ArrayBuffer(kbytes * k);
    const buckets = new Uint32Array(n);
    if (a) {
      for (let i = 0; i < n; ++i) {
        const value = a[i];
        assertBucketValue(value);
        buckets[i] = value;
      }
    }
    this.buckets = buckets;
    this._locations = new ArrayType(kbuffer);
  }

  // See http://willwhim.wpengine.com/2011/09/03/producing-n-hash-functions-by-hashing-only-once/
  locations(v) {
    const k = this.k;
    const m = this.m;
    const r = this._locations;
    let [a, b] = hash64(v);

    a = (a % m);
    if (a < 0) a += m;
    b = (b % m);
    if (b < 0) b += m;

    // Use enhanced double hashing, i.e. r[i] = h1(v) + i*h2(v) + (i*i*i - i)/6
    // Reference:
    //   Dillinger, Peter C., and Panagiotis Manolios. "Bloom filters in probabilistic verification."
    //   https://www.khoury.northeastern.edu/~pete/pub/bloom-filters-verification.pdf
    r[0] = a;
    for (let i = 1; i < k; ++i) {
      a += b;
      if (a >= m) a -= m;
      b += i;
      if (b >= m) b = i < m ? b - m : b % m;
      r[i] = a;
    }
    return r;
  }

  add(v) {
    v = v + "";

    const k = this.k;
    const m = this.m;
    let [a, b] = hash64(v);

    a = (a % m);
    if (a < 0) a += m;
    b = (b % m);
    if (b < 0) b += m;

    const buckets = this.buckets;
    // Generate each location as it is used, without filling _locations.
    for (let i = 0; ; ) {
      buckets[a >>> 5] |= 1 << (a & 31);
      if (++i === k) break;
      a += b;
      if (a >= m) a -= m;
      b += i;
      // For i < m, the normalized sum is below 2m.
      if (b >= m) b = i < m ? b - m : b % m;
    }
  }

  test(v) {
    v = v + "";

    const k = this.k;
    const m = this.m;
    let [a, b] = hash64(v);

    a = (a % m);
    if (a < 0) a += m;
    b = (b % m);
    if (b < 0) b += m;

    const buckets = this.buckets;
    // Generate each location as it is used, without filling _locations.
    for (let i = 0; ; ) {
      if (!(buckets[a >>> 5] & (1 << (a & 31)))) return false;
      if (++i === k) break;
      a += b;
      if (a >= m) a -= m;
      b += i;
      // For i < m, the normalized sum is below 2m.
      if (b >= m) b = i < m ? b - m : b % m;
    }
    return true;
  }

  // Estimated cardinality.
  size() {
    return -this.m * Math.log(1 - this.countBits() / this.m) / this.k;
  }

  countBits() {
    const buckets = this.buckets;
    let bits = 0;
    for (let i = 0; i < buckets.length; ++i) {
      bits += popcnt(buckets[i]);
    }
    return bits;
  }

  error() {
    return Math.pow(this.countBits() / this.m, this.k);
  }

  toJSON() {
    return {
      version: SERIALISATION_VERSION,
      m: this.m,
      k: this.k,
      buckets: Array.from(this.buckets)
    };
  }

  // Static methods.

  static fromJSON(value) {
    const data = typeof value === "string" ? JSON.parse(value) : value;
    assertSerialisedFilter(data);

    if (data.version !== undefined && data.version !== SERIALISATION_VERSION) {
      throw new RangeError(`Unsupported BloomFilter serialisation format version: ${data.version}.`);
    }

    const expectedM = data.buckets.length * 32;
    if (data.m !== undefined && data.m !== expectedM) {
      throw new RangeError("Serialised BloomFilter has inconsistent m and buckets.");
    }

    return new BloomFilter(data.buckets, data.k);
  }

  static union(a, b) {
    if (a.m === b.m && a.k === b.k && a.buckets.length === b.buckets.length) {
      const l = a.buckets.length;
      const result = new BloomFilter(l * 32, a.k);
      const c = result.buckets;
      for (let i = 0; i < l; ++i) {
        c[i] = a.buckets[i] | b.buckets[i];
      }
      return result;
    }
    throw new Error("Bloom filters must have identical {m, k}.");
  }

  static intersection(a, b) {
    if (a.m === b.m && a.k === b.k && a.buckets.length === b.buckets.length) {
      const l = a.buckets.length;
      const result = new BloomFilter(l * 32, a.k);
      const c = result.buckets;
      for (let i = 0; i < l; ++i) {
        c[i] = a.buckets[i] & b.buckets[i];
      }
      return result;
    }
    throw new Error("Bloom filters must have identical {m, k}.");
  }

  static withTargetError (n, error) {
    assertExpectedSize(n);
    assertTargetError(error);
    const m = Math.ceil(-n * Math.log2(error) / Math.LN2);
    const k = Math.ceil(Math.LN2 * m / n);
    return new BloomFilter(m, k);
  }
};

// FNV-1a over UTF-16 code units, preserving version-1 serialisation.
function hash64(v) {
  const fnv64PrimeX = 0x01b3;
  const l = v.length;
  let t0 = 0, t1 = 0, t2 = 0, t3 = 0;
  let v0 = 0x2325, v1 = 0x8422, v2 = 0x9ce4, v3 = 0xcbf2;

  for (let i = 0; i < l; ++i) {
    v0 ^= v.charCodeAt(i);
    t0 = v0 * fnv64PrimeX; t1 = v1 * fnv64PrimeX; t2 = v2 * fnv64PrimeX; t3 = v3 * fnv64PrimeX;
    t2 += v0 << 8; t3 += v1 << 8;
    t1 += t0 >>> 16;
    v0 = t0 & 0xffff;
    t2 += t1 >>> 16;
    v1 = t1 & 0xffff;
    v3 = (t3 + (t2 >>> 16)) & 0xffff;
    v2 = t2 & 0xffff;
  }

  return [(v3 << 16) | v2, (v1 << 16) | v0];
}

// http://graphics.stanford.edu/~seander/bithacks.html#CountBitsSetParallel
function popcnt(v) {
  v -= (v >>> 1) & 0x55555555;
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return ((v + (v >>> 4) & 0xf0f0f0f) * 0x1010101) >>> 24;
}

function assertBitSize(m) {
  if (typeof m !== "number" || !Number.isFinite(m) || m <= 0 || m > MAX_BITS) {
    throw new RangeError(`m must be a positive finite number of bits no greater than ${MAX_BITS}.`);
  }
}

function assertBucketArrayLike(a) {
  if (a == null || !Number.isInteger(a.length) || a.length <= 0 || a.length > MAX_BUCKETS) {
    throw new RangeError(`m must be a positive number of bits or a non-empty array-like of up to ${MAX_BUCKETS} 32-bit buckets.`);
  }
}

function assertBucketValue(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError("Bucket values must be unsigned 32-bit integers.");
  }
}

function assertHashCount(k) {
  if (!Number.isInteger(k) || k <= 0) {
    throw new RangeError("k must be a positive integer.");
  }
}

function assertExpectedSize(n) {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) {
    throw new RangeError("n must be a positive finite number.");
  }
}

function assertTargetError(error) {
  if (typeof error !== "number" || !Number.isFinite(error) || error <= 0 || error >= 1) {
    throw new RangeError("error must be a finite number between 0 and 1, exclusive.");
  }
}

function assertSerialisedFilter(data) {
  if (data == null || typeof data !== "object") {
    throw new RangeError("Serialised BloomFilter must be an object or JSON string.");
  }
  if (!("k" in data)) {
    throw new RangeError("Serialised BloomFilter must include k.");
  }
  if (!("buckets" in data)) {
    throw new RangeError("Serialised BloomFilter must include buckets.");
  }
}
