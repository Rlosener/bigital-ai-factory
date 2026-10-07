import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GraphPanel } from "./GraphNervousSystem";

const mocks = vi.hoisted(() => ({
  getFactoryGraph: vi.fn(async () => ({
    nodes: [
      {
        id: "n1",
        kind: "incident",
        label: "Takvim tarihi",
        body: "Instagram takviminde tarih biçimi geçersiz",
        confidence: "OBSERVED",
        scope: "project",
        success: 0,
      },
    ],
    edges: [],
    code_graph: {
      installed: true,
      ready: true,
      building: false,
      last_error: null,
      location: "graphify-out/graph.json",
      built_at: Date.UTC(2026, 9, 6),
      built_at_commit: "4782e4a5d422",
      node_count: 5037,
      edge_count: 12683,
      community_count: 2,
      communities: [
        { id: "1", name: "factory/runtime.ts", size: 40 },
        { id: "2", name: "shared/factory.ts", size: 20 },
      ],
      links: [{ source: "1", target: "2", weight: 9 }],
      hubs: [
        { label: "schedule()", source_file: "server/modules/factory/runtime.ts", degree: 31, community: "runtime" },
      ],
    },
  })),
  buildFactoryGraph: vi.fn(async () => ({})),
  queryFactoryGraph: vi.fn(async () => ({
    brief: "Doğrulanmış çözüm: tarihi YYYY-MM-DD yaz.",
    code: [
      {
        label: "schedule()",
        source_file: "server/modules/factory/runtime.ts",
        location: "L393",
        community: "factory/runtime.ts",
      },
    ],
  })),
}));
vi.mock("../../api/factory", () => mocks);

describe("GraphPanel", () => {
  it("shows the real Bigital code graph and answers with code and experience", async () => {
    render(<GraphPanel scope={{ businessId: "b1", projectId: "p1" }} />);
    expect(await screen.findByText("Bu bilgisayarda hazır")).toBeInTheDocument();
    expect(screen.getByText("5.037 düğüm · 12.683 bağ · 2 topluluk")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Bigital kod ağı: 2 topluluk" })).toBeInTheDocument();
    expect(screen.getByText("Instagram takviminde tarih biçimi geçersiz")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Kod ağını güncelle" }));
    await waitFor(() => expect(mocks.buildFactoryGraph).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Ağa sor"), { target: { value: "plan çalıştırma" } });
    fireEvent.click(screen.getByRole("button", { name: "İlgili kodu ve deneyimi getir" }));
    expect(await screen.findByText("server/modules/factory/runtime.ts:L393")).toBeInTheDocument();
    expect(screen.getByText(/YYYY-MM-DD/)).toBeInTheDocument();
  });
});
