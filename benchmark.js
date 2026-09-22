import { performance } from "node:perf_hooks";
import { BloomFilter } from "./bloomfilter.js";

const expectedItems = 100_000;
const targetError = 1e-5;
const iterations = 200_000;
const rounds = 7;
const warmupRounds = 2;
const values = Array.from({ length: iterations }, (_, i) => `item:${i}`);
const misses = Array.from({ length: iterations }, (_, i) => `miss:${i}`);

function main() {
  console.log(`Node ${process.version}`);
  console.log(`BloomFilter.withTargetError(${expectedItems}, ${targetError})`);
  console.log(`iterations=${iterations}, rounds=${rounds}, warmups=${warmupRounds}`);
  console.log("");

  bench("construct", () => {
    BloomFilter.withTargetError(expectedItems, targetError);
  });

  bench("add", () => {
    const filter = BloomFilter.withTargetError(expectedItems, targetError);
    for (let i = 0; i < iterations; ++i) {
      filter.add(values[i]);
    }
  }, iterations);

  const filled = BloomFilter.withTargetError(expectedItems, targetError);
  for (let i = 0; i < iterations; ++i) {
    filled.add(values[i]);
  }

  bench("test hit", () => {
    let found = 0;
    for (let i = 0; i < iterations; ++i) {
      found += filled.test(values[i]);
    }
    assertResult(found, iterations);
  }, iterations);

  bench("test miss", () => {
    let found = 0;
    for (let i = 0; i < iterations; ++i) {
      found += filled.test(misses[i]);
    }
    assertResult(found >= 0, true);
  }, iterations);

  bench("locations", () => {
    let sum = 0;
    for (let i = 0; i < iterations; ++i) {
      const locations = filled.locations(values[i]);
      for (let j = 0; j < locations.length; ++j) {
        sum += locations[j];
      }
    }
    assertResult(sum >= 0, true);
  }, iterations);

  bench("countBits", () => {
    assertResult(filled.countBits() > 0, true);
  });

  const right = BloomFilter.withTargetError(expectedItems, targetError);
  for (let i = 0; i < iterations; ++i) {
    right.add(`right:${i}`);
  }

  bench("union", () => {
    assertResult(BloomFilter.union(filled, right).countBits() > 0, true);
  });

  bench("intersection", () => {
    assertResult(BloomFilter.intersection(filled, right).countBits() >= 0, true);
  });
}

function bench(name, run, operations = 1) {
  const samples = [];
  for (let i = 0; i < warmupRounds + rounds; ++i) {
    const start = performance.now();
    run();
    const elapsed = performance.now() - start;
    if (i >= warmupRounds) {
      samples.push(elapsed);
    }
  }
  samples.sort((a, b) => a - b);
  const median = samples[samples.length >> 1];
  const perSecond = operations / (median / 1000);
  const perOp = median / operations;
  console.log(`${name.padEnd(14)} ${formatRate(perSecond).padStart(12)} ops/s  ${formatMs(perOp).padStart(10)} ms/op`);
}

function formatRate(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}k`;
  return value.toFixed(2);
}

function formatMs(value) {
  if (value < 0.001) return value.toFixed(6);
  if (value < 1) return value.toFixed(4);
  return value.toFixed(2);
}

function assertResult(actual, expected) {
  if (actual !== expected) {
    throw new Error(`Unexpected benchmark result: ${actual} !== ${expected}`);
  }
}

main();
