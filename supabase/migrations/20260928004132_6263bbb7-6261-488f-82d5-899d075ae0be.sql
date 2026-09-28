-- 1. Columnas owner_id
alter table public.empleados add column if not exists owner_id uuid;
alter table public.equipos add column if not exists owner_id uuid;
alter table public.actas add column if not exists owner_id uuid;
alter table public.catalogo_items add column if not exists owner_id uuid;
alter table public.user_roles add column if not exists owner_id uuid;

-- 2. Función de ecosistema
create or replace function public.my_owner_id() returns uuid language sql stable security definer set search_path = public as $$
  select case
    when public.has_role(auth.uid(), 'admin') then auth.uid()
    else (select ur.owner_id from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'auxiliar' limit 1)
  end
$$;

-- 3. Defaults automáticos
alter table public.empleados alter column owner_id set default public.my_owner_id();
alter table public.equipos alter column owner_id set default public.my_owner_id();
alter table public.actas alter column owner_id set default public.my_owner_id();
alter table public.catalogo_items alter column owner_id set default public.my_owner_id();

-- 4. Índices
create index if not exists empleados_owner_idx on public.empleados(owner_id);
create index if not exists equipos_owner_idx on public.equipos(owner_id);
create index if not exists actas_owner_idx on public.actas(owner_id);
create index if not exists catalogo_owner_idx on public.catalogo_items(owner_id);
create index if not exists user_roles_owner_idx on public.user_roles(owner_id);

-- 5. Catálogos únicos por ecosistema
alter table public.catalogo_items drop constraint if exists catalogo_items_tipo_nombre_key;
drop index if exists public.catalogo_items_tipo_nombre_key;
create unique index catalogo_items_tipo_owner_nombre_uq on public.catalogo_items (tipo, owner_id, upper(nombre));

-- 6. Regla: el rol admin solo se asigna por SQL directo
create or replace function public.user_roles_guard_admin() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'admin' and auth.uid() is not null then
    raise exception 'El rol de Administrador solo se asigna directamente en la base de datos.';
  end if;
  return new;
end $$;
drop trigger if exists user_roles_guard_admin on public.user_roles;
create trigger user_roles_guard_admin before insert or update on public.user_roles for each row execute function public.user_roles_guard_admin();

-- 7. Políticas RLS por ecosistema
drop policy if exists "Ver empleados" on public.empleados;
create policy "Ver empleados" on public.empleados for select to authenticated
  using (owner_id = public.my_owner_id() or user_id = auth.uid());
drop policy if exists "Crear empleados" on public.empleados;
create policy "Crear empleados" on public.empleados for insert to authenticated
  with check (public.has_permiso(auth.uid(), 'empleados_editar') and owner_id = public.my_owner_id());
drop policy if exists "Editar empleados" on public.empleados;
create policy "Editar empleados" on public.empleados for update to authenticated
  using (public.has_permiso(auth.uid(), 'empleados_editar') and owner_id = public.my_owner_id());

drop policy if exists "Ver equipos" on public.equipos;
create policy "Ver equipos" on public.equipos for select to authenticated
  using (owner_id = public.my_owner_id() or (empleado_id is not null and empleado_id = public.my_empleado_id()));
drop policy if exists "Crear equipos" on public.equipos;
create policy "Crear equipos" on public.equipos for insert to authenticated
  with check (public.has_permiso(auth.uid(), 'equipos_editar') and owner_id = public.my_owner_id());
drop policy if exists "Editar equipos" on public.equipos;
create policy "Editar equipos" on public.equipos for update to authenticated
  using (public.has_permiso(auth.uid(), 'equipos_editar') and owner_id = public.my_owner_id());

drop policy if exists "Ver actas" on public.actas;
create policy "Ver actas" on public.actas for select to authenticated
  using (owner_id = public.my_owner_id() or empleado_id = public.my_empleado_id());
drop policy if exists "Crear actas" on public.actas;
create policy "Crear actas" on public.actas for insert to authenticated
  with check (tecnico_id = auth.uid() and estado = 'pendiente' and owner_id = public.my_owner_id()
    and ((tipo = 'entrega' and public.has_permiso(auth.uid(), 'actas_entrega')) or (tipo = 'devolucion' and public.has_permiso(auth.uid(), 'actas_devolucion'))));

drop policy if exists "Catalogos visibles" on public.catalogo_items;
create policy "Catalogos visibles" on public.catalogo_items for select to authenticated
  using (owner_id = public.my_owner_id() or owner_id = (select e.owner_id from public.empleados e where e.user_id = auth.uid()));
drop policy if exists "Admin crea catalogos" on public.catalogo_items;
create policy "Admin crea catalogos" on public.catalogo_items for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin') and public.is_active(auth.uid()) and owner_id = auth.uid());
drop policy if exists "Admin edita catalogos" on public.catalogo_items;
create policy "Admin edita catalogos" on public.catalogo_items for update to authenticated
  using (public.has_role(auth.uid(), 'admin') and public.is_active(auth.uid()) and owner_id = auth.uid());
drop policy if exists "Admin elimina catalogos" on public.catalogo_items;
create policy "Admin elimina catalogos" on public.catalogo_items for delete to authenticated
  using (public.has_role(auth.uid(), 'admin') and public.is_active(auth.uid()) and owner_id = auth.uid());

drop policy if exists "Personal ve historial" on public.equipo_historial;
create policy "Personal ve historial" on public.equipo_historial for select to authenticated
  using (exists (select 1 from public.equipos e where e.id = equipo_id and e.owner_id = public.my_owner_id()));

drop policy if exists "Admin ve auditoria" on public.auditoria;
create policy "Admin ve auditoria" on public.auditoria for select to authenticated
  using (public.has_role(auth.uid(), 'admin') and (user_id = auth.uid() or user_id in (select ur.user_id from public.user_roles ur where ur.role = 'auxiliar' and ur.owner_id = auth.uid())));

drop policy if exists "Ver roles propios o admin" on public.user_roles;
create policy "Ver roles propios o admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or owner_id = auth.uid());

drop policy if exists "Ver permisos propios o admin" on public.user_permisos;
create policy "Ver permisos propios o admin" on public.user_permisos for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.user_roles ur where ur.user_id = user_permisos.user_id and ur.role = 'auxiliar' and ur.owner_id = auth.uid()));