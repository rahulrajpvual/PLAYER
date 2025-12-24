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

-- Create policies (adjust as needed for your auth setup)
create policy "Users can view their own ideas"
on public.story_ideas for select
using ( auth.uid() = user_id );

create policy "Users can insert their own ideas"
on public.story_ideas for insert
with check ( auth.uid() = user_id );

create policy "Users can update their own ideas"
on public.story_ideas for update
using ( auth.uid() = user_id );

create policy "Users can delete their own ideas"
on public.story_ideas for delete
using ( auth.uid() = user_id );
