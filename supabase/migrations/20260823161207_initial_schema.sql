-- ============================================================
-- TaskFlow initial database schema
-- ============================================================

-- ============================================================
-- Schemas
-- ============================================================

create schema if not exists private;

-- ============================================================
-- Tables
-- ============================================================

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),

  constraint boards_title_check
    check (char_length(trim(title)) > 0)
);

create table public.board_members (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),

  unique (board_id, user_id)
);

create table public.columns (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  title text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),

  constraint columns_title_check
    check (char_length(trim(title)) > 0)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  column_id uuid not null references public.columns(id) on delete cascade,
  title text not null,
  description text,
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  due_date date,
  assignee_id uuid references auth.users(id) on delete set null,
  position integer not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint tasks_title_check
    check (char_length(trim(title)) > 0)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),

  constraint comments_content_check
    check (char_length(trim(content)) > 0)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================

create index board_members_board_id_idx
  on public.board_members (board_id);

create index board_members_user_id_idx
  on public.board_members (user_id);

create index boards_owner_id_idx
  on public.boards (owner_id);

create index columns_board_id_idx
  on public.columns (board_id);

create index columns_board_position_idx
  on public.columns (board_id, position);

create index comments_task_id_idx
  on public.comments (task_id);

create index comments_user_id_idx
  on public.comments (user_id);

create index tasks_assignee_id_idx
  on public.tasks (assignee_id);

create index tasks_column_id_idx
  on public.tasks (column_id);

create index tasks_column_position_idx
  on public.tasks (column_id, position);

create index tasks_created_by_idx
  on public.tasks (created_by);

-- ============================================================
-- Private helper functions
-- ============================================================

create or replace function private.is_board_member(
  target_board_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.board_members
    where board_id = target_board_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function private.is_board_owner(
  target_board_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.board_members
    where board_id = target_board_id
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

revoke all on function private.is_board_member(uuid) from public;
grant execute on function private.is_board_member(uuid) to authenticated;

revoke all on function private.is_board_owner(uuid) from public;
grant execute on function private.is_board_owner(uuid) to authenticated;

-- ============================================================
-- User profile creation
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    name
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'name'
  );

  return new;
end;
$$;

-- ============================================================
-- Board creation
-- Creates:
--   1. owner membership
--   2. To Do column
--   3. In Progress column
--   4. Done column
-- ============================================================

create or replace function public.handle_new_board()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  insert into public.board_members (
    board_id,
    user_id,
    role
  )
  values (
    new.id,
    new.owner_id,
    'owner'
  );

  insert into public.columns (
    board_id,
    title,
    position
  )
  values
    (new.id, 'To Do', 0),
    (new.id, 'In Progress', 1),
    (new.id, 'Done', 2);

  return new;
end;
$$;

-- ============================================================
-- Task reordering
-- ============================================================

create or replace function public.reorder_tasks(
  p_tasks jsonb
)
returns void
language plpgsql
as $$
begin
  update public.tasks as t
  set
    column_id = data.column_id,
    position = data.position
  from (
    select *
    from jsonb_to_recordset(p_tasks)
      as x(
        id uuid,
        column_id uuid,
        position integer
      )
  ) as data
  where t.id = data.id;
end;
$$;

grant execute on function public.reorder_tasks(jsonb) to authenticated;

-- ============================================================
-- Triggers
-- ============================================================

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create trigger on_board_created
  after insert on public.boards
  for each row
  execute function public.handle_new_board();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.columns enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.profiles enable row level security;

-- ============================================================
-- Boards
-- ============================================================

create policy "Users can view their boards"
  on public.boards
  for select
  to authenticated
  using (
    owner_id = auth.uid()
    or private.is_board_member(id)
  );

create policy "Users can create their own boards"
  on public.boards
  for insert
  to authenticated
  with check (
    owner_id = auth.uid()
  );

create policy "Owners can delete their boards"
  on public.boards
  for delete
  to authenticated
  using (
    owner_id = auth.uid()
  );

-- ============================================================
-- Board members
-- ============================================================

create policy "Members can view board members"
  on public.board_members
  for select
  to authenticated
  using (
    private.is_board_member(board_id)
  );

create policy "Owners can add board members"
  on public.board_members
  for insert
  to authenticated
  with check (
    private.is_board_owner(board_id)
    and role = 'member'
  );

create policy "Owners can remove board members"
  on public.board_members
  for delete
  to authenticated
  using (
    private.is_board_owner(board_id)
    and role = 'member'
  );

create policy "Owners can update board members"
  on public.board_members
  for update
  to authenticated
  using (
    private.is_board_owner(board_id)
  )
  with check (
    private.is_board_owner(board_id)
    and role = 'member'
  );

-- ============================================================
-- Columns
-- ============================================================

create policy "Members can view columns"
  on public.columns
  for select
  to authenticated
  using (
    private.is_board_member(board_id)
  );

create policy "Members can create columns"
  on public.columns
  for insert
  to authenticated
  with check (
    private.is_board_member(board_id)
  );

create policy "Members can update columns"
  on public.columns
  for update
  to authenticated
  using (
    private.is_board_member(board_id)
  )
  with check (
    private.is_board_member(board_id)
  );

create policy "Members can delete columns"
  on public.columns
  for delete
  to authenticated
  using (
    private.is_board_member(board_id)
  );

-- ============================================================
-- Tasks
-- ============================================================

create policy "Members can view tasks"
  on public.tasks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.columns
      where columns.id = tasks.column_id
        and private.is_board_member(columns.board_id)
    )
  );

create policy "Members can create tasks"
  on public.tasks
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.columns
      where columns.id = tasks.column_id
        and private.is_board_member(columns.board_id)
    )
    and created_by = auth.uid()
  );

create policy "Members can update tasks"
  on public.tasks
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.columns
      where columns.id = tasks.column_id
        and private.is_board_member(columns.board_id)
    )
  )
  with check (
    exists (
      select 1
      from public.columns
      where columns.id = tasks.column_id
        and private.is_board_member(columns.board_id)
    )
  );

create policy "Members can delete tasks"
  on public.tasks
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.columns
      where columns.id = tasks.column_id
        and private.is_board_member(columns.board_id)
    )
  );

-- ============================================================
-- Comments
-- ============================================================

create policy "Members can view comments"
  on public.comments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tasks
      join public.columns
        on columns.id = tasks.column_id
      where tasks.id = comments.task_id
        and private.is_board_member(columns.board_id)
    )
  );

create policy "Members can create comments"
  on public.comments
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.tasks
      join public.columns
        on columns.id = tasks.column_id
      where tasks.id = comments.task_id
        and private.is_board_member(columns.board_id)
    )
  );

create policy "Users can delete their comments"
  on public.comments
  for delete
  to authenticated
  using (
    user_id = auth.uid()
  );

create policy "Owners can delete comments"
  on public.comments
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.tasks
      join public.columns
        on columns.id = tasks.column_id
      where tasks.id = comments.task_id
        and private.is_board_owner(columns.board_id)
    )
  );

-- ============================================================
-- Profiles
-- ============================================================

create policy "Authenticated users can view profiles"
  on public.profiles
  for select
  to authenticated
  using (
    true
  );

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (
    id = auth.uid()
  )
  with check (
    id = auth.uid()
  );
