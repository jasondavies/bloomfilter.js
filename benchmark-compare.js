import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { printEnvironment, runBenchmark, scenarios } from "./benchmark.js";

// Pin the baseline so later commits do not change the comparison.
const baseline = "3703d8a40c9e3f3ad5a3ee3071888a793b69471b";
const root = fileURLToPath(new URL(".", import.meta.url));

function readBaseline() {
  try {
    return execFileSync("git", ["show", `${baseline}:bloomfilter.js`], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
    });
  } catch {
    throw new Error(`Comparison requires a Git checkout containing commit ${baseline}. Use npm run benchmark for an installed package.`);
  }
}

if (process.argv[2] === "--worker") {
  const implementation = process.argv[3];
  const index = Number(process.argv[4]);
  assert.ok(["current", "baseline"].includes(implementation), "Unknown benchmark implementation");
  assert.ok(Number.isInteger(index) && index >= 0 && index < scenarios.length, "Unknown benchmark scenario");
  const { BloomFilter } = implementation === "current"
    ? await import("./bloomfilter.js")
    : await import("data:text/javascript;base64," + Buffer.from(readBaseline()).toString("base64"));
  console.log(JSON.stringify(runBenchmark(BloomFilter, scenarios[index])));
} else {
  try {
    readBaseline();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  printEnvironment({ forceGc: true });
  console.log(`JavaScript baseline: ${baseline}; current: working tree`);
  console.log("Separate processes per implementation/scenario; speedup = baseline/current.\n");
  for (let i = 0; i < scenarios.length; ++i) {
    const results = {};
    const order = i % 2 ? ["current", "baseline"] : ["baseline", "current"];
    if (process.argv.includes("--reverse")) order.reverse();
    for (const implementation of order) {
      results[implementation] = JSON.parse(execFileSync(process.execPath, [
        "--expose-gc", fileURLToPath(import.meta.url), "--worker", implementation, String(i),
      ], { cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024 }));
    }
    assert.deepEqual(results.baseline.checks, results.current.checks, "Implementations disagree");
    console.log(`${scenarios[i].name}: m=${results.current.m}, k=${results.current.k}; correctness checks match`);
    console.log(`Backing buffers: baseline ${results.baseline.bytes} bytes; current ${results.current.bytes} bytes`);
    console.log("Operation       Baseline µs   Current µs   Speedup   Range baseline / current (µs/op)");
    for (const [name, original] of Object.entries(results.baseline.timings)) {
      const current = results.current.timings[name];
      console.log(`${name.padEnd(15)} ${original.median.toFixed(3).padStart(10)} ${current.median.toFixed(3).padStart(12)} ${(original.median / current.median).toFixed(2).padStart(8)}x   ${original.min.toFixed(3)}–${original.max.toFixed(3)} / ${current.min.toFixed(3)}–${current.max.toFixed(3)}`);
    }
    console.log("");
  }
}
