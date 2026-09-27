alter function public.auditoria_inmutable() set search_path = public;

revoke execute on all functions in schema public from public, anon;

revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.audit_trigger() from authenticated;
revoke execute on function public.equipos_after_insert() from authenticated;
revoke execute on function public.empleados_before_update() from authenticated;
revoke execute on function public.actas_before_insert() from authenticated;
revoke execute on function public.acta_items_before_insert() from authenticated;
revoke execute on function public.actas_before_update() from authenticated;
revoke execute on function public.actas_after_update() from authenticated;

grant execute on function public.is_active(uuid) to authenticated;
grant execute on function public.my_empleado_id() to authenticated;

create policy "Sin acceso directo a tokens" on public.tokens_firma for select to authenticated using (false);