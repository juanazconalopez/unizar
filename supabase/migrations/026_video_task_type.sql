-- Add video tasks to the canonical list while retaining legacy tactical and
-- technical values so existing tasks remain editable and queryable.
alter table public.tasks
  drop constraint if exists tasks_valid_training_type;

alter table public.tasks
  add constraint tasks_valid_training_type
  check (training_type is null or training_type in (
    'Físico', 'Gimnasio', 'Vídeo', 'Táctico', 'Técnico', 'Recuperación', 'Otro'
  ));
