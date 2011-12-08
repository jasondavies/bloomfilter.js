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
      assert.equal(fnv_1a("ch"), 0x5f299f4e & 0xffffffff);
      assert.equal(fnv_1a("cho"), 0xef8580f3 & 0xffffffff);
      assert.equal(fnv_1a("chon"), 0xac297727 & 0xffffffff);
      assert.equal(fnv_1a("chong"), 0x4546b9c0 & 0xffffffff);
      assert.equal(fnv_1a("chongo"), 0xbd564e7d & 0xffffffff);
      assert.equal(fnv_1a("chongo "), 0x6bdd5c67 & 0xffffffff);
      assert.equal(fnv_1a("chongo w"), 0xdd77ed30 & 0xffffffff);
      assert.equal(fnv_1a("chongo wa"), 0xf4ca9683 & 0xffffffff);
      assert.equal(fnv_1a("chongo was"), 0x4aeb9bd0 & 0xffffffff);
      assert.equal(fnv_1a("chongo was "), 0xe0e67ad0 & 0xffffffff);
      assert.equal(fnv_1a("chongo was h"), 0xc2d32fa8 & 0xffffffff);
      assert.equal(fnv_1a("chongo was he"), 0x7f743fb7 & 0xffffffff);
      assert.equal(fnv_1a("chongo was her"), 0x6900631f & 0xffffffff);
      assert.equal(fnv_1a("chongo was here"), 0xc59c990e & 0xffffffff);
      assert.equal(fnv_1a("chongo was here!"), 0x448524fd & 0xffffffff);
      assert.equal(fnv_1a("chongo was here!\n"), 0xd49930d5 & 0xffffffff);
      assert.equal(fnv_1a(repeat(500, "\x00")), 0xfa823dd5 & 0xffffffff);
      assert.equal(fnv_1a(repeat(500, "\x07")), 0x21a27271 & 0xffffffff);
      assert.equal(fnv_1a(repeat(500, "~")),    0x83c5c6d5 & 0xffffffff);
      assert.equal(fnv_1a(repeat(500, "\x7f")), 0x813b0881 & 0xffffffff);
    }
  }
});

suite.export(module);

function repeat(n, d) {
  var r = [],
      i = -1;
  while (++i < n) r[i] = d;
  return r.join("");
}
