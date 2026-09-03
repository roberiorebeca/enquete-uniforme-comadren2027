-- ===========================================================================
-- PASSO 4 — CORRIGIR O PLACAR (o travamento em 1000)
--
-- Causa: a API do Supabase devolve no máximo 1000 linhas por requisição.
-- O site baixava a tabela inteira e contava no navegador, então a partir do
-- voto 1001 o placar parou de crescer e as proporções ficaram erradas.
--
-- Correção: a contagem passa a ser feita no banco e o site recebe 6 linhas
-- (uma por cor), nunca a tabela inteira. Não há mais teto.
-- ===========================================================================

-- 4.1 Placar: sempre 6 linhas, contagem exata.
create or replace function public.resultados()
returns table (choice text, votos bigint)
language sql
security definer
stable
set search_path = public
as $$
  select v.choice, count(*)::bigint
  from public.votes v
  group by v.choice
$$;

grant execute on function public.resultados() to anon;


-- 4.2 Voto atual de quem já votou (para o "bem-vindo de volta").
create or replace function public.meu_voto(p_voter_hash text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select v.choice from public.votes v where v.voter_hash = p_voter_hash
$$;

grant execute on function public.meu_voto(text) to anon;


-- 4.3 registrar_voto atualizado: passa a checar o aparelho no servidor e a
--     informar se foi voto novo ou troca de voto.
--     Substitui a versão do 03-blindar.sql.
create or replace function public.registrar_voto(
  p_voter_hash text,
  p_choice     text,
  p_device_id  text,
  p_confirmar  boolean default false
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

  -- Aparelho já registrou voto com OUTRO número? Pede confirmação uma vez.
  if not coalesce(p_confirmar, false)
     and p_device_id is not null
     and p_device_id <> 'sem-storage'
     and exists (select 1 from public.votes
                 where device_id = p_device_id
                   and voter_hash <> p_voter_hash)
  then
    return 'aparelho_repetido';
  end if;

  v_ip := coalesce(current_setting('request.headers', true)::json ->> 'cf-connecting-ip', '');
  v_ip_hash := case when v_ip = '' then null else md5(v_ip || public.ip_sal()) end;

  if v_ip_hash is not null then
    select count(distinct voter_hash) into v_recent
    from public.votes
    where ip_hash = v_ip_hash
      and updated_at > now() - interval '1 hour'
      and voter_hash <> p_voter_hash;

    if v_recent >= 20 then
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

grant execute on function public.registrar_voto(text,text,text,boolean) to anon;

-- Remove a assinatura antiga de 3 argumentos, para não ficarem duas versões.
drop function if exists public.registrar_voto(text,text,text);


-- 4.4 Conferência: o número aqui é o verdadeiro, sem teto de 1000.
select choice, votos from public.resultados() order by votos desc;
select count(*) as total_real from public.votes;
