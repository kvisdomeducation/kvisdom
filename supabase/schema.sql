create type public.user_role as enum ('student', 'admin');
create type public.quiz_status as enum ('draft', 'published');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  first_name text,
  last_name text,
  school text,
  role public.user_role not null default 'student',
  favorite_subject text check (favorite_subject in ('biology', 'physics', 'chemistry', 'math')),
  learning_goal text,
  description text,
  avatar jsonb not null default '{}'::jsonb,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('clip', 'fact', 'file')),
  title text not null,
  description text not null,
  subject text not null check (subject in ('biology', 'physics', 'chemistry', 'math')),
  url text,
  thumbnail_url text,
  thumbnail_position_x integer not null default 50,
  thumbnail_position_y integer not null default 50,
  detail_text text,
  resource_file_name text,
  resource_file_url text,
  status public.quiz_status not null default 'draft',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  subject text not null check (subject in ('biology', 'physics', 'chemistry', 'math')),
  status public.quiz_status not null default 'draft',
  content_id uuid references public.content_items(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  prompt text not null,
  image_url text,
  image_alt text,
  type text not null default 'multiple_choice',
  explanation text,
  points integer not null default 1 check (points > 0),
  order_index integer not null default 0
);

create table public.choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  label text not null,
  is_correct boolean not null default false,
  order_index integer not null default 0
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null default 0,
  max_score integer not null default 0,
  submitted_at timestamptz not null default now()
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  selected_choice_id uuid references public.choices(id),
  is_correct boolean not null default false,
  points_earned integer not null default 0
);

create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null,
  body text not null,
  image_url text,
  audience text not null default 'all' check (audience in ('all', 'student', 'creator')),
  priority text not null default 'normal' check (priority in ('normal', 'high')),
  status public.quiz_status not null default 'draft',
  action_label text,
  action_url text,
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.news_reads (
  news_id uuid not null references public.news_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (news_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.choices enable row level security;
alter table public.attempts enable row level security;
alter table public.answers enable row level security;
alter table public.content_items enable row level security;
alter table public.news_items enable row level security;
alter table public.news_reads enable row level security;

create policy "profiles are readable by signed in users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users can create own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "published quizzes are public"
  on public.quizzes for select
  to anon, authenticated
  using (
    status = 'published'
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "admins manage quizzes"
  on public.quizzes for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "questions follow quiz visibility"
  on public.questions for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = quiz_id
      and (
        q.status = 'published'
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      )
    )
  );

create policy "admins manage questions"
  on public.questions for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "choices follow question visibility"
  on public.choices for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.questions question
      join public.quizzes quiz on quiz.id = question.quiz_id
      where question.id = question_id
      and (
        quiz.status = 'published'
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      )
    )
  );

create policy "admins manage choices"
  on public.choices for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "students read own attempts"
  on public.attempts for select
  to authenticated
  using (student_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "students create own attempts"
  on public.attempts for insert
  to authenticated
  with check (student_id = auth.uid());

create policy "students read own answers"
  on public.answers for select
  to authenticated
  using (
    exists (
      select 1 from public.attempts attempt
      where attempt.id = attempt_id
      and (
        attempt.student_id = auth.uid()
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      )
    )
  );

create policy "students create answers for own attempts"
  on public.answers for insert
  to authenticated
  with check (
    exists (
      select 1 from public.attempts attempt
      where attempt.id = attempt_id
      and attempt.student_id = auth.uid()
    )
  );

create policy "published content is public"
  on public.content_items for select
  to anon, authenticated
  using (
    status = 'published'
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "admins manage content"
  on public.content_items for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "published news is public"
  on public.news_items for select
  to anon, authenticated
  using (
    status = 'published'
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "admins manage news"
  on public.news_items for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "users read own news receipts"
  on public.news_reads for select
  to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "users mark own news receipts"
  on public.news_reads for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users update own news receipts"
  on public.news_reads for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
