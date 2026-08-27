-- P0-03 V2: support can_read must never imply mutation authority.
-- V1 already defines public.is_workspace_writer(). This migration adds a
-- restrictive mutation layer to every existing tenant policy that still uses
-- is_workspace_member(), without changing the legacy SELECT semantics.

do $$
declare
  policy_row record;
  role_list text;
  using_expr text;
  check_expr text;
  writer_using text;
  writer_check text;
  policy_suffix text;
begin
  for policy_row in
    select
      n.nspname as schema_name,
      c.relname as table_name,
      p.polname as policy_name,
      p.polcmd as command,
      p.polroles as roles,
      pg_get_expr(p.polqual, p.polrelid) as using_expression,
      pg_get_expr(p.polwithcheck, p.polrelid) as check_expression
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'storage')
      and p.polcmd <> 'r'
      and (
        coalesce(pg_get_expr(p.polqual, p.polrelid), '') like '%is_workspace_member%'
        or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like '%is_workspace_member%'
      )
  loop
    select coalesce(
      string_agg(quote_ident(r.rolname), ', ' order by r.rolname),
      'public'
    )
    into role_list
    from pg_roles r
    where r.oid = any(policy_row.roles);

    using_expr := coalesce(policy_row.using_expression, policy_row.check_expression);
    check_expr := coalesce(policy_row.check_expression, policy_row.using_expression);
    writer_using := replace(using_expr, 'is_workspace_member', 'is_workspace_writer');
    writer_check := replace(check_expr, 'is_workspace_member', 'is_workspace_writer');
    policy_suffix := substr(md5(policy_row.schema_name || ':' || policy_row.table_name || ':' || policy_row.policy_name), 1, 12);

    if policy_row.command in ('*', 'a') and writer_check is not null then
      execute format('drop policy if exists %I on %I.%I', 'p0_03_v2_' || policy_suffix || '_insert', policy_row.schema_name, policy_row.table_name);
      execute format(
        'create policy %I on %I.%I as restrictive for insert to %s with check (%s)',
        'p0_03_v2_' || policy_suffix || '_insert', policy_row.schema_name, policy_row.table_name, role_list, writer_check
      );
    end if;
    if policy_row.command in ('*', 'w') and writer_using is not null and writer_check is not null then
      execute format('drop policy if exists %I on %I.%I', 'p0_03_v2_' || policy_suffix || '_update', policy_row.schema_name, policy_row.table_name);
      execute format(
        'create policy %I on %I.%I as restrictive for update to %s using (%s) with check (%s)',
        'p0_03_v2_' || policy_suffix || '_update', policy_row.schema_name, policy_row.table_name, role_list, writer_using, writer_check
      );
    end if;
    if policy_row.command in ('*', 'd') and writer_using is not null then
      execute format('drop policy if exists %I on %I.%I', 'p0_03_v2_' || policy_suffix || '_delete', policy_row.schema_name, policy_row.table_name);
      execute format(
        'create policy %I on %I.%I as restrictive for delete to %s using (%s)',
        'p0_03_v2_' || policy_suffix || '_delete', policy_row.schema_name, policy_row.table_name, role_list, writer_using
      );
    end if;
  end loop;
end;
$$;
