// Stress: well above normal (default 3x TARGET_VUS). Does it slow down gracefully
// instead of erroring?   k6 run -e TARGET_URL=... -e TARGET_VUS=50 tests/load/stress.js
import { THRESHOLDS, journey } from "./lib/scenario.js";

const peak = Number(__ENV.TARGET_VUS || 50) * Number(__ENV.STRESS_FACTOR || 3);

export const options = {
  stages: [
    { duration: "5m", target: peak },
    { duration: "20m", target: peak },
    { duration: "5m", target: 0 },
  ],
  thresholds: {
    ...THRESHOLDS,
    // Under stress, slower is acceptable; errors still are not.
    "http_req_duration{kind:public}": ["p(95)<2000"],
    "http_req_duration{kind:app}": ["p(95)<3000"],
  },
};

export default journey;
