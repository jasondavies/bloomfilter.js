Bloom Filter
============

This JavaScript bloom filter implementation uses the non-cryptographic
[Fowler–Noll–Vo hash function][1] for speed.

Usage
-----

```javascript
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

// Serialisation. Note that bloom.buckets may be a typed array,
// so we convert to a normal array first.
var array = [].slice.call(bloom.buckets),
    json = JSON.stringify(array);

// Deserialisation. Note that the any array-like object is supported, but
// this will be used directly, so you may wish to use a typed array for
// performance.
var bloom = new BloomFilter(array, 16);
```

Implementation
--------------

Although the bloom filter requires *k* hash functions, we can simulate this
using double hashing with a single 64-bit FNV-1a hash computation for
performance.  The 64-bit hash is split into two 32-bit halves to obtain the two
independent hash functions required for double hashing.

Thanks to Will Fitzgerald for his [help and inspiration][2] with the hashing
optimisation.

[1]: http://isthe.com/chongo/tech/comp/fnv/
[2]: http://willwhim.wordpress.com/2011/09/03/producing-n-hash-functions-by-hashing-only-once/
