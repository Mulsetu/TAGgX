// Spike: a sudden burst (e.g. everyone starting an audit at 9am), then back to zero.
// Checks the app survives and recovers.   k6 run -e TARGET_URL=... -e SPIKE_VUS=300 tests/load/spike.js
import { THRESHOLDS, journey } from "./lib/scenario.js";

const spike = Number(__ENV.SPIKE_VUS || 300);

export const options = {
  stages: [
    { duration: "1m", target: spike },
    { duration: "2m", target: spike },
    { duration: "1m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.05"],
    checks: ["rate>0.95"],
  },
};

export default journey;
