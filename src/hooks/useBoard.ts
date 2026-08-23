import { useCallback, useEffect, useState } from "react";
import { getBoard } from "../services/boards.service";
import type { Board } from "../types/board.types";

export const useBoard = (boardId: string | undefined) => {
  const [board, setBoard] = useState<Board | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBoard = useCallback(async () => {
    if (!boardId) {
      setBoard(null);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      setIsLoading(true);

      const data = await getBoard(boardId);

      setBoard(data);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось загрузить доску",
      );
    } finally {
      setIsLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    queueMicrotask(() => void fetchBoard());
  }, [fetchBoard]);

  return { board, isLoading, error };
};
