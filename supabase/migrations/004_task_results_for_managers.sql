-- Owners and collaborators need read-only access to player names and task
-- responses in order to review the work they plan. Mutation permissions remain
-- unchanged: collaborators cannot edit or delete another player's result.

create policy "Task managers can read profiles"
on public.profiles
for select
to authenticated
using (
  (select public.current_user_can_manage_tasks())
);

create policy "Task managers can read all results"
on public.task_results
for select
to authenticated
using (
  (select public.current_user_can_manage_tasks())
);
