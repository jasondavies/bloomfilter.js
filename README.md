Bloom Filter
============

This JavaScript bloom filter implementation uses the non-cryptographic
[Fowler–Noll–Vo hash function][1] for speed.

Usage
-----

```javascript
const bloom = new BloomFilter(
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
const array = [].slice.call(bloom.buckets);
const json = JSON.stringify(array);

// Deserialisation. Note that the any array-like object is supported, but
// this will be used directly, so you may wish to use a typed array for
// performance.
const bloom = new BloomFilter(array, 16);

// Automatically pick {m, k} based on number of elements and target false
// positive error rate.
const bloom = BloomFilter.withTargetError(1_000_000, 1e-6);
```

Implementation
--------------

Although the bloom filter requires *k* hash functions, we can simulate this
using enhanced double hashing with a single 64-bit FNV-1a hash computation for
performance.  The 64-bit hash is split into two 32-bit halves to obtain the two
independent hash functions required for enhanced double hashing.

Thanks to Will Fitzgerald for his [help and inspiration][2] with the hashing
optimisation.

[1]: http://isthe.com/chongo/tech/comp/fnv/
[2]: http://willwhim.wordpress.com/2011/09/03/producing-n-hash-functions-by-hashing-only-once/
