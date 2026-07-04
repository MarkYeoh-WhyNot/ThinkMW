-- Run this in your Supabase SQL editor

create extension if not exists "uuid-ossp";

-- Schools
create table schools (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  country     text not null default 'MY',
  plan_tier   text not null default 'free' check (plan_tier in ('free','school','enterprise')),
  brand_color text,
  logo_url    text,
  created_at  timestamptz not null default now()
);

-- Users (mirrors Supabase auth.users)
create table users (
  id               uuid primary key references auth.users on delete cascade,
  school_id        uuid references schools(id),
  email            text not null unique,
  display_name     text,
  role             text not null check (role in ('student','teacher','admin')),
  thinking_profile jsonb default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

-- Classes
create table classes (
  id          uuid primary key default uuid_generate_v4(),
  teacher_id  uuid not null references users(id),
  school_id   uuid references schools(id),
  name        text not null,
  subject     text not null,
  invite_code text unique default substr(md5(random()::text), 1, 8),
  created_at  timestamptz not null default now()
);

-- Class enrolments
create table class_enrolments (
  class_id   uuid not null references classes(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (class_id, student_id)
);

-- Topics
create table topics (
  id               uuid primary key default uuid_generate_v4(),
  class_id         uuid not null references classes(id) on delete cascade,
  title            text not null,
  subject          text not null,
  source_file_url  text,
  raw_text         text,
  status           text not null default 'processing' check (status in ('processing','ready','error')),
  neo4j_graph_id   text,
  settings         jsonb default '{}'::jsonb,   -- time_limit, hint_tokens, allowed_edge_types, etc.
  teacher_approved_at timestamptz,
  created_at       timestamptz not null default now()
);

-- Concept nodes (extracted from topic content)
create table concept_nodes (
  id             uuid primary key default uuid_generate_v4(),
  topic_id       uuid not null references topics(id) on delete cascade,
  canonical_name text not null,
  aliases        text[] default '{}',
  description    text,
  cluster_tag    text,
  created_at     timestamptz not null default now(),
  unique (topic_id, canonical_name)
);

-- Edge alias library (semantic normalisation)
create table edge_aliases (
  id             uuid primary key default uuid_generate_v4(),
  alias_text     text not null,
  canonical_type text not null,
  subject        text,
  confirmed_by   uuid references users(id),
  created_at     timestamptz not null default now(),
  unique (alias_text, subject)
);

-- Graph sessions (one per student per topic attempt)
create table graph_sessions (
  id              uuid primary key default uuid_generate_v4(),
  student_id      uuid not null references users(id),
  topic_id        uuid not null references topics(id),
  started_at      timestamptz not null default now(),
  submitted_at    timestamptz,
  hints_used      int not null default 0,
  time_spent_secs int
);

-- Student graphs (result of a submitted session)
create table student_graphs (
  id                uuid primary key default uuid_generate_v4(),
  session_id        uuid not null references graph_sessions(id) on delete cascade,
  neo4j_graph_id    text not null,
  score_total       float,
  score_breakdown   jsonb,
  novel_edges_valid int default 0,
  merge_eligible    bool default false,
  created_at        timestamptz not null default now()
);

-- RLS policies (basic — tighten per role as needed)
alter table schools         enable row level security;
alter table users           enable row level security;
alter table classes         enable row level security;
alter table class_enrolments enable row level security;
alter table topics          enable row level security;
alter table concept_nodes   enable row level security;
alter table graph_sessions  enable row level security;
alter table student_graphs  enable row level security;
alter table edge_aliases    enable row level security;

-- Students can only read their own sessions
create policy "students_own_sessions" on graph_sessions
  for all using (auth.uid() = student_id);

-- Teachers can see sessions for their topics
create policy "teachers_see_class_sessions" on graph_sessions
  for select using (
    exists (
      select 1 from topics t
      join classes c on c.id = t.class_id
      where t.id = graph_sessions.topic_id
        and c.teacher_id = auth.uid()
    )
  );
