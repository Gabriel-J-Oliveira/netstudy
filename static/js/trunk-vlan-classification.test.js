const assert = require("node:assert/strict");
const test = require("node:test");
const { classifyFrame } = require("./trunk-vlan-classification.js");

test("PVID classifies an untagged frame and tagged egress adds that VLAN", () => {
  assert.deepEqual(classifyFrame("", "20", "tagged", "10"), {
    internalVlan: "20", outputTag: "20", peerVlan: "20", sameVlan: true,
  });
});

test("an admitted tag overrides neither VLAN nor output policy through the PVID", () => {
  assert.deepEqual(classifyFrame("10", "20", "tagged", "20"), {
    internalVlan: "10", outputTag: "10", peerVlan: "10", sameVlan: true,
  });
});

test("untagged egress removes the tag and a mismatched peer PVID changes classification", () => {
  assert.deepEqual(classifyFrame("10", "20", "untagged", "20"), {
    internalVlan: "10", outputTag: "", peerVlan: "20", sameVlan: false,
  });
});

test("untagged transport can preserve VLAN context with a matching receiving PVID", () => {
  assert.deepEqual(classifyFrame("", "20", "untagged", "20"), {
    internalVlan: "20", outputTag: "", peerVlan: "20", sameVlan: true,
  });
});
