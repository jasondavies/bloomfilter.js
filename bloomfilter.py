from __future__ import division
import math

def _popcnt(v):
    v -= (v >> 1) & 0x55555555
    v = (v & 0x33333333) + ((v >> 2) & 0x33333333)
    return ((v + (v >> 4) & 0xF0F0F0F) * 0x1010101) >> 24

def _fnv_1a(v):
    a = 2166136261
    for c in v:
        c = ord(c)
        d = c & 0xff000000
        if d: a = ((a ^ (d>>24)) * 16777619) & 0xffffffff
        d = c & 0xff0000
        if d: a = ((a ^ (d>>16)) * 16777619) & 0xffffffff
        d = c & 0xff00
        if d: a = ((a ^ (d>>8)) * 16777619) & 0xffffffff
        a = ((a ^ (c&0xff)) * 16777619) & 0xffffffff
    # Modified FNV with good avalanche behavior and uniform distribution
    # https://web.archive.org/web/20131019013225/http://home.comcast.net/~bretm/hash/6.html
    a += a << 13
    a &= 0xffffffff
    a ^= a >> 7
    a += a << 3
    a &= 0xffffffff
    a ^= a >> 17
    a += a << 5
    return a & 0xffffffff

def _fnv_1a_b(a):
    a = (a * 16777619) & 0xffffffff
    a += a << 13
    a &= 0xffffffff
    a ^= a >> 7
    a += a << 3
    a &= 0xffffffff
    a ^= a >> 17
    a += a << 5
    return a & 0xffffffff

class BloomSet(object):
    def __init__(self, m, k):
        a = None
        if type(m) not in (int,long):
            a = m
            m = len(a)*8
        n = (m+7) // 8

        self.m = m = n*8
        self.k = k
        self.buckets = bytearray(a or n)

    @classmethod
    def best_for(cls, n, p):
        """Create a Bloom filter optimized for `n` items to be saves with
        `p` probability of false positives."""
        m = math.ceil((n * math.log(p)) / math.log(1 / math.pow(2, math.log(2))))
        k = round(math.log(2) * m / n)
        return cls(int(m),int(k))

    def _locations(self, v):
        a = _fnv_1a(v)
        b = _fnv_1a_b(a)
        m = self.m

        x = a % m
        for _ in range(self.k):
            yield (x+m if x<0 else x)
            x = (x + b) % m

    def add(self, v):
        buckets = self.buckets
        for l in self._locations(v):
            buckets[l // 8] |= 1 << (l % 8)

    def __contains__(self, v):
        buckets = self.buckets
        for l in self._locations(v):
            if not buckets[l // 8] & (1 << (l % 8)):
                return False
        return True

    def __len__(self):
        bits = 0
        for b in self.buckets:
            bits += _popcnt(b)
        return -self.m * math.log(1 - bits / self.m) / self.k

    def __repr__(self):
        return "BloomSet(%r,%d)" % (self.buckets, self.k)

    def to_uint32(self):
        """Return a uint32-based representation compatible with bloomfilter.js"""
        l = []
        buckets = self.buckets
        n = self.m // 8
        for i in range(n//4):
            l.append(buckets[i*4] + (buckets[i*4+1]<<8) + (buckets[i*4+2]<<16) + (buckets[i*4+3]<<24))
        v = 0
        j = 0
        i += 1
        while i*4+j < n:
            v += buckets[i*4+j] << (j*8)
            j += 1
        l.append(v)
        return l

def _test():
    import string
    import random

    N = 10000
    P = 1e-4

    def genstring(_chars=string.letters+string.digits):
        return "".join(random.choice(_chars) for _ in range(16))

    truth = set()
    b = BloomSet.best_for(N, P)

    for i in range(N):
        u = genstring()
        truth.add(u)
        b.add(u)

    for u in truth:
        assert u in b

    errcnt = 0
    for i in range(N*10):
        while 1:
            u = genstring()
            if u not in truth: break
        if u in b:
            errcnt += 1

    print "Bloom filter for %d items with probability %s" % (N,P)
    print "Memory size: %dkB" % (len(b.buckets) // 1024)
    print "Estimated length:", len(b)
    print "Errors: %s in %s (%f)" % (errcnt, N*10, errcnt/(N*10))

if __name__ == "__main__":
    _test()
