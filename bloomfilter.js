(function(exports) {
  function BloomFilter(m, k) {
    this.m = m;
    this.k = k;
    this.buckets = [];
    var n = Math.ceil(m / k),
        i = -1;
    while (++i < n) this.buckets[i] = 0;
  }

  // See http://willwhim.wordpress.com/2011/09/03/producing-n-hash-functions-by-hashing-only-once/
  BloomFilter.prototype.locations = function(v) {
    var h = fnv64(v);
        a = h & 0xffffffff,
        b = (h & 0xffffffff00000000) >> 32,
        k = this.k,
        r = [],
        i = -1;
    while (++i < k) r[i] = (a + b * i) % this.m;
    return r;
  };

  BloomFilter.prototype.add = function(v) {
    var l = this.locations(v),
        i = -1,
        k = this.k;
    while (++i < k) this.buckets[Math.floor(l[i] / k)] |= 1 << (l[i] % k)
  };

  BloomFilter.prototype.test = function(v) {
    var l = this.locations(v),
        n = l.length,
        i = -1,
        k = this.k,
        b;
    while (++i < n) {
      b = l[i];
      if ((this.buckets[Math.floor(b / k)] & (1 << (b % k))) === 0) {
        return false;
      }
    }
    return true;
  };

  // Fowler/Noll/Vo fast hash
  function fnv64(d) {
    var n = d.length,
        h = 64,
        i = -1,
        c;
    while (++i < n) {
      c = d.charCodeAt(i);
      h *= 1099511628211;
      h ^= (c & 0xff00) >> 8;
      h *= 1099511628211;
      h ^= c & 0xff;
    }
    return h;
  }

  exports.BloomFilter = BloomFilter;
})(typeof exports !== "undefined" ? exports : window);
