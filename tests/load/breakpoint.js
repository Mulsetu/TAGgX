// Breakpoint: keep adding traffic until it breaks, to find real capacity.
// Stops by itself once errors pass 5%. Staging only.
//   k6 run -e TARGET_URL=https://staging.example -e MAX_RPS=500 tests/load/breakpoint.js
import { journey } from "./lib/scenario.js";

export const options = {
  scenarios: {
    breakpoint: {
      executor: "ramping-arrival-rate",
      startRate: 5,
      timeUnit: "1s",
      preAllocatedVUs: 50,
      maxVUs: Number(__ENV.MAX_VUS || 1000),
      stages: [{ duration: "20m", target: Number(__ENV.MAX_RPS || 500) }],
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.05", abortOnFail: true, delayAbortEval: "30s" }],
  },
};

export default journey;
