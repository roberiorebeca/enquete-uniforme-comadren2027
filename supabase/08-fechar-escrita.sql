-- ===========================================================================
-- PASSO 8 — FECHAR A ESCRITA DE VEZ
--
-- A partir daqui o navegador não tem NENHUM caminho de escrita no banco.
-- O voto passa pela função /api/votar na Vercel, que valida o Turnstile e
-- só então chama registrar_voto usando a service role key.
--
-- Rodar DEPOIS de já ter rodado 03 e 04.
-- ===========================================================================

-- 8.1 registrar_voto passa a aceitar o IP vindo do servidor.
--     Necessário porque, com a chamada saindo da Vercel, o cabeçalho
--     cf-connecting-ip traria o IP da Vercel, não o de quem votou —
--     e o limite por IP barraria todo mundo.
--     Confiar no p_ip é seguro: só a service role pode chamar esta função.
create or replace function public.registrar_voto(
  p_voter_hash text,
  p_choice     text,
  p_device_id  text,
  p_confirmar  boolean default false,
  p_ip         text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip      text;
  v_ip_hash text;
  v_recent  int;
  v_existia boolean;
begin
  if p_voter_hash is null or p_voter_hash !~ '^[0-9a-f]{32}$' then
    return 'formato_invalido';
  end if;

  if p_choice not in ('orange','blue','green','pink','gold','turquoise') then
    return 'cor_invalida';
  end if;

  if p_device_id is not null and length(p_device_id) > 40 then
    return 'formato_invalido';
  end if;

  if not coalesce(p_confirmar, false)
     and p_device_id is not null
     and p_device_id <> 'sem-storage'
     and exists (select 1 from public.votes
                 where device_id = p_device_id
                   and voter_hash <> p_voter_hash)
  then
    return 'aparelho_repetido';
  end if;

  -- IP vindo do servidor; cai no cabeçalho só se não vier nada.
  v_ip := coalesce(
    nullif(p_ip, ''),
    current_setting('request.headers', true)::json ->> 'cf-connecting-ip',
    ''
  );
  v_ip_hash := case when v_ip = '' then null else md5(v_ip || public.ip_sal()) end;

  -- Teto por IP. Com o Turnstile na frente dá para ser mais generoso:
  -- 40 números distintos por hora acomoda Wi-Fi cheio de evento.
  if v_ip_hash is not null then
    select count(distinct voter_hash) into v_recent
    from public.votes
    where ip_hash = v_ip_hash
      and updated_at > now() - interval '1 hour'
      and voter_hash <> p_voter_hash;

    if v_recent >= 40 then
      return 'limite';
    end if;
  end if;

  select exists (select 1 from public.votes where voter_hash = p_voter_hash)
    into v_existia;

  insert into public.votes (voter_hash, choice, device_id, ip_hash, updated_at)
  values (p_voter_hash, p_choice, p_device_id, v_ip_hash, now())
  on conflict (voter_hash) do update
    set choice     = excluded.choice,
        device_id  = excluded.device_id,
        ip_hash    = excluded.ip_hash,
        updated_at = now();

  return case when v_existia then 'ok_atualizado' else 'ok' end;
end;
$$;


-- 8.2 Tirar do público a permissão de gravar. Só a service role (usada
--     exclusivamente pela função da Vercel) consegue registrar voto.
revoke execute on function public.registrar_voto(text,text,text,boolean)      from anon, public;
revoke execute on function public.registrar_voto(text,text,text,boolean,text) from anon, public;
drop function if exists public.registrar_voto(text,text,text);
drop function if exists public.registrar_voto(text,text,text,boolean);

-- 8.3 Leitura continua liberada — é o placar, e não expõe ninguém.
grant execute on function public.resultados()      to anon;
grant execute on function public.meu_voto(text)    to anon;


-- 8.4 Conferência: registrar_voto NÃO deve aparecer como executável por anon.
select p.proname,
       array(select r.rolname from pg_roles r
             where has_function_privilege(r.rolname, p.oid, 'execute')
               and r.rolname in ('anon','authenticated','service_role')) as quem_pode
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('registrar_voto','resultados','meu_voto');
