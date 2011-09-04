Bloom Filter
============

This JavaScript bloom filter implementation uses the non-cryptographic
[Fowler–Noll–Vo hash function][1] for speed.

Although the bloom filter requires *n* hash functions, we can simulate this
using only *two* hash functions.  In fact, we cheat and get the second hash
function almost for free by iterating once more on the first hash using the FNV
hash algorithm.

Thanks to Will Fitzgerald for his [help and inspiration][2] with the hashing
optimisation.

[1]: http://isthe.com/chongo/tech/comp/fnv/
[2]: http://willwhim.wordpress.com/2011/09/03/producing-n-hash-functions-by-hashing-only-once/
