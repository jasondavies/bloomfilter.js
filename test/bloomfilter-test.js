var bf = require("../bloomfilter"),
    BloomFilter = bf.BloomFilter,
    StableBloomFilter = bf.StableBloomFilter,
    fnv_1a = bf.fnv_1a,
    fnv_1a_b = bf.fnv_1a_b;

var vows = require("vows"),
    assert = require("assert");

var suite = vows.describe("bloomfilter");

var jabberwocky = "`Twas brillig, and the slithy toves\n  Did gyre and gimble in the wabe:\nAll mimsy were the borogoves,\n  And the mome raths outgrabe.\n\n\"Beware the Jabberwock, my son!\n  The jaws that bite, the claws that catch!\nBeware the Jubjub bird, and shun\n  The frumious Bandersnatch!\"\n\nHe took his vorpal sword in hand:\n  Long time the manxome foe he sought --\nSo rested he by the Tumtum tree,\n  And stood awhile in thought.\n\nAnd, as in uffish thought he stood,\n  The Jabberwock, with eyes of flame,\nCame whiffling through the tulgey wood,\n  And burbled as it came!\n\nOne, two! One, two! And through and through\n  The vorpal blade went snicker-snack!\nHe left it dead, and with its head\n  He went galumphing back.\n\n\"And, has thou slain the Jabberwock?\n  Come to my arms, my beamish boy!\nO frabjous day! Callooh! Callay!'\n  He chortled in his joy.\n\n`Twas brillig, and the slithy toves\n  Did gyre and gimble in the wabe;\nAll mimsy were the borogoves,\n  And the mome raths outgrabe.";

