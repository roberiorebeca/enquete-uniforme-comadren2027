-- ===========================================================================
-- PASSO 2 — MEDIR O ESTRAGO E LIMPAR
-- Rodar as consultas na ordem. NÃO rode o delete antes de olhar o resultado.
-- ===========================================================================

-- 2.1 Quantos votos são reais e quantos foram forjados?
-- Real = hash de 32 caracteres hexadecimais, o formato que o site produz.
select
  count(*) filter (where voter_hash ~ '^[0-9a-f]{32}$') as reais,
  count(*) filter (where voter_hash !~ '^[0-9a-f]{32}$') as forjados,
  count(*)                                              as total
from public.votes;


-- 2.2 Como fica o placar com e sem os forjados?
select
  choice,
  count(*)                                              as total_bruto,
  count(*) filter (where voter_hash ~ '^[0-9a-f]{32}$') as so_reais
from public.votes
group by choice
order by so_reais desc;


-- 2.3 Olhe uma amostra do que será apagado antes de apagar.
select voter_hash, choice, device_id, updated_at
from public.votes
where voter_hash !~ '^[0-9a-f]{32}$'
order by updated_at
limit 50;


-- 2.4 Guarda uma cópia antes de apagar (não custa nada e permite voltar atrás).
create table if not exists public.votes_forjados_backup as
select * from public.votes where voter_hash !~ '^[0-9a-f]{32}$';


-- 2.5 A limpeza. Só rode depois de conferir 2.3.
delete from public.votes
where voter_hash !~ '^[0-9a-f]{32}$';


-- 2.6 Placar final, já limpo.
select choice, count(*) as votos
from public.votes
group by choice
order by votos desc;
