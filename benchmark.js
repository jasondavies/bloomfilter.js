import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpus } from "node:os";
import { realpathSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { BloomFilter } from "./bloomfilter.js";

const minimumWarmups = 3;
const minimumWarmupMs = 100;
const minimumSampleMs = 5;
const rounds = 9;

export const scenarios = [
  { name: "small / short keys", n: 1_000, error: 0.01, length: 16 },
  { name: "large / short keys", n: 100_000, error: 1e-5, length: 16 },
  { name: "large / 128-byte keys", n: 100_000, error: 1e-5, length: 128 },
  { name: "10k / 4KiB keys", n: 10_000, error: 1e-5, length: 4096 },
];

export function runBenchmark(BloomFilter, scenario) {
  const { n, error, length } = scenario;
  // Flatten strings before measurement so construction/rope flattening is excluded.
  const key = (prefix, i) => Buffer.from(`${prefix}:${i.toString(16).padStart(8, "0")}:`.padEnd(length, "x")).toString();
  const values = Array.from({ length: n }, (_, i) => key("item", i));
  const misses = Array.from({ length: n }, (_, i) => key("miss", i));
  const make = () => BloomFilter.withTargetError(n, error);
  const filled = make();
  const right = make();
  for (let i = 0; i < n; ++i) {
    filled.add(values[i]);
    right.add(misses[i]);
  }
  const digest = filter => createHash("sha256").update(new Uint8Array(
    filter.buckets.buffer, filter.buckets.byteOffset, filter.buckets.byteLength,
  )).digest("hex");
  const expectedBits = filled.countBits();
  const expectedMisses = misses.reduce((sum, value) => sum + filled.test(value), 0);
  const expectedLocationSum = values.reduce((sum, value) => sum + filled.locations(value)[0], 0);
  const union = BloomFilter.union(filled, right);
  const intersection = BloomFilter.intersection(filled, right);
  const checks = {
    buckets: digest(filled), bits: expectedBits, misses: expectedMisses, locationSum: expectedLocationSum,
    union: digest(union), intersection: digest(intersection),
    locations: values.slice(0, 100).map(value => Array.from(filled.locations(value))),
  };
  assert.equal(values.reduce((sum, value) => sum + filled.test(value), 0), n);
  const repeats = Math.max(1, Math.ceil(Math.min(100_000, 4_000_000 / length) / n));
  const allocatingOps = n <= 1_000 ? 1_000 : 100;
  const scanOps = n <= 1_000 ? 20_000 : 200;
  const timings = {};
  let sink;

  function bench(name, operations, setup, run, verify) {
    // Collect several operations per sample so short operations are measurable.
    function sample() {
      let elapsed = 0;
      let batches = 0;
      do {
        const context = setup();
        const start = performance.now();
        const result = run(context);
        elapsed += performance.now() - start;
        verify(result, context);
        sink = result;
        ++batches;
      } while (elapsed < minimumSampleMs);
      return { elapsed, perOperation: elapsed * 1000 / (operations * batches) };
    }

    // Let optimisation settle after collection; do not force GC between samples.
    global.gc?.();
    let warmedMs = 0;
    let warmedBatches = 0;
    while (warmedBatches < minimumWarmups || warmedMs < minimumWarmupMs) {
      warmedMs += sample().elapsed;
      ++warmedBatches;
    }
    const samples = Array.from({ length: rounds }, () => sample().perOperation);
    samples.sort((a, b) => a - b);
    timings[name] = { median: samples[rounds >> 1], min: samples[0], max: samples.at(-1) };
  }

  bench("construct", allocatingOps, () => null, () => {
    let last;
    for (let i = 0; i < allocatingOps; ++i) last = make();
    return last;
  }, result => assert.equal(result.countBits(), 0));

  // Allocate outside timing and insert each key once per fresh filter.
  bench("add", n * repeats, () => Array.from({ length: repeats }, make), filters => {
    for (const filter of filters) for (const value of values) filter.add(value);
    return filters;
  }, filters => { for (const filter of filters) assert.equal(digest(filter), checks.buckets); });

  for (const [name, keys, expected] of [["test hit", values, n], ["test miss", misses, expectedMisses]]) {
    bench(name, n * repeats, () => null, () => {
      let count = 0;
      for (let j = 0; j < repeats; ++j) for (const value of keys) count += filled.test(value);
      return count;
    }, result => assert.equal(result, expected * repeats));
  }

  bench("locations", n * repeats, () => null, () => {
    let sum = 0;
    for (let j = 0; j < repeats; ++j) for (const value of values) sum += filled.locations(value)[0];
    return sum;
  }, result => assert.equal(result, expectedLocationSum * repeats));

  bench("countBits", scanOps, () => null, () => {
    let count = 0;
    for (let i = 0; i < scanOps; ++i) count += filled.countBits();
    return count;
  }, result => assert.equal(result, expectedBits * scanOps));

  for (const name of ["union", "intersection"]) {
    bench(name, allocatingOps, () => null, () => {
      let last;
      for (let i = 0; i < allocatingOps; ++i) last = BloomFilter[name](filled, right);
      return last;
    }, result => assert.equal(digest(result), checks[name]));
  }
  assert.notEqual(sink, undefined);
  const bytes = filled.buckets.byteLength + filled._locations.byteLength;
  return { m: filled.m, k: filled.k, bytes, checks, timings };
}

export function printEnvironment({ forceGc = Boolean(global.gc) } = {}) {
  console.log(`Node ${process.version}; ${process.platform}/${process.arch}; ${cpus()[0]?.model}`);
  console.log(`Warmup: at least ${minimumWarmups} batches and ${minimumWarmupMs} ms per operation`);
  console.log(`Measurement: ${rounds} samples of at least ${minimumSampleMs} ms; medians and ranges in µs/op`);
  console.log(`Initial GC: ${forceGc ? "before warmup" : "not forced"}; GC during timed operations is included`);
  console.log("ASCII keys, filled to target capacity; setup, verification and module startup excluded.");
}

if (process.argv[1] && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  printEnvironment();
  const scenario = scenarios[1];
  const result = runBenchmark(BloomFilter, scenario);
  console.log(`\n${scenario.name}: n=${scenario.n}, m=${result.m}, k=${result.k}`);
  console.log("Operation         Median µs   Range (µs/op)");
  for (const [name, timing] of Object.entries(result.timings)) {
    console.log(`${name.padEnd(15)} ${timing.median.toFixed(3).padStart(10)}   ${timing.min.toFixed(3)}–${timing.max.toFixed(3)}`);
  }
}
