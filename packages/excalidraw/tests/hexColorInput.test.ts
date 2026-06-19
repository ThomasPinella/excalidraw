import {
  normalizeHexInputColor,
  shouldShowHexInputError,
} from "../components/ColorPicker/colorPickerUtils";

describe("normalizeHexInputColor", () => {
  describe("valid hex colors", () => {
    it("accepts 3-digit hex", () => {
      expect(normalizeHexInputColor("abc")).toBe("#abc");
      expect(normalizeHexInputColor("#abc")).toBe("#abc");
    });

    it("accepts 4-digit hex", () => {
      expect(normalizeHexInputColor("abcd")).toBe("#abcd");
      expect(normalizeHexInputColor("#abcd")).toBe("#abcd");
    });

    it("accepts 6-digit hex", () => {
      expect(normalizeHexInputColor("ff0000")).toBe("#ff0000");
      expect(normalizeHexInputColor("#ff0000")).toBe("#ff0000");
    });

    it("accepts 8-digit hex", () => {
      expect(normalizeHexInputColor("ff000080")).toBe("#ff000080");
      expect(normalizeHexInputColor("#ff000080")).toBe("#ff000080");
    });

    it("trims whitespace", () => {
      expect(normalizeHexInputColor("  ff0000  ")).toBe("#ff0000");
    });
  });

  describe("invalid hex colors", () => {
    it("returns null for invalid lengths from SCRUM-2", () => {
      expect(normalizeHexInputColor("1")).toBe(null);
      expect(normalizeHexInputColor("12")).toBe(null);
      expect(normalizeHexInputColor("12345")).toBe(null);
      expect(normalizeHexInputColor("1234567")).toBe(null);
      expect(normalizeHexInputColor("123456789")).toBe(null);
    });

    it("returns null for invalid hexadecimal characters", () => {
      expect(normalizeHexInputColor("zzzzzz")).toBe(null);
      expect(normalizeHexInputColor("#gggggg")).toBe(null);
    });

    it("returns null for named colors", () => {
      expect(normalizeHexInputColor("blue")).toBe(null);
      expect(normalizeHexInputColor("red")).toBe(null);
    });

    it("returns null for non-hex color formats", () => {
      expect(normalizeHexInputColor("rgb(255, 0, 0)")).toBe(null);
      expect(normalizeHexInputColor("hsl(0, 100%, 50%)")).toBe(null);
    });

    it("returns null for empty input", () => {
      expect(normalizeHexInputColor("")).toBe(null);
      expect(normalizeHexInputColor("   ")).toBe(null);
    });
  });
});

describe("shouldShowHexInputError", () => {
  it("does not show error for empty input", () => {
    expect(shouldShowHexInputError("")).toBe(false);
    expect(shouldShowHexInputError("   ")).toBe(false);
  });

  it("does not show error for valid hex input", () => {
    expect(shouldShowHexInputError("ff0000")).toBe(false);
    expect(shouldShowHexInputError("abc")).toBe(false);
  });

  it("does not show error for in-progress hex while typing", () => {
    expect(shouldShowHexInputError("f")).toBe(false);
    expect(shouldShowHexInputError("ff")).toBe(false);
    expect(shouldShowHexInputError("12345")).toBe(false);
    expect(shouldShowHexInputError("1234567")).toBe(false);
  });

  it("shows error immediately for clearly invalid input", () => {
    expect(shouldShowHexInputError("zzzzzz")).toBe(true);
    expect(shouldShowHexInputError("blue")).toBe(true);
    expect(shouldShowHexInputError("123456789")).toBe(true);
  });

  it("shows error on blur for incomplete hex input", () => {
    expect(shouldShowHexInputError("1", { onBlur: true })).toBe(true);
    expect(shouldShowHexInputError("12", { onBlur: true })).toBe(true);
    expect(shouldShowHexInputError("12345", { onBlur: true })).toBe(true);
    expect(shouldShowHexInputError("1234567", { onBlur: true })).toBe(true);
  });

  it("does not show error on blur for valid hex input", () => {
    expect(shouldShowHexInputError("ff0000", { onBlur: true })).toBe(false);
  });
});
