import { defineConfig } from "orval";

export default defineConfig({
  hesApi: {
    input: {
      target: "../backend/openapi.json",
    },
    output: {
      mode: "tags-split",
      target: "./src/api/generated",
      schemas: "./src/api/model",
      client: "react-query",
      httpClient: "fetch",
      override: {
        mutator: {
          path: "./src/lib/api-client.ts",
          name: "customFetch",
        },
        query: {
          useQuery: true,
          useInfinite: false,
        },
      },
    },
  },
});
