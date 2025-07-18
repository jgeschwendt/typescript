import { expect, test } from "@jest/globals";

test("typescript", async () => {
  const { config } = await import("../index.js");

  config.packageJSON = () => ({
    dependencies: {},
    devDependencies: {
      typescript: "^5.0.0",
    },
  });

  expect(config().map(({ rules }) => rules)).toMatchSnapshot();
});
