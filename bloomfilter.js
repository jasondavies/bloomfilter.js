(function(exports) {
  exports.BloomFilter = BloomFilter;

  const typedArrays = typeof ArrayBuffer !== "undefined";

  // Creates a new bloom filter.  If *m* is an array-like object, with a length
  // property, then the bloom filter is loaded with data from the array, where
  // each element is a 32-bit integer.  Otherwise, *m* should specify the
  // number of bits.  Note that *m* is rounded up to the nearest multiple of
  // 32.  *k* specifies the number of hashing functions.
  function BloomFilter(m, k) {
    let a;
    if (typeof m !== "number") {
      a = m;
      m = a.length * 32;
    }

    const n = Math.ceil(m / 32);
    m = n * 32;
    this.m = m;
    this.k = k;

    if (typedArrays) {
      const kbytes = 1 << Math.ceil(Math.log(Math.ceil(Math.log(m) / Math.LN2 / 8)) / Math.LN2);
      const array = kbytes === 1 ? Uint8Array : kbytes === 2 ? Uint16Array : Uint32Array;
      const kbuffer = new ArrayBuffer(kbytes * k);
      const buckets = new Int32Array(n);
      if (a) {
        for (let i = 0; i < n; ++i) {
          buckets[i] = a[i];
        }
      }
      this.buckets = buckets;
      this._locations = new array(kbuffer);
    } else {
      const buckets = [];
      if (a) {
        for (let i = 0; i < n; ++i) {
          buckets[i] = a[i];
        }
      } else {
        for (let i = 0; i < n; ++i) {
          buckets[i] = 0;
        }
      }
      this.buckets = buckets;
      this._locations = [];
    }
  }

  // See http://willwhim.wpengine.com/2011/09/03/producing-n-hash-functions-by-hashing-only-once/
  BloomFilter.prototype.locations = function(v) {
    const k = this.k;
    const m = this.m;
    const r = this._locations;
    let a;
    let b;

    // FNV-1a hash (64-bit).
    {
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

      a = (v3 << 16) | v2;
      b = (v1 << 16) | v0;
    }

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
      a = (a + b) % m;
      b = (b + i) % m;
      r[i] = a;
    }
    return r;
  };

  BloomFilter.prototype.add = function(v) {
    const l = this.locations(v + "");
    const k = this.k;
    const buckets = this.buckets;
    for (let i = 0; i < k; ++i) {
      buckets[l[i] >> 5] |= 1 << (l[i] & 0x1f);
    }
  };

  BloomFilter.prototype.test = function(v) {
    const l = this.locations(v + "");
    const k = this.k;
    const buckets = this.buckets;
    for (let i = 0; i < k; ++i) {
      const b = l[i];
      if ((buckets[b >> 5] & (1 << (b & 0x1f))) === 0) {
        return false;
      }
    }
    return true;
  };

  // Estimated cardinality.
  BloomFilter.prototype.size = function() {
    const buckets = this.buckets;
    let bits = 0;
    for (let i = 0; i < buckets.length; ++i) {
      bits += popcnt(buckets[i]);
    }
    return -this.m * Math.log(1 - bits / this.m) / this.k;
  };

  // http://graphics.stanford.edu/~seander/bithacks.html#CountBitsSetParallel
  function popcnt(v) {
    v -= (v >> 1) & 0x55555555;
    v = (v & 0x33333333) + ((v >> 2) & 0x33333333);
    return ((v + (v >> 4) & 0xf0f0f0f) * 0x1010101) >> 24;
  }
})(typeof exports !== "undefined" ? exports : this);
