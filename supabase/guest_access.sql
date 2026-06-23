drop policy if exists "published quizzes are public to signed in users" on public.quizzes;
drop policy if exists "published quizzes are public" on public.quizzes;
create policy "published quizzes are public"
  on public.quizzes for select
  to anon, authenticated
  using (
    status = 'published'
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "questions follow quiz visibility" on public.questions;
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

drop policy if exists "choices follow question visibility" on public.choices;
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

drop policy if exists "published content is public to signed in users" on public.content_items;
drop policy if exists "published content is public" on public.content_items;
create policy "published content is public"
  on public.content_items for select
  to anon, authenticated
  using (
    status = 'published'
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
