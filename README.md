Bloom Filter
============

This JavaScript bloom filter implementation uses the non-cryptographic
[Fowler–Noll–Vo hash function][1] for speed.

Usage
-----

```javascript
import { BloomFilter } from 'bloomfilter';

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

// Serialisation.
const json = JSON.stringify(bloom);

// Deserialisation.
const loadedBloom = BloomFilter.fromJSON(json);

// Automatically pick {m, k} based on number of elements and target false
// positive error rate.
const autoBloom = BloomFilter.withTargetError(1_000_000, 1e-6);
```

Benchmark
---------

```sh
npm run benchmark
```

To compare the working-tree implementation with the original JavaScript
implementation at commit `3703d8a`, run this from a Git checkout:

```sh
npm run benchmark:compare
```

The comparison uses separate processes, warmups and repeated measurements for
four ASCII-key workloads, and verifies matching filter contents and query
results. Module startup and input generation are excluded from the timings.

Implementation
--------------

Although the bloom filter requires *k* hash functions, we can simulate this
using enhanced double hashing with a single 64-bit FNV-1a hash computation for
performance.  The 64-bit hash is split into two 32-bit halves to obtain the two
independent hash functions required for enhanced double hashing.

Insertion and membership testing generate each location as it is used, avoiding
an intermediate locations array and allowing unsuccessful lookups to stop early.
The location recurrence uses conditional subtraction in place of remainder
where possible. Hashing retains the original UTF-16 code-unit semantics and
version-1 serialisation format.

Thanks to Will Fitzgerald for his [help and inspiration][2] with the hashing
optimisation.

[1]: http://isthe.com/chongo/tech/comp/fnv/
[2]: http://willwhim.wordpress.com/2011/09/03/producing-n-hash-functions-by-hashing-only-once/
