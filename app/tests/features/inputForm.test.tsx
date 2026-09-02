// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InputForm } from "../../src/features/input/InputForm";

describe("input form", () => {
  it("captures title, details, and type selection then generates", () => {
    // Covers COMP-INPUTFORM, FR-INPUT-TITLE, FR-INPUT-DETAILS, FR-INPUT-SELECT, AT-INPUT-ENTER (PR-WEB-INPUTFORM).
    const onContinue = vi.fn();
    render(<InputForm onContinue={onContinue} />);
    fireEvent.change(screen.getByLabelText("Product Title"), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText("Product Details"), { target: { value: "Details." } });
    fireEvent.click(screen.getByLabelText("Product Requirements Document"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledWith({
      productTitle: "Acme",
      productDetails: "Details.",
      selectedTypes: ["PRD"],
      answers: {},
    });
  });

  it("blocks generation and shows validation messages when empty", () => {
    // Covers FR-INPUT-VALIDATE, FR-REGEN-EDITINPUT, AT-INPUT-VALIDATE (PR-WEB-INPUTFORM).
    const onContinue = vi.fn();
    render(<InputForm onContinue={onContinue} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });
});
