import { useDroppable } from "@dnd-kit/react";
import { useState } from "react";
import type { BoardColumn } from "../../types/column.types";
import type { Task } from "../../types/task.types";
import CreateTaskForm from "../task/CreateTaskForm";
import TaskCard from "../task/TaskCard";

interface ColumnCardProps {
  column: BoardColumn;
  tasks: Task[];
  onCreateTask: (title: string) => Promise<void>;
  onRename: (columnId: string, title: string) => Promise<void>;
  onDelete: (columnId: string) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
}

const ColumnCard = ({
  column,
  tasks,
  onCreateTask,
  onRename,
  onDelete,
  onDeleteTask,
}: ColumnCardProps) => {
  const { ref: droppableRef, isDropTarget } = useDroppable({
    id: `column-${column.id}`,
    accept: "task",
    disabled: tasks.length > 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(column.title);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRename = async () => {
    const normalizedTitle = title.trim();

    if (!normalizedTitle || normalizedTitle === column.title) {
      setTitle(column.title);
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);

      await onRename(column.id, normalizedTitle);

      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Удалить колонку "${column.title}"?`)) {
      return;
    }

    try {
      setIsDeleting(true);
      await onDelete(column.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="flex w-80 shrink-0 flex-col rounded-xl bg-zinc-100 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        {isEditing ? (
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void handleRename();
              }

              if (event.key === "Escape") {
                setTitle(column.title);
                setIsEditing(false);
              }
            }}
            disabled={isSaving}
            className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm font-semibold outline-none focus:border-zinc-900"
          />
        ) : (
          <h2 className="min-w-0 flex-1 truncate px-1 text-sm font-semibold text-zinc-800">
            {column.title}
          </h2>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {isEditing ? (
            <button
              type="button"
              onClick={() => void handleRename()}
              disabled={isSaving}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200"
            >
              Сохранить
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
            >
              Изменить
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? "Удаление..." : "Удалить"}
          </button>
        </div>
      </div>

      <CreateTaskForm onCreate={onCreateTask} />

      <div
        ref={droppableRef}
        className={`flex min-h-32 flex-col gap-2 rounded-lg p-1 transition ${
          isDropTarget ? "bg-zinc-200/70" : ""
        }`}
      >
        {tasks.map((task, index) => (
          <TaskCard
            key={task.id}
            task={task}
            index={index}
            columnId={column.id}
            onDelete={onDeleteTask}
          />
        ))}

        {tasks.length === 0 && (
          <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50">
            <p className="text-xs text-zinc-400">Перетащите задачу сюда</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default ColumnCard;
