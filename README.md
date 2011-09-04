Bloom Filter
============

This JavaScript bloom filter implementation uses the non-cryptographic
[Fowler–Noll–Vo hash function][1] for speed.  In fact, the hash function only
needs to be called once per operation, as *n* hash functions can be simulated
using only two hash functions.  And two 32-bit hash functions can be simulated
[using a single 64-bit hash function][2]!

[1]: http://isthe.com/chongo/tech/comp/fnv/
[2]: http://willwhim.wordpress.com/2011/09/03/producing-n-hash-functions-by-hashing-only-once/
