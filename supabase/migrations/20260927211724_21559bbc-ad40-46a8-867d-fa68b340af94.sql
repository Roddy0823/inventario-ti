create policy "Personal ve facturas" on storage.objects for select to authenticated
  using (bucket_id = 'facturas' and public.is_staff(auth.uid()));
create policy "Subir facturas con permiso" on storage.objects for insert to authenticated
  with check (bucket_id = 'facturas' and public.has_permiso(auth.uid(),'equipos_editar'));
create policy "Personal ve actas" on storage.objects for select to authenticated
  using (bucket_id = 'actas' and public.is_staff(auth.uid()));