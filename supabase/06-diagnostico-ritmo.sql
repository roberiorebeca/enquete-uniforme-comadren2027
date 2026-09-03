-- ===========================================================================
-- PASSO 6 — AS DUAS CONSULTAS QUE DECIDEM
-- Aparelho: cfe0ff13-3e3c-4b49-9bea-1819dbe2b4b0 (193 votos)
-- ===========================================================================

-- 6.1 DISTRIBUIÇÃO POR COR — a mais decisiva.
--
-- Se 90%+ estiver numa cor só  -> manipulação, sem dúvida.
-- Se estiver espalhado pelas 6 -> coleta legítima de pessoas reais.
select choice,
       count(*) as votos,
       round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
from public.votes
where device_id = 'cfe0ff13-3e3c-4b49-9bea-1819dbe2b4b0'
group by choice
order by votos desc;


-- 6.2 INTERVALO ENTRE VOTOS CONSECUTIVOS, em segundos.
--
-- Humano digitando: mediana entre 20 e 60s, com grande variação —
--   alguns de 10s, outros de vários minutos (conversa, dúvida, troca de pessoa).
-- Script: mediana baixa e MUITO regular, com vários intervalos idênticos,
--   e uma quantidade relevante de intervalos abaixo de 10s.
with seq as (
  select updated_at,
         extract(epoch from (updated_at - lag(updated_at) over (order by updated_at)))::int as gap
  from public.votes
  where device_id = 'cfe0ff13-3e3c-4b49-9bea-1819dbe2b4b0'
)
select
  count(*) filter (where gap is not null)                as intervalos,
  min(gap)                                               as menor,
  percentile_disc(0.25) within group (order by gap)      as q1,
  percentile_disc(0.50) within group (order by gap)      as mediana,
  percentile_disc(0.75) within group (order by gap)      as q3,
  max(gap)                                               as maior,
  count(*) filter (where gap < 10)                       as abaixo_10s,
  count(*) filter (where gap < 5)                        as abaixo_5s
from seq;


-- 6.3 Os intervalos mais repetidos. Se um mesmo valor aparecer dezenas de
--     vezes (ex.: "3 segundos, 47 vezes"), é automação.
with seq as (
  select extract(epoch from (updated_at - lag(updated_at) over (order by updated_at)))::int as gap
  from public.votes
  where device_id = 'cfe0ff13-3e3c-4b49-9bea-1819dbe2b4b0'
)
select gap as intervalo_segundos, count(*) as vezes
from seq
where gap is not null
group by gap
order by vezes desc
limit 10;
