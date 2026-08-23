import type { Board, CreateBoardInput } from "../types/board.types";
import { supabase } from "./supabase";

export const getBoards = async (): Promise<Board[]> => {
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
};

export const getBoard = async (boardId: string): Promise<Board | null> => {
  const { data, error } = await supabase
    .from("boards")
    .select("*")
    .eq("id", boardId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

export const createBoard = async (
  input: CreateBoardInput,
  userId: string,
): Promise<void> => {
  const { error } = await supabase.from("boards").insert({
    title: input.title,
    owner_id: userId,
  });

  if (error) {
    throw error;
  }
};

export const deleteBoard = async (boardId: string): Promise<void> => {
  const { error } = await supabase.from("boards").delete().eq("id", boardId);

  if (error) {
    throw error;
  }
};
