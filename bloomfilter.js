(function(exports) {
  exports.BloomFilter = BloomFilter;
  exports.fromBytestream = fromBytestream;
  exports.fnv_1a = fnv_1a;
  exports.fnv_1a_b = fnv_1a_b;

  var typedArrays = typeof ArrayBuffer !== "undefined";

  // Creates a new bloom filter with *m* bits and *k* hashing functions.
  function BloomFilter(m, k) {
    this.m = m;
    this.k = k;
    var n = Math.ceil(m / 32);
    if (typedArrays) {
      var kbytes = 1 << Math.ceil(Math.log(Math.ceil(Math.log(m) / Math.LN2 / 8)) / Math.LN2),
          array = kbytes === 1 ? Uint8Array : kbytes === 2 ? Uint16Array : Uint32Array,
          kbuffer = new ArrayBuffer(kbytes * k);
      this.buckets = new Int32Array(n);
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
        x = a % m;
    while (++i < k) {
      r[i] = x < 0 ? (x + m) : x;
      x = (x + b) % m;
    }
    return r;
  };

  BloomFilter.prototype.add = function(v) {
    var l = this.locations(v + ""),
        i = -1,
        k = this.k,
        buckets = this.buckets;
    while (++i < k) buckets[Math.floor(l[i] / 32)] |= 1 << (l[i] % 32);
  };

  BloomFilter.prototype.test = function(v) {
    var l = this.locations(v + ""),
        i = -1,
        k = this.k,
        b,
        buckets = this.buckets;
    while (++i < k) {
      b = l[i];
      if ((buckets[Math.floor(b / 32)] & (1 << (b % 32))) === 0) {
        return false;
      }
    }
    return true;
  };

  BloomFilter.prototype.toBytestream = function() {
    var res = [],
        buckets = this.buckets,
        i,
        j;

    for(i = 0; i < 4; i++) {
      res.push((this.m >> 8*i) & 255);
    }

    for(i = 0; i < 2; i++) {
      res.push((this.k >> 8*i) & 255);
    }

    for(j = 0; j < buckets.length; j++) {
      for(i = 0; i < 4; i++) {
        res.push((buckets[j] >> 8*i) & 255);
      }
    }

    return res;
  };

  function fromBytestream(bytes) {
    var m = 0,
        k = 0,
        idx = 0,
        i,
        j;

    for(i = 3; i >= 0; i--) {
      m = m << 8;
      m = m | (bytes[idx + i] & 255);
    }
    idx += 4;

    for(i = 1; i >= 0; i--) {
      k = k << 8;
      k = k | (bytes[idx + i] & 255);
    }
    idx += 2;

    var bloom = new BloomFilter(m,k),
        buckets = bloom.buckets;

    for(j = 0; j < buckets.length; j++) {
      for(i = 3; i >= 0; i--) {
        buckets[j] = buckets[j] << 8;
        buckets[j] = buckets[j] | (bytes[idx + i] & 255);
      }
      idx += 4;
    }

    return bloom;
  }

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
    // From http://home.comcast.net/~bretm/hash/6.html
    a += a << 13;
    a ^= a >> 7;
    a += a << 3;
    a ^= a >> 17;
    a += a << 5;
    return a & 0xffffffff;
  }

  // One additional iteration of FNV, given a hash.
  function fnv_1a_b(a) {
    a += (a << 1) + (a << 4) + (a << 7) + (a << 8) + (a << 24);
    a += a << 13;
    a ^= a >> 7;
    a += a << 3;
    a ^= a >> 17;
    a += a << 5;
    return a & 0xffffffff;
  }
})(typeof exports !== "undefined" ? exports : this);
