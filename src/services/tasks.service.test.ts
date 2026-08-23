import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import type { ReorderTaskPayload } from "../types/task.types";
import { reorderTasks } from "./tasks.service";

describe("reorderTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls reorder_tasks RPC with provided tasks", async () => {
    const tasks: ReorderTaskPayload[] = [
      {
        id: "task-1",
        column_id: "column-1",
        position: 0,
      },
      {
        id: "task-2",
        column_id: "column-2",
        position: 1,
      },
    ];

    rpcMock.mockResolvedValue({
      error: null,
    });

    await reorderTasks(tasks);

    expect(rpcMock).toHaveBeenCalledWith("reorder_tasks", {
      p_tasks: tasks,
    });
  });

  it("throws when reorder_tasks RPC returns an error", async () => {
    const tasks: ReorderTaskPayload[] = [
      {
        id: "task-1",
        column_id: "column-1",
        position: 0,
      },
    ];

    const error = new Error("Failed to reorder tasks");

    rpcMock.mockResolvedValue({
      error,
    });

    await expect(reorderTasks(tasks)).rejects.toBe(error);
  });
});
