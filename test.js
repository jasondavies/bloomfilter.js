var BloomFilter = require("./bloomfilter").BloomFilter;

var f = new BloomFilter(100, 16);
f.add("foo");

var puts = require("util").puts;

puts(f.test("foo"));
puts(f.test("foop"));
puts(f.test("bar"));
