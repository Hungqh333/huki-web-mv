import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    /*
     * Spec V1.1 §2: engine và dữ liệu thuần code, không gọi LLM. LLM chỉ nằm trong
     * src/lib/ai (bộ đọc mô tả) và chỉ được gọi từ server action. Chặn ở đây để
     * không ai "tiện tay" gọi LLM từ engine khi thiếu một luật.
     */
    files: [
      "src/lib/{vision,selector,requirement,projects,components,kpi,pdf}/**/*.{ts,tsx}",
      "src/lib/*.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@google/genai", message: "Spec §2: engine không gọi LLM. Dùng src/lib/ai qua server action." },
          ],
          patterns: [
            {
              group: ["@/lib/ai", "@/lib/ai/*", "../ai", "../ai/*", "../../ai/*", "@google/genai/*"],
              message: "Spec §2: engine không được import tầng AI (src/lib/ai).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
