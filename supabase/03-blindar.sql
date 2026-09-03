-- ===========================================================================
-- PASSO 3 — BLINDAR A GRAVAÇÃO
-- Toda escrita passa a acontecer dentro de uma função no banco, que valida
-- o que recebe. A tabela em si fica sem permissão de escrita para o público.
-- Rodar inteiro no SQL Editor do Supabase.
-- ===========================================================================

-- 3.1 Coluna para o limite por IP.
-- Guardamos o IP em hash (md5 com sal), nunca em texto puro: dá para contar
-- repetição sem armazenar dado pessoal identificável.
alter table public.votes add column if not exists ip_hash text;

-- TROQUE o sal abaixo por qualquer frase sua antes de rodar.
-- Ele não pode mudar depois, ou o histórico de contagem se perde.
create or replace function public.ip_sal() returns text
language sql immutable as $$ select 'troque-esta-frase-comadren-2027' $$;


-- 3.2 A função de registro de voto.
create or replace function public.registrar_voto(
  p_voter_hash text,
  p_choice     text,
  p_device_id  text
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
begin
  -- Formato do hash: exatamente o que o site gera. Mata o script atual.
  if p_voter_hash is null or p_voter_hash !~ '^[0-9a-f]{32}$' then
    return 'formato_invalido';
  end if;

  -- Só as seis cores existem.
  if p_choice not in ('orange','blue','green','pink','gold','turquoise') then
    return 'cor_invalida';
  end if;

  if p_device_id is not null and length(p_device_id) > 40 then
    return 'formato_invalido';
  end if;

  v_ip := coalesce(
    current_setting('request.headers', true)::json ->> 'cf-connecting-ip',
    ''
  );
  v_ip_hash := case when v_ip = '' then null
                    else md5(v_ip || public.ip_sal()) end;

  -- Limite anti-robô: no máximo 20 números diferentes por IP por hora.
  -- Generoso para Wi-Fi compartilhado, apertado para script.
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

  insert into public.votes (voter_hash, choice, device_id, ip_hash, updated_at)
  values (p_voter_hash, p_choice, p_device_id, v_ip_hash, now())
  on conflict (voter_hash) do update
    set choice     = excluded.choice,
        device_id  = excluded.device_id,
        ip_hash    = excluded.ip_hash,
        updated_at = now();

  return 'ok';
end;
$$;

grant execute on function public.registrar_voto(text,text,text) to anon;


-- 3.3 Garantir que a escrita direta continua fechada.
-- (o passo 1 já removeu as políticas; isto é só conferência)
drop policy if exists "insercao publica" on public.votes;
drop policy if exists "update publico"   on public.votes;
revoke insert, update on public.votes from anon;

-- A leitura continua aberta — é ela que alimenta o placar em tempo real.
-- Nada na tabela identifica pessoa: hash do telefone, id aleatório de
-- navegador e hash do IP.


-- 3.4 Conferência final: deve listar só a política de leitura.
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'votes';
