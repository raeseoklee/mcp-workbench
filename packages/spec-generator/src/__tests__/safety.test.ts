import { describe, it, expect } from "vitest";
import { classifyTool, hasInferrableArgs } from "../safety.js";

describe("classifyTool", () => {
  it("classifies get_* as safe", () => {
    expect(classifyTool("get_weather").level).toBe("safe");
    expect(classifyTool("get_agent_card").level).toBe("safe");
  });

  it("classifies list_* as safe", () => {
    expect(classifyTool("list_agents").level).toBe("safe");
    expect(classifyTool("list_policies").level).toBe("safe");
  });

  it("classifies read/search/check as safe", () => {
    expect(classifyTool("read_file").level).toBe("safe");
    expect(classifyTool("search_docs").level).toBe("safe");
    expect(classifyTool("check_status").level).toBe("safe");
    expect(classifyTool("health_check").level).toBe("safe");
  });

  it("classifies delete/remove as unsafe", () => {
    expect(classifyTool("delete_user").level).toBe("unsafe");
    expect(classifyTool("remove_agent").level).toBe("unsafe");
  });

  it("classifies create/update/send as unsafe", () => {
    expect(classifyTool("create_note").level).toBe("unsafe");
    expect(classifyTool("update_rate_limit").level).toBe("unsafe");
    expect(classifyTool("send_test_message").level).toBe("unsafe");
  });

  it("classifies register/deregister as unsafe", () => {
    expect(classifyTool("register_agent").level).toBe("unsafe");
    expect(classifyTool("deregister_agent").level).toBe("unsafe");
  });

  it("classifies approve/reject as unsafe", () => {
    expect(classifyTool("approve_card_change").level).toBe("unsafe");
    expect(classifyTool("reject_card_change").level).toBe("unsafe");
  });

  it("returns unknown for ambiguous names", () => {
    expect(classifyTool("process_data").level).toBe("unknown");
    expect(classifyTool("foo_bar").level).toBe("unknown");
  });
});

describe("hasInferrableArgs", () => {
  it("returns true when no schema", () => {
    expect(hasInferrableArgs(undefined)).toBe(true);
  });

  it("returns true when no required fields", () => {
    expect(hasInferrableArgs({ properties: { a: {} } })).toBe(true);
  });

  it("returns true when required fields exist in properties", () => {
    expect(
      hasInferrableArgs({
        properties: { city: { type: "string" } },
        required: ["city"],
      }),
    ).toBe(true);
  });

  it("returns false when required field missing from properties", () => {
    expect(
      hasInferrableArgs({
        properties: { name: { type: "string" } },
        required: ["city"],
      }),
    ).toBe(false);
  });
});
