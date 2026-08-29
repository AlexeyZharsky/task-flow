import { useCallback, useEffect, useRef, useState } from "react";
import {
  createTask,
  deleteTask,
  getTasks,
  reorderTasks,
  updateTask,
} from "../services/tasks.service";
import type {
  CreateTaskInput,
  Task,
  UpdateTaskInput,
} from "../types/task.types";

export const useTasks = (columnIds: string[]) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reorderQueueRef = useRef(Promise.resolve());
  const latestOrderRef = useRef(0);

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await getTasks(columnIds);

      setTasks(data);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось загрузить задачи",
      );
    } finally {
      setIsLoading(false);
    }
  }, [columnIds]);

  useEffect(() => {
    queueMicrotask(() => void fetchTasks());
  }, [fetchTasks]);

  const addTask = async (input: CreateTaskInput) => {
    const newTask = await createTask(input);

    setTasks((currentTasks) => [...currentTasks, newTask]);

    return newTask;
  };

  const editTask = async (taskId: string, input: UpdateTaskInput) => {
    const updatedTask = await updateTask(taskId, input);

    setTasks((currentTasks) =>
      currentTasks.map((task) => (task.id === taskId ? updatedTask : task)),
    );

    return updatedTask;
  };

  const removeTask = async (taskId: string) => {
    await deleteTask(taskId);

    setTasks((currentTasks) =>
      currentTasks.filter((task) => task.id !== taskId),
    );
  };

  const applyLocalOrder = (nextTasks: Task[]) => {
    setTasks(nextTasks);
  };

  const persistOrder = async (nextTasks: Task[]) => {
    const orderVersion = ++latestOrderRef.current;
    const request = () =>
      reorderTasks(
        nextTasks.map((task) => ({
          id: task.id,
          column_id: task.column_id,
          position: task.position,
        })),
      );
    const queuedRequest = reorderQueueRef.current.then(request, request);

    reorderQueueRef.current = queuedRequest.then(
      () => undefined,
      () => undefined,
    );
    await queuedRequest;

    if (orderVersion === latestOrderRef.current) {
      setTasks(nextTasks);
    }
  };

  return {
    tasks,
    isLoading,
    error,
    addTask,
    editTask,
    removeTask,
    applyLocalOrder,
    persistOrder,
    refetch: fetchTasks,
  };
};
