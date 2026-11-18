-- =====================================================================
-- I-Link MVP — Supabase Storage
-- Private bucket for report images. Files are uploaded by the NestJS backend
-- (service role) after validation; clients receive short-lived signed URLs.
-- Path convention: {user_id}/{report_type}/{report_id}/{uuid}.{ext}
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-attachments', 'report-attachments', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Defense in depth for direct (anon-key) access
create policy "report files: owner read" on storage.objects for select
  using (bucket_id = 'report-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "report files: staff read" on storage.objects for select
  using (bucket_id = 'report-attachments' and public.is_staff());

create policy "report files: owner upload" on storage.objects for insert
  with check (bucket_id = 'report-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