suite.addBatch({
  "bloom filter": {
    "basic": function() {
      var f = new BloomFilter(1000, 4),
          n1 = "Bess",
          n2 = "Jane";
      f.add(n1);
      assert.equal(f.test(n1), true);
      assert.equal(f.test(n2), false);
    },
    "jabberwocky": function() {
      var f = new BloomFilter(1000, 4),
          n1 = jabberwocky,
          n2 = jabberwocky + "\n";
      f.add(n1);
      assert.equal(f.test(n1), true);
      assert.equal(f.test(n2), false);
    },
    "basic uint32": function() {
      var f = new BloomFilter(1000, 4),
          n1 = "\u0100",
          n2 = "\u0101",
          n3 = "\u0103";
      f.add(n1);
      assert.equal(f.test(n1), true);
      assert.equal(f.test(n2), false);
      assert.equal(f.test(n3), false);
    },
    "wtf": function() {
      var f = new BloomFilter(20, 10);
      f.add("abc");
      assert.equal(f.test("wtf"), false);
    },
    "works with integer types": function() {
      var f = new BloomFilter(1000, 4);
      f.add(1);
      assert.equal(f.test(1), true);
      assert.equal(f.test(2), false);
    },
    "size": function() {
      var f = new BloomFilter(1000, 4), i = -1;
      for (var i = 0; i < 100; ++i) f.add(i);
      assert.inDelta(f.size(), 99.953102, 1e-6);
      for (var i = 0; i < 1000; ++i) f.add(i);
      assert.inDelta(f.size(), 950.424571, 1e-6);
    }
  },
  "stable bloom filter": {
    "false positive calculation": function() {
      /**
       * if false positive rate FPS = 1, then P=0 (we don't need to reset /any/ bits if there is a false positive rate of 100%!)
       */
      var f;
      
      f = new StableBloomFilter(1024, 4, 4, {fps: 0.01});
      assert.equal(f.p, 157);

      f = new StableBloomFilter(1024, 4, 4, {fps: 0.02});
      assert.equal(f.p, 126);

      f = new StableBloomFilter(1024, 4, 4, {fps: 0.05});
      assert.equal(f.p, 93);

      f = new StableBloomFilter(1024, 4, 4, {fps: 0.001});
      assert.equal(f.p, 306);

      f = new StableBloomFilter(1024, 4, 4, {fps: 1});
      assert.equal(f.p, 0);

    },

    "basic": function() {
      var f = new StableBloomFilter(1024, 4, 8, {fps: 0.00001}),
          n1 = "Bess",
          n2 = "Jane";
      f.add(n1);

      assert.equal(f.test(n1), true);
      assert.equal(f.test(n2), false);
    },

    "counting number of bits set": function() {
      var f = new StableBloomFilter(1024, 4, 8, {fps: 0.00001});

      var buffer = f.buffer,
        bufferView = new Uint8Array(buffer);

      /* Manually set the first byte to 255, i.e. all ones, so the bit count should be 8 */

      assert.equal(f.hammingWeight(), 0);

      bufferView[0] = 255;

      assert.equal(f.hammingWeight(), 8);
    },

    "bit alignment": function() {
      var f = new StableBloomFilter(1024, 4, 3, {fps: 0.00001});

      /* Cell #933 when there are three bits per cell is an edge case
       *
       *              +------+------+------+------+------+------+------+------+------+------+------+------+
       * bit numbers  | 2798 | 2799 | 2800 | 2801 | 2802 | 2803 | 2804 | 2805 | 2806 | 2807 | 2808 | 2809 |
       *              +------+------+------+------+------+------+------+------+------+------+------+------+
       * byte numbers | 349         | 350                                                   | 351         |
       *              +------+------+------+------+------+------+------+------+------+------+------+------+
       * cell number  | 932  | 933                | 934                | 935                | 936         |
       *              +------+------+------+------+------+------+------+------+------+------+------+------+
       * 
       * This tests that the calculation for how many leading bits in the prior byte included when we slice on the byte line
       * i.e. bytes 349 and 350. For Cell #933, there are seven extra bits preceding and six bits following.
       */
      var cellPositioning = f._slice(933);
      assert.equal(cellPositioning.cellSliceBeginIdx, 349);
      assert.equal(cellPositioning.cellSliceEndIdx, 351);
      assert.equal(cellPositioning.bitsBeforeThisCell, 7);
      assert.equal(cellPositioning.bitsAfterThisCell, 6);

      cellPositioning = f._slice(0);
      assert.equal(cellPositioning.cellSliceBeginIdx, 0);
      assert.equal(cellPositioning.cellSliceEndIdx, 1);
      assert.equal(cellPositioning.bitsBeforeThisCell, 0);
      assert.equal(cellPositioning.bitsAfterThisCell, 5);

      cellPositioning = f._slice(1);
      assert.equal(cellPositioning.cellSliceBeginIdx, 0);
      assert.equal(cellPositioning.cellSliceEndIdx, 1);
      assert.equal(cellPositioning.bitsBeforeThisCell, 3);
      assert.equal(cellPositioning.bitsAfterThisCell, 2);

      cellPositioning = f._slice(2);
      assert.equal(cellPositioning.cellSliceBeginIdx, 0);
      assert.equal(cellPositioning.cellSliceEndIdx, 2);
      assert.equal(cellPositioning.bitsBeforeThisCell, 6);
      assert.equal(cellPositioning.bitsAfterThisCell, 7);

      cellPositioning = f._slice(8);
      assert.equal(cellPositioning.cellSliceBeginIdx, 3);
      assert.equal(cellPositioning.cellSliceEndIdx, 4);
      assert.equal(cellPositioning.bitsBeforeThisCell, 0);
      assert.equal(cellPositioning.bitsAfterThisCell, 5);

      var g = new StableBloomFilter(1024, 4, 8, {fps: 0.00001});
      cellPositioning = g._slice(0);
      assert.equal(cellPositioning.cellSliceBeginIdx, 0);
      assert.equal(cellPositioning.cellSliceEndIdx, 1);
      assert.equal(cellPositioning.bitsBeforeThisCell, 0);
      assert.equal(cellPositioning.bitsAfterThisCell, 0);

      cellPositioning = g._slice(1);
      assert.equal(cellPositioning.cellSliceBeginIdx, 1);
      assert.equal(cellPositioning.cellSliceEndIdx, 2);
      assert.equal(cellPositioning.bitsBeforeThisCell, 0);
      assert.equal(cellPositioning.bitsAfterThisCell, 0);

      cellPositioning = g._slice(8);
      assert.equal(cellPositioning.cellSliceBeginIdx, 8);
      assert.equal(cellPositioning.cellSliceEndIdx, 9);
      assert.equal(cellPositioning.bitsBeforeThisCell, 0);
      assert.equal(cellPositioning.bitsAfterThisCell, 0);

      var h = new StableBloomFilter(1024, 4, 4, {fps: 0.00001});
      cellPositioning = h._slice(0);
      assert.equal(cellPositioning.cellSliceBeginIdx, 0);
      assert.equal(cellPositioning.cellSliceEndIdx, 1);
      assert.equal(cellPositioning.bitsBeforeThisCell, 0);
      assert.equal(cellPositioning.bitsAfterThisCell, 4);

      cellPositioning = h._slice(1);
      assert.equal(cellPositioning.cellSliceBeginIdx, 0);
      assert.equal(cellPositioning.cellSliceEndIdx, 1);
      assert.equal(cellPositioning.bitsBeforeThisCell, 4);
      assert.equal(cellPositioning.bitsAfterThisCell, 0);

      cellPositioning = h._slice(2);
      assert.equal(cellPositioning.cellSliceBeginIdx, 1);
      assert.equal(cellPositioning.cellSliceEndIdx, 2);
      assert.equal(cellPositioning.bitsBeforeThisCell, 0);
      assert.equal(cellPositioning.bitsAfterThisCell, 4);

      cellPositioning = h._slice(3);
      assert.equal(cellPositioning.cellSliceBeginIdx, 1);
      assert.equal(cellPositioning.cellSliceEndIdx, 2);
      assert.equal(cellPositioning.bitsBeforeThisCell, 4);
      assert.equal(cellPositioning.bitsAfterThisCell, 0);
    },

    "purging": function() {
      var f = new StableBloomFilter(1024, 4, 8, {fps: 0}),
          n1 = "Bess",
          n2 = "Jane";

      f.add(n1);
      assert.equal(f.test(n1), true);
      assert.equal(f.test(n2), false);
    },

    "serializing": function() {
      var f = new StableBloomFilter(1024, 4, 8, {fps: 0.00001}),
          n1 = "Bess";
      f.add(n1);
      assert.equal(f.test(n1), true);

      var g = StableBloomFilter.prototype.unserialize(f.serialize());

      assert.equal(g.test(n1), true);
      assert.equal(g.m, 1024);
      assert.equal(g.d, 8);
      assert.equal(g.k, 4);
    }
  }
});

suite.export(module);
