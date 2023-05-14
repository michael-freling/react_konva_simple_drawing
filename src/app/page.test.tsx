import { render, screen } from "@testing-library/react";
import Home from "./page";
import "@testing-library/jest-dom";

describe("Home", () => {
  it("save button", () => {
    render(<Home />);

    const saveButton = screen.getByText("Save");
    expect(saveButton).toBeInTheDocument();
  });
});
