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
    var k = this.k,
        m = this.m,
        r = [],
        n = v.length,
        a = 2166136261,
        b,
        c,
        i = -1;
    // Fowler/Noll/Vo hashing.
    while (++i < n) {
      c = v.charCodeAt(i);
      a ^= (c & 0xff00) >> 8;
      a *= 16777619;
      a ^= c & 0xff;
      a *= 16777619;
    }
    b = a * 16777619;
    i = -1; while (++i < k) r[i] = (a + b * i) % m;
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

  exports.BloomFilter = BloomFilter;
})(typeof exports !== "undefined" ? exports : window);
