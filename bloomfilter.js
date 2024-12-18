(function(exports) {
  exports.BloomFilter = BloomFilter;
  exports.fnv_1a = fnv_1a;

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
    const a = fnv_1a(v);
    const b = fnv_1a_round(a);
    const z = (fnv_1a_round(b) & 0x7fffffff) % m;
    let x = (a & 0x7fffffff) % m;
    let y = ((b & 0x7fffffff) % m) | 1;
    for (let i = 0; i < k; ++i) {
      r[i] = x;
      x = (x + y) % m;
      y = (y + z) % m;
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

  // Fowler/Noll/Vo hashing.
  function fnv_1a(v) {
    let a = 2166136261;
    for (let i = 0; i < v.length; ++i) {
      const c = v.charCodeAt(i);
      const d = c & 0xff00;
      if (d) {
        a = fnv_multiply(a ^ d >> 8);
      }
      a = fnv_multiply(a ^ c & 0xff);
    }
    return fnv_mix(a);
  }

  // a * 16777619 mod 2**32
  function fnv_multiply(a) {
    return a + (a << 1) + (a << 4) + (a << 7) + (a << 8) + (a << 24);
  }

  // One additional iteration of FNV, given a hash.
  function fnv_1a_round(a) {
    return fnv_mix(fnv_multiply(a));
  }

  // See https://web.archive.org/web/20131019013225/http://home.comcast.net/~bretm/hash/6.html
  function fnv_mix(a) {
    a += a << 13;
    a ^= a >>> 7;
    a += a << 3;
    a ^= a >>> 17;
    a += a << 5;
    return a & 0xffffffff;
  }
})(typeof exports !== "undefined" ? exports : this);
