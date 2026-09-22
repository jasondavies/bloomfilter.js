import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpus } from "node:os";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

// Pin the JavaScript baseline so future commits do not change the comparison.
const baseline = "3703d8a40c9e3f3ad5a3ee3071888a793b69471b";
const root = fileURLToPath(new URL(".", import.meta.url));
const warmups = 3;
const rounds = 9;
const scenarios = [
  { name: "small / short keys", n: 1_000, error: 0.01, length: 16 },
  { name: "large / short keys", n: 100_000, error: 1e-5, length: 16 },
  { name: "large / 128-byte keys", n: 100_000, error: 1e-5, length: 128 },
  { name: "10k / 4KiB keys", n: 10_000, error: 1e-5, length: 4096 },
];

if (process.argv[2] === "--worker") {
  await worker(process.argv[3], scenarios[Number(process.argv[4])]);
} else {
  const commit = execFileSync("git", ["rev-parse", baseline], { cwd: root, encoding: "utf8" }).trim();
  console.log(`Node ${process.version}; ${process.platform}/${process.arch}; ${cpus()[0]?.model}`);
  console.log(`JavaScript baseline: ${commit}; Current: working tree`);
  console.log(`${warmups} warmups + ${rounds} measured batches; medians, microseconds/op`);
  console.log("Separate processes per implementation/scenario; GC before each batch.");
  console.log("ASCII keys, filled to target capacity; module startup excluded.\n");
  for (let i = 0; i < scenarios.length; ++i) {
    const results = {};
    // Alternate execution order to reduce a systematic first-run advantage.
    const order = i % 2 ? ["current", "baseline"] : ["baseline", "current"];
    if (process.argv.includes("--reverse")) order.reverse();
    for (const implementation of order) {
      results[implementation] = JSON.parse(execFileSync(process.execPath, [
        "--expose-gc", fileURLToPath(import.meta.url), "--worker", implementation, String(i),
      ], { cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024 }));
    }
    assert.deepEqual(results.baseline.checks, results.current.checks, "Implementations disagree");
    console.log(`${scenarios[i].name}: m=${results.baseline.m}, k=${results.baseline.k}; correctness checks match`);
    console.log(`Backing buffers: baseline ${results.baseline.bytes} bytes; Current ${results.current.bytes} bytes`);
    console.log("Operation     Baseline µs   Current µs   Speedup    batch range baseline / current (µs/op)");
    for (const [name, js] of Object.entries(results.baseline.timings)) {
      const current = results.current.timings[name];
      console.log(`${name.padEnd(15)} ${js.median.toFixed(3).padStart(10)} ${current.median.toFixed(3).padStart(12)} ${(js.median / current.median).toFixed(2).padStart(8)}x    ${js.min.toFixed(3)}–${js.max.toFixed(3)} / ${current.min.toFixed(3)}–${current.max.toFixed(3)}`);
    }
    console.log("");
  }
}

async function worker(implementation, scenario) {
  const { BloomFilter } = implementation === "current"
    ? await import("./bloomfilter.js")
    : await import("data:text/javascript;base64," + Buffer.from(execFileSync(
      "git", ["show", `${baseline}:bloomfilter.js`], { cwd: root },
    )).toString("base64"));
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
  const union = BloomFilter.union(filled, right);
  const intersection = BloomFilter.intersection(filled, right);
  const checks = {
    buckets: digest(filled), bits: expectedBits, misses: expectedMisses,
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
    const samples = [];
    for (let i = 0; i < warmups + rounds; ++i) {
      const context = setup();
      global.gc();
      const start = performance.now();
      const result = run(context);
      const elapsed = performance.now() - start;
      verify(result, context);
      sink = result;
      if (i >= warmups) samples.push(elapsed * 1000 / operations);
    }
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
  }, result => assert.ok(Number.isFinite(result) && result > 0));

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
  console.log(JSON.stringify({ m: filled.m, k: filled.k, bytes, checks, timings }));
}
