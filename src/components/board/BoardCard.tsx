import { useState } from "react";
import { Link } from "react-router-dom";
import type { Board } from "../../types/board.types";

interface BoardCardProps {
  board: Board;
  onDelete: (boardId: string) => Promise<void>;
}

const BoardCard = ({ board, onDelete }: BoardCardProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Удалить доску "${board.title}"?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await onDelete(board.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm flex flex-col justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">{board.title}</h2>

        <p className="mt-1 text-sm text-zinc-500">
          Создана {new Date(board.created_at).toLocaleDateString("ru-RU")}
        </p>
      </div>

      <div className="flex justify-between">
        <Link
          to={`/boards/${board.id}`}
          className="rounded-lg px-6 py-2 block font-medium bg-zinc-200 transition hover:bg-zinc-300"
        >
          Открыть доску
        </Link>

        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={isDeleting}
          className="rounded-lg px-6 py-2 font-medium border-red-600 text-red-600 transition hover:bg-red-50"
        >
          {isDeleting ? "Удаление..." : "Удалить"}
        </button>
      </div>
    </div>
  );
};

export default BoardCard;
