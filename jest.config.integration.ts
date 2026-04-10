import { createDefaultPreset } from "ts-jest";


const tsJestTransformCfg = createDefaultPreset().transform;

export default {
   testEnvironment: "node",
   transform: {
      ...tsJestTransformCfg,
   },
   testMatch: ["**/tests/integration/**/*.test.ts"],
};