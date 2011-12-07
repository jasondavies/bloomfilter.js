(function(exports) {
  exports.BloomFilter = BloomFilter;
  exports.fnv_1a = fnv_1a;
  exports.fnv_1a_b = fnv_1a_b;

  var typedArrays = typeof ArrayBuffer !== "undefined";

  function BloomFilter(m, k) {
    this.m = m;
    this.k = k;
    var n = Math.ceil(m / k);
    if (typedArrays) {
      var buffer = new ArrayBuffer(4 * n),
          kbytes = 1 << Math.ceil(Math.log(Math.ceil(Math.log(m) / Math.LN2 / 8)) / Math.LN2),
          array = kbytes === 1 ? Uint8Array : kbytes === 2 ? Uint16Array : Uint32Array,
          kbuffer = new ArrayBuffer(kbytes * k);
      this.buckets = new Uint32Array(buffer);
      this._locations = new array(kbuffer);
    } else {
      var buckets = this.buckets = [],
          i = -1;
      while (++i < n) buckets[i] = 0;
      this._locations = [];
    }
  }

  // See http://willwhim.wordpress.com/2011/09/03/producing-n-hash-functions-by-hashing-only-once/
  BloomFilter.prototype.locations = function(v) {
    var k = this.k,
        m = this.m,
        r = this._locations,
        a = fnv_1a(v),
        b = fnv_1a_b(a),
        i = -1,
        x;
    while (++i < k) {
      x = (a + b * i) % m;
      r[i] = x < 0 ? x + m : x;
    }
    return r;
  };

  BloomFilter.prototype.add = function(v) {
    var l = this.locations(v),
        i = -1,
        k = this.k,
        buckets = this.buckets;
    while (++i < k) buckets[Math.floor(l[i] / k)] |= 1 << (l[i] % k)
  };

  BloomFilter.prototype.test = function(v) {
    var l = this.locations(v),
        n = l.length,
        i = -1,
        k = this.k,
        b,
        buckets = this.buckets;
    while (++i < n) {
      b = l[i];
      if ((buckets[Math.floor(b / k)] & (1 << (b % k))) === 0) {
        return false;
      }
    }
    return true;
  };

  // Fowler/Noll/Vo hashing.
  function fnv_1a(v) {
    var n = v.length,
        a = 2166136261,
        c,
        d,
        i = -1;
    while (++i < n) {
      c = v.charCodeAt(i);
      if (d = c & 0xff000000) {
        a ^= d >> 24;
        a += (a << 1) + (a << 4) + (a << 7) + (a << 8) + (a << 24);
      }
      if (d = c & 0xff0000) {
        a ^= d >> 16;
        a += (a << 1) + (a << 4) + (a << 7) + (a << 8) + (a << 24);
      }
      if (d = c & 0xff00) {
        a ^= d >> 8;
        a += (a << 1) + (a << 4) + (a << 7) + (a << 8) + (a << 24);
      }
      a ^= c & 0xff;
      a += (a << 1) + (a << 4) + (a << 7) + (a << 8) + (a << 24);
    }
    return a & 0xffffffff;
  }

  // One additional iteration of FNV, given a hash.
  function fnv_1a_b(a) {
    a += (a << 1) + (a << 4) + (a << 7) + (a << 8) + (a << 24);
    return a & 0xffffffff;
  }
})(typeof exports !== "undefined" ? exports : this);
