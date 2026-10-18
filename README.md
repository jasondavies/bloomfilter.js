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

API reference
-------------

### `new BloomFilter(m, k)`

Creates an empty filter. `m` is a positive finite number of bits, at most
4,294,967,296 (2³²), rounded up to a multiple of 32. `k` is an integer from 1 to
2,048 specifying the number of hash locations per value. Invalid parameters throw
`RangeError`. The limit on `k` bounds the working locations buffer to at most
8 KiB and limits the number of bit operations per inserted value.

### `new BloomFilter(buckets, k)`

Creates a filter by copying a non-empty array-like collection of unsigned 32-bit
integers. Arrays and `Uint32Array` instances are accepted. Each bucket stores 32
bits, so the resulting `m` is `buckets.length * 32`. There may be at most
134,217,728 buckets; each value must be an integer from 0 to 4,294,967,295.
`k` must be an integer from 1 to 2,048. Invalid parameters throw `RangeError`.

The filter owns its copy: later changes to the input buckets do not affect it.

### `BloomFilter.withTargetError(n, error)`

Returns an empty filter sized for `n` expected distinct values and a target
false-positive probability of `error`. `n` must be a finite number at least 1;
`error` must be finite and strictly between 0 and 1. The method chooses `m` and
`k` automatically, subject to the constructor's limits. Invalid parameters or a
computed size beyond those limits throw `RangeError`.

The target is an estimate, not a guarantee. Inserting more values than expected
increases the false-positive probability.

### Filter properties

| Property | Meaning |
| --- | --- |
| `m` | Allocated number of bits, after rounding. |
| `k` | Number of hash locations computed per value. |
| `buckets` | The live `Uint32Array` containing the filter's bits. |

Treat `m` and `k` as read-only configuration. Changes to `buckets` immediately
change the filter. Bit position `p` is stored in bucket `p >>> 5`, with mask
`1 << (p & 31)`. Clearing bits can introduce false negatives for inserted values.

### `filter.add(value)`

Inserts a value by setting its hash locations. Existing bits are preserved;
inserting the same value again has no additional effect. Returns `undefined`.

`add`, `test` and `locations` all coerce values using `value + ""` before hashing.
For example, `42` and `"42"` are the same value to the filter. Symbols throw
`TypeError`, and exceptions from an object's conversion are propagated.

### `filter.test(value)`

Returns `false` if any required bit is missing, or `true` if all are set. For a
filter populated with `add` or complete, compatible sparse updates, `false`
means the value is definitely absent; `true` means it may be present because
false positives are possible. Does not change the filter.

### `filter.locations(value)`

Returns the `k` hash positions for a value as a `Uint8Array`, `Uint16Array` or
`Uint32Array`, depending on the filter's size. Positions are in `[0, m)` and may
include duplicates. This method **does not insert the value or set any bits**.

The returned array is reused by the next call to `locations` on the same filter.
Copy it with `Array.from(filter.locations(value))` if you need to retain the
positions. `add` and `test` do not overwrite this array.

### `filter.addLocations(locations)`

Sets the supplied bit positions, preserves existing bits and returns `this` for
chaining. Accepts an iterable of numeric integers, including arrays, typed arrays,
sets and generators. Every position must be at least zero and less than `m`.

A batch may contain positions for multiple values, and its length need not equal
`k`. Duplicates are harmless; an empty iterable changes nothing. Positions are
copied and validated before any bits are changed, so invalid input or an
exception while reading it leaves the buckets unchanged.

Invalid positions, including non-number entries, throw `RangeError`. Strings
and non-iterable collections throw `TypeError`. A JSON string must first be
parsed into an array.

### `BloomFilter.fromLocations(m, k, locations)`

Returns a new filter with the supplied positions set and all other bits clear.
`m` and `k` have the same requirements as the numeric constructor. Positions
have the same requirements as `addLocations` and are validated before allocating
the filter. Bounds use the rounded size: `m = 33` allocates 64 bits and accepts
positions 0 through 63.

### `filter.countBits()`

Returns the exact number of set bits, from 0 to `m`. This is not the number of
inserted values: their hash locations may overlap.

### `filter.size()`

Returns an estimate of the number of distinct inserted values, based on the
number of set bits. The result may be fractional and is `Infinity` when every
bit is set. It is not an insertion counter; arbitrary manually set bits may not
represent valid inserted values.

### `filter.error()`

Returns an estimated current false-positive probability, calculated as
`(filter.countBits() / filter.m) ** filter.k`. The result is 0 for an empty
filter and 1 for a filter with every bit set. As with `size`, this is an estimate
based on occupancy and the hashing assumptions, not a measured error rate.

`countBits`, `size` and `error` each scan the full bucket array.

### `filter.toJSON()`

Returns a plain object containing `{ version: 1, m, k, buckets }`. `buckets` is a
new array of unsigned 32-bit integers, independent of the live filter. This
method is called automatically by `JSON.stringify(filter)`; it does not itself
return a JSON string.

### `BloomFilter.fromJSON(value)`

Returns a new filter restored from a JSON string or an object. `k` and `buckets`
are required and follow the constructor's validation rules. `version` may be
omitted or must equal `1`; `m` may be omitted or must equal `buckets.length * 32`.
The bucket data is copied.

Invalid filter data or an unsupported version throws `RangeError`. Malformed
JSON text throws `SyntaxError` from `JSON.parse`.

### `BloomFilter.union(a, b)`

Returns a new filter whose buckets are the bitwise OR of `a` and `b`. It
recognises values inserted into either input, with possible false positives.
Combining filters increases occupancy and may increase the false-positive rate.

Both inputs must have matching `m`, `k` and bucket lengths, otherwise the method
throws `Error`. They must also use the same hashing scheme. Neither input is
modified, and the result has independent storage.

### `BloomFilter.intersection(a, b)`

Returns a new filter whose buckets are the bitwise AND of `a` and `b`. It has
the same compatibility requirements and ownership behaviour as `union`.

Values inserted into both inputs remain recognisable, but the result is only a
probabilistic approximation of set intersection: it can report a value present
even if that value was not inserted into both inputs.

Sparse updates between processes
--------------------------------

For small incremental changes, transmit the positions to set instead of the
entire bitmap. Copy each call's positions before computing the next value's
locations, then serialise the combined batch:

```javascript
const source = new BloomFilter(1024, 4);
const target = new BloomFilter(source.m, source.k);
const positions = [];

for (const value of ["foo", "bar"]) {
  source.add(value);
  positions.push(...source.locations(value));
}

const message = JSON.stringify(positions);
// In the receiving process, using an existing compatible filter:
target.addLocations(JSON.parse(message));
target.test("foo"); // true
target.test("bar"); // true
```

The sender and receiver must use the same `m`, `k` and hashing scheme; raw
positions do not carry that metadata, so compatibility cannot be checked by
`addLocations`. Repeated batches and out-of-order delivery are harmless because
updates only set bits. Missing updates can cause false negatives at the receiver;
the application is responsible for delivery or resynchronisation.

Benchmark
---------

Run the benchmark commands from a Git checkout of this repository. The benchmark
scripts are development tools and are not included in the npm package.

```sh
npm run benchmark
```

To compare the working-tree implementation with the original JavaScript
implementation at commit `3703d8a`, run:

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
