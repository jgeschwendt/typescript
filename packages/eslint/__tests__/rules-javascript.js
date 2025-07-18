import { expect, test } from "@jest/globals";

test("javascript", async () => {
  const { config } = await import("../index.js");

  expect(config().map(({ rules }) => rules)).toMatchSnapshot();
});
