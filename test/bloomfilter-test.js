import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BloomFilter } from '../bloomfilter.js';

const jabberwocky = "`Twas brillig, and the slithy toves\n  Did gyre and gimble in the wabe:\nAll mimsy were the borogoves,\n  And the mome raths outgrabe.\n\n\"Beware the Jabberwock, my son!\n  The jaws that bite, the claws that catch!\nBeware the Jubjub bird, and shun\n  The frumious Bandersnatch!\"\n\nHe took his vorpal sword in hand:\n  Long time the manxome foe he sought --\nSo rested he by the Tumtum tree,\n  And stood awhile in thought.\n\nAnd, as in uffish thought he stood,\n  The Jabberwock, with eyes of flame,\nCame whiffling through the tulgey wood,\n  And burbled as it came!\n\nOne, two! One, two! And through and through\n  The vorpal blade went snicker-snack!\nHe left it dead, and with its head\n  He went galumphing back.\n\n\"And, has thou slain the Jabberwock?\n  Come to my arms, my beamish boy!\nO frabjous day! Callooh! Callay!'\n  He chortled in his joy.\n\n`Twas brillig, and the slithy toves\n  Did gyre and gimble in the wabe;\nAll mimsy were the borogoves,\n  And the mome raths outgrabe.";

describe('bloom filter', () => {

  it('basic', () => {
    const f = new BloomFilter(1000, 4);
    const n1 = "Bess";
    const n2 = "Jane";
    f.add(n1);
    assert.equal(f.test(n1), true);
    assert.equal(f.test(n2), false);
  });

  it('jabberwocky', () => {
    const f = new BloomFilter(1000, 4);
    const n1 = jabberwocky;
    const n2 = jabberwocky + "\n";
    f.add(n1);
    assert.equal(f.test(n1), true);
    assert.equal(f.test(n2), false);
  });

  it('basic uint32', () => {
    const f = new BloomFilter(1000, 4);
    const n1 = "\u0100";
    const n2 = "\u0101";
    const n3 = "\u0103";
    f.add(n1);
    assert.equal(f.test(n1), true);
    assert.equal(f.test(n2), false);
    assert.equal(f.test(n3), false);
  });

  it('wtf', () => {
    const f = new BloomFilter(20, 10);
    f.add("abc");
    assert.equal(f.test("wtf"), false);
  });

  it('works with integer types', () => {
    const f = new BloomFilter(1000, 4);
    f.add(1);
    assert.equal(f.test(1), true);
    assert.equal(f.test(2), false);
  });

  it('serialises and deserialises with JSON', () => {
    const f = new BloomFilter(1000, 4);
    f.add("Bess");
    f.add("Jane");

    const json = JSON.stringify(f);
    const restored = BloomFilter.fromJSON(json);

    assert.notEqual(restored, f);
    assert.deepEqual(restored.toJSON(), JSON.parse(json));
    assert.equal(restored.test("Bess"), true);
    assert.equal(restored.test("Jane"), true);
    assert.equal(restored.test("Emily"), false);
  });

  it('rejects invalid serialised filters', () => {
    assert.throws(() => BloomFilter.fromJSON(null), /must be an object or JSON string/);
    assert.throws(() => BloomFilter.fromJSON({ version: 1, buckets: [1] }), /must include k/);
    assert.throws(() => BloomFilter.fromJSON({ version: 1, k: 1 }), /must include buckets/);
    assert.throws(() => BloomFilter.fromJSON({ version: 2, k: 1, buckets: [1] }), /Unsupported BloomFilter serialisation format version/);
    assert.throws(() => BloomFilter.fromJSON({ version: 1, m: 64, k: 1, buckets: [1] }), /inconsistent m and buckets/);
  });

  it('rejects invalid constructor inputs', () => {
    assert.throws(() => new BloomFilter(0, 1), /m must be a positive finite number of bits/);
    assert.throws(() => new BloomFilter(1000, 0), /k must be a positive integer/);
    assert.throws(() => new BloomFilter([], 1), /non-empty array-like/);
    assert.throws(() => new BloomFilter([1, -1], 1), /Bucket values must be unsigned 32-bit integers/);
  });

  it('rejects invalid target error inputs', () => {
    assert.throws(() => BloomFilter.withTargetError(0, 1e-5), /n must be a positive finite number/);
    assert.throws(() => BloomFilter.withTargetError(100, 1), /error must be a finite number between 0 and 1, exclusive/);
  });

  it('matches independent hash locations across bucket widths and large hash counts', () => {
    const values = ['', 'Bess', 'café', '\u0100', '😀', '\ud800', '\udfff', 'x'.repeat(50_000)];
    for (const m of [32, 96, 256, 288, 65536, 65568]) {
      for (const k of [1, 7, 33, 65]) {
        for (const value of values) {
          const f = new BloomFilter(m, k);
          const locations = referenceLocations(value, f.m, k);
          assert.deepEqual(Array.from(f.locations(value)), locations);
          const expected = new Uint32Array(f.buckets.length);
          for (const location of locations) expected[location >>> 5] |= 1 << (location & 31);
          f.add(value);
          assert.deepEqual(f.buckets, expected);
          assert.equal(f.test(value), true);
          for (const candidate of [value + '!', 'missing']) {
            const present = referenceLocations(candidate, f.m, k).every(location =>
              (expected[location >>> 5] & (1 << (location & 31))) !== 0);
            assert.equal(f.test(candidate), present);
          }
        }
      }
    }
  });

  it('reads version-1 filters containing Unicode strings', () => {
    // Saved by the original JavaScript implementation, before the loop changes.
    const f = BloomFilter.fromJSON({
      version: 1, m: 256, k: 4,
      buckets: [3072, 2304, 4608, 4096, 4259840, 134217728, 0, 8196]
    });
    for (const value of ['café', '😀', '\ud800']) assert.equal(f.test(value), true);
    const rebuilt = new BloomFilter(256, 4);
    for (const value of ['café', '😀', '\ud800']) rebuilt.add(value);
    assert.deepEqual(rebuilt.toJSON(), f.toJSON());
  });

  it('uses unsigned bucket indexes through the maximum bit size', () => {
    let sawHighBit = false;
    for (const m of [0x80000000, 0xffffffe0, 0x100000000]) {
      // Sparse buckets exercise actual hashing/indexing without a giant allocation.
      const f = { m, k: 17, buckets: Object.create(null) };
      const expected = Object.create(null);
      for (let i = 0; i < 10; ++i) {
        const value = `edge:${i}`;
        for (const location of referenceLocations(value, m, f.k)) {
          sawHighBit ||= location >= 0x80000000;
          expected[location >>> 5] |= 1 << (location & 31);
        }
        BloomFilter.prototype.add.call(f, value);
        assert.equal(BloomFilter.prototype.test.call(f, value), true);
      }
      assert.deepEqual(f.buckets, expected);
    }
    assert.equal(sawHighBit, true);
  });

  it('stops at the first missing bit', () => {
    let reads = 0;
    const f = {
      m: 1024, k: 17,
      buckets: new Proxy({}, { get() { ++reads; return 0; } })
    };
    assert.equal(BloomFilter.prototype.test.call(f, 'missing'), false);
    assert.equal(reads, 1);
  });

  it('retains bucket views when adding long strings', () => {
    const f = new BloomFilter(1000, 4);
    const buckets = f.buckets;
    f.add('short');
    f.add('x'.repeat(50_000));
    assert.equal(f.buckets, buckets);
    assert.equal(f.test('short'), true);
    assert.equal(f.test('x'.repeat(50_000)), true);
  });

  it('combines filters without signed bucket-length overflow', () => {
    // Force the sign bit in m without allocating a giant backing array.
    const f0 = new BloomFilter([0b01], 1);
    const f1 = new BloomFilter([0b10], 1);
    f0.m = 0x80000000;
    f1.m = 0x80000000;

    const union = BloomFilter.union(f0, f1);
    const intersection = BloomFilter.intersection(f0, f1);

    assert.equal(union.buckets[0], 0b11);
    assert.equal(intersection.buckets[0], 0b00);
  });

  for (const [operation, expected] of [
    ['union', [0xffffffff, 0xffffffff, 0b0111]],
    ['intersection', [0x80000000, 0x80000000, 0b0100]]
  ]) {
    it(`${operation} returns unsigned buckets independent of its inputs`, () => {
      const left = new BloomFilter([0xffffffff, 0x80000000, 0b0101], 7);
      const right = new BloomFilter([0x80000000, 0xffffffff, 0b0110], 7);
      const beforeLeft = left.toJSON();
      const beforeRight = right.toJSON();
      const result = BloomFilter[operation](left, right);

      assert.deepEqual(result.toJSON(), { version: 1, m: 96, k: 7, buckets: expected });
      assert.notEqual(result.buckets.buffer, left.buckets.buffer);
      assert.notEqual(result.buckets.buffer, right.buckets.buffer);
      result.buckets.fill(0);
      assert.deepEqual(left.toJSON(), beforeLeft);
      assert.deepEqual(right.toJSON(), beforeRight);
      left.buckets.fill(0xffffffff);
      right.buckets.fill(0xffffffff);
      assert.deepEqual(Array.from(result.buckets), [0, 0, 0]);
    });
  }

  it('size', () => {
    const f = new BloomFilter(1024 * 1024, 4);
    for (let i = 0; i < 100; ++i) f.add(i);
    // Vows: assert.inDelta(f.size(), 100, 6);
    assert.ok(Math.abs(f.size() - 100) <= 6, 'Size within delta of 6');
    
    for (let i = 0; i < 1000; ++i) f.add(i);
    // Vows: assert.inDelta(f.size(), 1000, 100);
    assert.ok(Math.abs(f.size() - 1000) <= 100, 'Size within delta of 100');
  });

  it('countBits', () => {
    const f = new BloomFilter(1024, 4);
    f.add(0);
    assert.equal(f.countBits(), 4);
  });

  it('withTargetError/error', () => {
    const f = BloomFilter.withTargetError(100, 1e-5);
    for (let i = 0; i < 100; ++i) {
      f.add(i);
    }
    // Vows: assert.inDelta(f.error(), 1e-5, 1e-5);
    assert.ok(Math.abs(f.error() - 1e-5) <= 1e-5, 'Error within delta');
  });

  it('union', () => {
    const f0 = BloomFilter.withTargetError(100, 1e-5);
    const f1 = BloomFilter.withTargetError(100, 1e-5);
    for (let i = 0; i < 100; ++i) {
      f0.add(i);
    }
    for (let i = 0; i < 100; ++i) {
      f1.add(100 + i);
    }
    const f2 = BloomFilter.union(f0, f1);
    for (let i = 0; i < 200; ++i) {
      assert.equal(f2.test(i), true);
    }
  });

  it('intersection', () => {
    const f0 = BloomFilter.withTargetError(100, 1e-5);
    const f1 = BloomFilter.withTargetError(100, 1e-5);
    for (let i = 0; i < 200; ++i) {
      if (i < 100) {
        f0.add(i);
      }
      if (i === 100) {
        f0.add(i);
        f1.add(i);
      }
      if (i > 100) {
        f1.add(i);
      }
    }
    const f2 = BloomFilter.intersection(f0, f1);
    for (let i = 0; i < 200; ++i) {
      assert.equal(f2.test(i), i === 100);
    }
  });
});

// Independent reference: BigInt arithmetic and the closed-form location formula,
// rather than the implementation's split-word hash and recurrence.
function referenceLocations(value, m, k) {
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < value.length; ++i) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(value.charCodeAt(i))) * 0x100000001b3n);
  }
  const a = BigInt.asIntN(32, hash >> 32n);
  const b = BigInt.asIntN(32, hash);
  const modulus = BigInt(m);
  return Array.from({ length: k }, (_, index) => {
    const i = BigInt(index);
    const location = (a + i * b + (i * i * i - i) / 6n) % modulus;
    return Number((location + modulus) % modulus);
  });
}
