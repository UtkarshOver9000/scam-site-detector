import { runBenchmark } from "./syntheticEval";

const metrics = runBenchmark(7, 150, 45);
console.log(JSON.stringify(metrics, null, 2));
