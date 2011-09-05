var BloomFilter = require("../bloomfilter").BloomFilter;

var vows = require("vows"),
    assert = require("assert");

var suite = vows.describe("bloomfilter");

suite.addBatch({
  "bloom filter": {
    "basic": function(bf) {
      var f = new BloomFilter(1000, 4),
          n1 = "Bess",
          n2 = "Jane";
      f.add(n1);
      assert.equal(f.test(n1), true);
      assert.equal(f.test(n2), false);
    }
  }
});

suite.export(module);
