Stable Bloom Filter
===================

This is an implementation of the stable bloom filter as described in [Deng and Rafiei (2006)](http://webdocs.cs.ualberta.ca/~drafiei/papers/DupDet06Sigmod.pdf). A stable bloom filter maintains a constant fraction of high bits by unsetting random bits after each insertion. This is useful for potentially infinite data sets, where a normal bloom filter would progressively "fill up". 

![http://i.imgur.com/JFkABNJ.png](http://i.imgur.com/JFkABNJ.png)

In the graph above, `P` represents the number of random cells purged after each iteration. When `P=0`, it's equivalent to a normal bloom filter. After a while, all of the bits are raised, making the bloom filter useless. With `P>0`, some elements are purged after each insertion. 

Usage
-----

    var bloom = new StableBloomFilter(
      32 * 1024,  // number of cells to allocate.
      4,          // number of hash functions.
      8,          // number of bits per cell
      {fps: 0.01} // false positive rate (in this case, 1%)
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

    // Serialization. 
    localStorage["bloom"] = bloom.serialize();

    // Unserialization. 
    var bloom = StableBloomFilter.prototype.unserialize(localStorage["bloom"]);
