import { defaultPreset, Feedback } from "@dnd-kit/dom";
import { DragDropProvider } from "@dnd-kit/react";
import { isSortable } from "@dnd-kit/react/sortable";
import { useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import ColumnCard from "../components/board/ColumnCard";
import CreateColumnButton from "../components/board/CreateColumnButton";
import Header from "../components/shared/Header";
import { useBoard } from "../hooks/useBoard";
import { useColumns } from "../hooks/useColumns";
import { useTasks } from "../hooks/useTasks";
import { useAuth } from "../providers/useAuth";
import { reorderTasks } from "../utils/reorderTasks";

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const BoardPage = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const { user } = useAuth();
  const {
    board,
    isLoading: isBoardDetailsLoading,
    error: boardError,
  } = useBoard(boardId);
  const {
    columns,
    isLoading,
    error: columnsError,
    addColumn,
    renameColumn,
    removeColumn,
  } = useColumns(boardId);
  const columnIds = useMemo(
    () => columns.map((column) => column.id),
    [columns],
  );
  const {
    tasks,
    isLoading: isTasksLoading,
    error: tasksError,
    addTask,
    removeTask,
    applyLocalOrder,
    persistOrder,
  } = useTasks(columnIds);
  const [operationError, setOperationError] = useState<string | null>(null);
  const dragRevisionRef = useRef(0);
  const dndPlugins = useMemo(
    () => (plugins: typeof defaultPreset.plugins) =>
      plugins.map((plugin) =>
        plugin === Feedback
          ? Feedback.configure({ dropAnimation: null })
          : plugin,
      ),
    [],
  );
  const isBoardLoading = isBoardDetailsLoading || isLoading || isTasksLoading;

  const showError = (error: unknown, fallback: string) => {
    setOperationError(getErrorMessage(error, fallback));
  };

  const handleRename = async (columnId: string, title: string) => {
    try {
      await renameColumn(columnId, title);
    } catch (error) {
      showError(error, "Не удалось переименовать колонку");
    }
  };

  const handleDelete = async (columnId: string) => {
    try {
      await removeColumn(columnId);
    } catch (error) {
      showError(error, "Не удалось удалить колонку");
    }
  };

  const handleCreate = async (title: string) => {
    try {
      await addColumn(title);
    } catch (error) {
      showError(error, "Не удалось создать колонку");
    }
  };

  const handleCreateTask = async (columnId: string, title: string) => {
    if (!user) {
      return;
    }

    try {
      const columnTasks = tasks.filter((task) => task.column_id === columnId);
      const position =
        columnTasks.length > 0
          ? Math.max(...columnTasks.map((task) => task.position)) + 1
          : 0;

      await addTask({
        column_id: columnId,
        title,
        position,
        created_by: user.id,
      });
    } catch (error) {
      showError(error, "Не удалось создать задачу");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await removeTask(taskId);
    } catch (error) {
      showError(error, "Не удалось удалить задачу");
    }
  };

  const handleDragEnd = async (
    event: Parameters<
      NonNullable<React.ComponentProps<typeof DragDropProvider>["onDragEnd"]>
    >[0],
  ) => {
    if (event.canceled) {
      return;
    }

    const { source, target } = event.operation;

    if (!isSortable(source) || !target) {
      return;
    }

    const sourceColumnId = String(source.initialGroup);
    const targetColumnId = isSortable(target)
      ? String(target.group)
      : String(target.id).replace("column-", "");

    if (
      !sourceColumnId ||
      sourceColumnId === "undefined" ||
      !targetColumnId ||
      targetColumnId === "undefined"
    ) {
      return;
    }

    const previousTasks = tasks;
    const targetIndex = isSortable(target)
      ? target.index
      : previousTasks.filter((task) => task.column_id === targetColumnId)
          .length;
    const nextTasks = reorderTasks(
      previousTasks,
      String(source.id),
      sourceColumnId,
      targetColumnId,
      targetIndex,
    );
    const dragRevision = ++dragRevisionRef.current;

    applyLocalOrder(nextTasks);

    try {
      await persistOrder(nextTasks);
    } catch (error) {
      showError(error, "Не удалось сохранить порядок задач");
      if (dragRevision === dragRevisionRef.current) {
        applyLocalOrder(previousTasks);
      }
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-zinc-50">
      <Header />

      <div className="mx-auto max-w-7xl flex-1 overflow-x-auto px-4 py-8">
        {isBoardLoading ? (
          <div className="flex min-h-full gap-4 p-4">
            <div className="h-96 w-80 shrink-0 animate-pulse rounded-xl bg-zinc-200" />
            <div className="h-96 w-80 shrink-0 animate-pulse rounded-xl bg-zinc-200" />
            <div className="h-96 w-80 shrink-0 animate-pulse rounded-xl bg-zinc-200" />
          </div>
        ) : boardError ? (
          <div className="mx-auto flex min-h-96 max-w-xl flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <h1 className="text-xl font-semibold text-red-900">
              Не удалось загрузить доску
            </h1>
            <p className="mt-2 text-sm text-red-700">{boardError}</p>
          </div>
        ) : !board ? (
          <div className="mx-auto flex min-h-96 max-w-xl flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-zinc-900">
              Доска не найдена
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Возможно, доска была удалена или у вас нет доступа к ней.
            </p>
          </div>
        ) : (
          <DragDropProvider onDragEnd={handleDragEnd} plugins={dndPlugins}>
            <div className="flex min-h-full gap-4 p-4">
              {columns.map((column) => {
                const columnTasks = tasks
                  .filter((task) => task.column_id === column.id)
                  .sort((first, second) => first.position - second.position);

                return (
                  <ColumnCard
                    key={column.id}
                    column={column}
                    tasks={columnTasks}
                    onCreateTask={(title) => handleCreateTask(column.id, title)}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onDeleteTask={handleDeleteTask}
                  />
                );
              })}

              <CreateColumnButton onCreate={handleCreate} />
            </div>

            {(operationError || columnsError || tasksError) && (
              <div className="fixed bottom-4 right-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 shadow-lg">
                {operationError || columnsError || tasksError}
              </div>
            )}
          </DragDropProvider>
        )}
      </div>
    </main>
  );
};

export default BoardPage;
