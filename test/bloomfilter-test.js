var bf = require("../bloomfilter"),
    BloomFilter = bf.BloomFilter,
    fnv_1a = bf.fnv_1a;

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
      assert.inDelta(f.size(), 100, 6);
      for (var i = 0; i < 1000; ++i) f.add(i);
      assert.inDelta(f.size(), 1000, 100);
    },
    "rate": function() {
      var f = new BloomFilter(4096, 3), i = 0;
      var init = 123456;
      assert.equal(f.rate(), 0);
      for (; i < 32; ++i) f.add(init+i);
      assert.inDelta(f.rate(), 0.00002, 0.00001);
      for (; i < 64; ++i) f.add(init+i);
      assert.inDelta(f.rate(), 0.0001, 0.00009);
      for (; i < 128; ++i) f.add(init+i);
      assert.inDelta(f.rate(), 0.0008, 0.0007);
      for (; i < 256; ++i) f.add(init+i);
      assert.inDelta(f.rate(), 0.006, 0.005);
      for (; i < 512; ++i) f.add(init+i);
      assert.inDelta(f.rate(), 0.032, 0.031);
      for (; i < 1024; ++i) f.add(init+i);
      assert.inDelta(f.rate(), 0.15, 0.14);
      for (; i < 2048; ++i) f.add(init+i);
      assert.inDelta(f.rate(), 0.47, 0.46);
      for (; i < 4096; ++i) f.add(init+i);
      assert.inDelta(f.rate(), 0.86, 0.85);
      for (; i < 4096*2; ++i) f.add(init+i);
      assert.inDelta(f.rate(), 1, 0.99);
    },
  }
});

suite.export(module);
