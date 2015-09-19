(function(exports) {
  exports.BloomFilter = BloomFilter;
  exports.fnv_1a = fnv_1a;
  exports.fnv_1a_b = fnv_1a_b;

  var typedArrays = typeof ArrayBuffer !== "undefined";

  // Creates a new bloom filter.  If *m* is an array-like object, with a length
  // property, then the bloom filter is loaded with data from the array, where
  // each element is a 32-bit integer.  Otherwise, *m* should specify the
  // number of bits.  Note that *m* is rounded up to the nearest multiple of
  // 32.  *k* specifies the number of hashing functions.
  function BloomFilter(m, k) {
    var a;
    if (typeof m !== "number") a = m, m = a.length * 32;

    var n = Math.ceil(m / 32),
        i = -1;
    this.m = m = n * 32;
    this.k = k;

    if (typedArrays) {
      var kbytes = 1 << Math.ceil(Math.log(Math.ceil(Math.log(m) / Math.LN2 / 8)) / Math.LN2),
          array = kbytes === 1 ? Uint8Array : kbytes === 2 ? Uint16Array : Uint32Array,
          kbuffer = new ArrayBuffer(kbytes * k),
          buckets = this.buckets = new Int32Array(n);
      if (a) while (++i < n) buckets[i] = a[i];
      this._locations = new array(kbuffer);
    } else {
      var buckets = this.buckets = [];
      if (a) while (++i < n) buckets[i] = a[i];
      else while (++i < n) buckets[i] = 0;
      this._locations = [];
    }
  }

  // See http://willwhim.wpengine.com/2011/09/03/producing-n-hash-functions-by-hashing-only-once/
  BloomFilter.prototype.locations = function(v) {
    var k = this.k,
        m = this.m,
        r = this._locations,
        a = fnv_1a(v),
        b = fnv_1a_b(a),
        x = a % m;
    for (var i = 0; i < k; ++i) {
      r[i] = x < 0 ? (x + m) : x;
      x = (x + b) % m;
    }
    return r;
  };

  BloomFilter.prototype.add = function(v) {
    var l = this.locations(v + ""),
        k = this.k,
        buckets = this.buckets;
    for (var i = 0; i < k; ++i) buckets[Math.floor(l[i] / 32)] |= 1 << (l[i] % 32);
  };

  BloomFilter.prototype.test = function(v) {
    var l = this.locations(v + ""),
        k = this.k,
        buckets = this.buckets;
    for (var i = 0; i < k; ++i) {
      var b = l[i];
      if ((buckets[Math.floor(b / 32)] & (1 << (b % 32))) === 0) {
        return false;
      }
    }
    return true;
  };

  // Estimated cardinality.
  BloomFilter.prototype.size = function() {
    var buckets = this.buckets,
        bits = 0;
    for (var i = 0, n = buckets.length; i < n; ++i) bits += popcnt(buckets[i]);
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
    var a = 2166136261;
    for (var i = 0, n = v.length; i < n; ++i) {
      var c = v.charCodeAt(i),
          d = c & 0xff00;
      if (d) a = fnv_multiply(a ^ d >> 8);
      a = fnv_multiply(a ^ c & 0xff);
    }
    return fnv_mix(a);
  }

  // a * 16777619 mod 2**32
  function fnv_multiply(a) {
    return a + (a << 1) + (a << 4) + (a << 7) + (a << 8) + (a << 24);
  }

  // One additional iteration of FNV, given a hash.
  function fnv_1a_b(a) {
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

  exports.StableBloomFilter = StableBloomFilter;

  /**
   * Canonical variables used in Deng, Rafiei (2006). 
   *
   * m: Number of cells. Is rounded to the nearest 32 bits. 
   * k: Number of hash functions. 
   * d: Number of bits per cell. 
   *
   * A stable bloom filter degenerates to a normal bloom filter when d=1 and p=0. 
   *
   * opts: Dictionary of options
   *
   * options:
   *    p: int              Number of cells to decrement after each add(). 
   *    fps: float          Acceptable false positive rate. If this is specified instead of p, then 
   *                        we will solve for the lowest p using equation 17 from Deng, Rafiei (2006). 
   */
  function StableBloomFilter(m, k, d, opts) {
    m = Math.ceil(m / 32) * 32;

    this.m = m;
    this.k = k;
    this.d = d;

    if(typeof opts.p === 'undefined') {
      if(typeof opts.fps === 'undefined') {
        throw new TypeError("One of `p` or `fps` must be specified.");
      }

      var Max = Math.pow(2, d) - 1;

      var factorOne = (1 / Math.pow(1 - Math.pow(opts.fps, 1 / k), 1 / Max)) - 1;
      var factorTwo = ((1 / k) - (1 / m));
      this.p = Math.ceil(1 / (factorOne * factorTwo));

      // We certainly can't purge more cells than there are! Cap it at how many cells there are. 
      if(this.p > this.m) {
        this.p = this.m;
      }

    } else {
      this.p = opts.p;
    }

    this.buffer = new ArrayBuffer(m * d / 8);
  }

  StableBloomFilter.prototype._slice = function(cellIndex) {
    // Cases to consider when reasoning about this code: 
    //    * Cells are shorter, equal to, and longer than bytes
    //    * Cell begins before, on, and after byte line
    //    * Cell ends before, on, and after byte line
    //
    //    * Cell width of 11, cell index is 5. Interesting because it's a cell 
    //      whose start bit index is exactly 1 less than the byte line, and
    //      it's total extension covers three bytes. 

    var cellSliceBeginIdx = Math.floor(cellIndex     * this.d / 8),
      cellSliceEndIdx =     Math.floor((cellIndex+1) * this.d / 8);

    var cellBytes = this.buffer.slice(cellSliceBeginIdx, cellSliceEndIdx+1);

    // Byte alignment calculation
    var bitsBeforeThisCell = 0,
        bitsAfterThisCell = 0;

    if(cellIndex !== 0) {
      // The 0th cell is always zero-aligned, but after that we could be misaligned.
      var previousByteLine = cellSliceBeginIdx*8,
          nextByteLine     = cellSliceEndIdx*8;

      bitsBeforeThisCell = cellIndex * this.d - previousByteLine;
      bitsAfterThisCell = nextByteLine - (cellIndex+1) * this.d;
    }

    return {
      cellSliceBeginIdx: cellSliceBeginIdx,
      bitsBeforeThisCell: bitsBeforeThisCell,
      bitsAfterThisCell: bitsAfterThisCell,
      cellBytes: cellBytes
    };
  };

  /**
   * v: string
   */
  StableBloomFilter.prototype.add = function(v) {
    var cellIndices = this._selectCells(v);
    var bufferViewAsUint8 = new Uint8Array(this.buffer);
    
    for(var i = 0; i < this.k; i++) {

      // Adding an element raises all of the bits in the cell. 

      var cellPositioning = this._slice(cellIndices[i]);
      var cellBytes = new Uint8Array(cellPositioning.cellBytes);

      for(var j = 0; j < cellBytes.length; j++) {

        var cellByte = cellBytes[j];

        // The bit string with all ones
        var raisedByte = 255;

        // Re-align the bytes, if necessary. 

        if(j === 0) {
          // For the first byte, if we aren't byte-aligned at the beginning then we don't raise the first few bits
          raisedByte >> cellPositioning.bitsBeforeThisCell;
        }

        if(j === cellBytes.length) {
          // For the last byte, if we aren't byte-aligned at the end then we don't raise the last few bits.
          raisedByte << cellPositioning.bitsAfterThisCell;
        }

        cellBytes[j] |= raisedByte;
      }


      // Array buffer slices are copies, so let's make the modifications to the underlying byte buffer
      bufferViewAsUint8.set(cellBytes, cellPositioning.cellSliceBeginIdx);
    }

    // After every add we set k bits, so we then purge this.p bits. 
    // Choose this.p random bits and decrement them (stopping at zero)
    for(var i = 0; i < this.p; i++) {

      var bitIdx = Math.random() * this.m * this.d;
      var bufferViewIdx = Math.floor(bitIdx/8);

      // Return a bit string 11111011 where the ith bit is zero
      var loweredOneBit = 255 ^ (1 << (bitIdx % 8));

      bufferViewAsUint8[bufferViewIdx] &= loweredOneBit;
    }
  };

  /**
   * v: string
   */
  StableBloomFilter.prototype.test = function(v) {
    var cellIndices = this._selectCells(v);
    
    for(var i = 0; i < this.k; i++) {

      // Adding an element raises all of the bits in the cell. 

      var cellPositioning = this._slice(cellIndices[i]);
      var cellBytes = new Uint8Array(cellPositioning.cellBytes);

      for(var j = 0; j < cellBytes.length; j++) {
        var cellByte = cellBytes[j];

        if(j === 0) {
          // For the first byte, if we aren't byte-aligned at the beginning then we don't look at the first few bits
          cellByte >> cellPositioning.bitsBeforeThisCell;
        }

        if(j === cellBytes.length) {
          // For the last byte, if we aren't byte-aligned at the end then we don't look at the last few bits.
          cellByte << cellPositioning.bitsAfterThisCell;
        }
         
        if(cellBytes[j] === 0) {
          return false;
        }
      }
    }

    return true;
  };

  /**
   * Given k hash functions, return a list of length k of indices into the cell buffer
   * i.e. if there were two hash functions and they selected the first and third cells respectively
   * this would return [0, 2].
   */
  StableBloomFilter.prototype._selectCells = function(v) {
    var constant = Math.abs(fnv_1a(v)),
        coefficient = Math.abs(fnv_1a_b(constant));

    /**
     * Two hashes can be combined (linearly) together to form arbitrarily many
     * hash functions, and still satisfy the bloom filter's requirements on uniformity.
     */

    var offsets = []; 

    for(var i = 0; i < this.k; i++) {
      offsets.push((constant + (coefficient * i)) % this.m);
    }

    return offsets;
  };

  /**
   * Save the bloom filter and the parameters. Returns a string.
   */
  StableBloomFilter.prototype.serialize = function() {
    var bufferString = "";

    var arrayView = new Uint8Array(this.buffer);

    for(var i = 0; i < arrayView.length; i++) {
      bufferString += String.fromCharCode(arrayView[i]);
    }

    return JSON.stringify({
      m: this.m,
      k: this.k,
      d: this.d,
      p: this.p,
      buffer: bufferString
    });
  };

  StableBloomFilter.prototype.unserialize = function(dataSerialized) {
    var data = JSON.parse(dataSerialized);

    var dataString = data.buffer;

    var m = data.m,
        k = data.k,
        d = data.d,
        p = data.p;

    var filter = new StableBloomFilter(m, k, d, {p: p});

    var buffer = new ArrayBuffer(dataString.length);
    var arrayView = new Uint8Array(filter.buffer);

    for(var i = 0; i < dataString.length; i++) {
      arrayView[i] = dataString.charCodeAt(i);
    }

    return filter;
  };

})(typeof exports !== "undefined" ? exports : this);
