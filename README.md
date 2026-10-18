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

Sparse bit positions
--------------------

Use `addLocations(locations)` to set bit positions on an existing filter. It
preserves existing bits and returns the filter for chaining.
`BloomFilter.fromLocations(m, k, locations)` creates a filter with those bits set.

```javascript
const source = new BloomFilter(1024, 4);
const positions = Array.from(source.locations("foo"));
const target = BloomFilter.fromLocations(source.m, source.k, positions);
target.addLocations(source.locations("bar"));
target.test("foo"); // true
target.test("bar"); // true
```

Both methods accept an iterable of numeric integer positions, including arrays,
typed arrays and sets. Positions must be at least zero and less than the filter's
allocated `m`. As with the constructor, `fromLocations` rounds the requested bit
count up to a multiple of 32. Duplicates are harmless; an empty iterable sets no
bits. Invalid positions throw `RangeError`; strings and non-iterable inputs throw
`TypeError`. Input is collected and validated before any bits are changed, and
`fromLocations` validates it before allocating the filter.

When transferring hash locations between filters, use the same `m`, `k` and
hashing scheme. `locations(value)` coerces values to strings in the same way as
`add` and `test`. It returns a reusable typed array that is overwritten by the
next call to `locations`; copy it with `Array.from` if you need to retain the
positions.

Benchmark
---------

```sh
npm run benchmark
```

To compare the working-tree implementation with the original JavaScript
implementation at commit `3703d8a`, run this from a Git checkout:

```sh
npm run benchmark:compare
npm run benchmark:compare -- --reverse
```

Both commands use the same runner and fill filters to their expected capacity.
The comparison runs four ASCII-key workloads in separate processes and verifies
matching filter contents and query results; `--reverse` reverses execution order.

Each operation warms up for at least 100 ms and three batches, followed by nine
measurement samples of at least 5 ms each. Results show medians and ranges in
microseconds per operation. Setup, input generation, module startup, and result
verification are excluded. Garbage collection may occur during timed operations;
it is forced only before warmup. These are local microbenchmarks, so small
performance differences should be treated cautiously.

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
