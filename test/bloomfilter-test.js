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
          n1 = "\u100",
          n2 = "\u101",
          n3 = "\u103";
      f.add(n1);
      assert.equal(f.test(n1), true);
      assert.equal(f.test(n2), false);
      assert.equal(f.test(n3), false);
    }
  },
  "fnv": {
    "basic": function() {
      // Test vectors from http://isthe.com/chongo/tech/comp/fnv/
      assert.equal(fnv_1a(""),  0x811c9dc5 & 0xffffffff);
      assert.equal(fnv_1a("a"), 0xe40c292c & 0xffffffff);
      assert.equal(fnv_1a("b"), 0xe70c2de5 & 0xffffffff);
      assert.equal(fnv_1a("c"), 0xe60c2c52 & 0xffffffff);
      assert.equal(fnv_1a("d"), 0xe10c2473 & 0xffffffff);
      assert.equal(fnv_1a("e"), 0xe00c22e0 & 0xffffffff);
      assert.equal(fnv_1a("f"), 0xe30c2799 & 0xffffffff);
      assert.equal(fnv_1a("fo"), 0x6222e842 & 0xffffffff);
      assert.equal(fnv_1a("foo"), 0xa9f37ed7 & 0xffffffff);
      assert.equal(fnv_1a("foob"), 0x3f5076ef & 0xffffffff);
      assert.equal(fnv_1a("fooba"), 0x39aaa18a & 0xffffffff);
      assert.equal(fnv_1a("foobar"), 0xbf9cf968 & 0xffffffff);
    }
  }
});

suite.export(module);
