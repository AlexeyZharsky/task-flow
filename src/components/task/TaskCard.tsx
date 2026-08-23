import { useSortable } from "@dnd-kit/react/sortable";
import { useState } from "react";
import type { Task } from "../../types/task.types";

interface TaskCardProps {
  task: Task;
  index: number;
  columnId: string;
  onDelete: (taskId: string) => Promise<void>;
}

const TaskCard = ({ task, index, columnId, onDelete }: TaskCardProps) => {
  const sortable = useSortable({
    id: task.id,
    index,
    group: columnId,
    type: "task",
    accept: "task",
    plugins: [],
  });
  const { ref: sortableRef, handleRef } = sortable;
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Удалить задачу "${task.title}"?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await onDelete(task.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <article
      ref={sortableRef}
      className={
        "group rounded-lg border bg-white p-3 shadow-sm transition border-zinc-200"
      }
    >
      <div className="flex items-start gap-2">
        <button
          ref={handleRef}
          type="button"
          className="cursor-grab text-zinc-500 active:cursor-grabbing"
          aria-label="Перетащить задачу"
        >
          : :
        </button>

        <p className="min-w-0 flex-1 wrap-break-word font-medium">
          {task.title}
        </p>

        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={isDeleting}
          className="text-xs text-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDeleting ? "Удаление..." : "x"}
        </button>
      </div>
    </article>
  );
};

export default TaskCard;
