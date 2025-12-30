-- Run this in your Supabase SQL Editor to set up the required table.

create table if not exists public.story_ideas (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  tags text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id)
);

-- Enable Row Level Security (RLS)
alter table public.story_ideas enable row level security;

-- Create policies (Public for "everyone" support as requested)
create policy "Anyone can view ideas"
on public.story_ideas for select
using ( true );

create policy "Anyone can insert ideas"
on public.story_ideas for insert
with check ( true );

create policy "Anyone can update ideas"
on public.story_ideas for update
using ( true );

create policy "Anyone can delete ideas"
on public.story_ideas for delete
using ( true );
