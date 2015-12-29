Bloom Filter
============

This JavaScript bloom filter implementation uses the non-cryptographic
[Fowler–Noll–Vo hash function][1] for speed.

Usage
-----

    var bloom = new BloomFilter(
      32 * 256, // number of bits to allocate.
      16        // number of hash functions.
    );

    // Add some elements to the filter.
    bloom.add("foo");
    bloom.add("bar");

    // Test if an item is in our filter.
    // Returns true if an item is probably in the set,
    // or false if an item is definitely not in the set.
    bloom.test("foo");
    bloom.test("bar");
    bloom.test("blah");

    // Serialisation into a Buffer.
    var blob = bloom.serialize();

    // Deserialisation from the buffer, returns a new BloomFilter.
    var bloom = BloomFilter.deserialize(blob);

Implementation
--------------

Although the bloom filter requires *k* hash functions, we can simulate this
using only *two* hash functions.  In fact, we cheat and get the second hash
function almost for free by iterating once more on the first hash using the FNV
hash algorithm.

Thanks to Will Fitzgerald for his [help and inspiration][2] with the hashing
optimisation.

[1]: http://isthe.com/chongo/tech/comp/fnv/
[2]: http://willwhim.wordpress.com/2011/09/03/producing-n-hash-functions-by-hashing-only-once/
