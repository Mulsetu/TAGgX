// Average load: expected everyday traffic. Set TARGET_VUS to your normal concurrent users.
//   k6 run -e TARGET_URL=https://staging.example -e TARGET_VUS=50 tests/load/load.js
import { THRESHOLDS, journey } from "./lib/scenario.js";

const target = Number(__ENV.TARGET_VUS || 50);

export const options = {
  stages: [
    { duration: "5m", target },
    { duration: "20m", target },
    { duration: "5m", target: 0 },
  ],
  thresholds: THRESHOLDS,
};

export default journey;
