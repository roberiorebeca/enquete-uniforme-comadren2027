-- ===========================================================================
-- PASSO 7 — VARREDURA: quais outros aparelhos são automatizados?
--
-- O de 193 votos foi confirmado como script pela REGULARIDADE dos intervalos.
-- Esta consulta aplica o mesmo teste a todos os aparelhos de uma vez.
--
-- Como ler:
--   desvio ALTO (dezenas ou centenas) e maior >> mediana  -> humano
--   desvio BAIXO (abaixo de ~15) e maior perto da mediana -> script
-- ===========================================================================

with seq as (
  select device_id,
         extract(epoch from (updated_at - lag(updated_at)
           over (partition by device_id order by updated_at)))::int as gap
  from public.votes
  where device_id is not null
    and device_id <> 'sem-storage'
)
select device_id,
       count(*) + 1                                      as votos,
       percentile_disc(0.50) within group (order by gap)  as mediana_seg,
       min(gap)                                           as menor,
       max(gap)                                           as maior,
       round(stddev_samp(gap)::numeric, 1)                as desvio
from seq
where gap is not null
group by device_id
having count(*) >= 7          -- só aparelhos com 8+ votos têm amostra útil
order by votos desc;


-- ---------------------------------------------------------------------------
-- 7.2 Distribuição por cor dos dois maiores, lado a lado.
--     Mostra o que o script estava tentando eleger.
-- ---------------------------------------------------------------------------
select device_id, choice, count(*) as votos
from public.votes
where device_id in (
  'cfe0ff13-3e3c-4b49-9bea-1819dbe2b4b0',
  '08028ec1-cbc8-4b4b-95c0-6372a87a24e7'
)
group by device_id, choice
order by device_id, votos desc;


-- ---------------------------------------------------------------------------
-- 7.3 Placar com e sem os aparelhos automatizados.
--     Acrescente na lista os device_id que a consulta 7.1 apontar.
-- ---------------------------------------------------------------------------
select choice,
       count(*)                                                  as com_robos,
       count(*) filter (where device_id is distinct from 'cfe0ff13-3e3c-4b49-9bea-1819dbe2b4b0'
                          and device_id is distinct from '08028ec1-cbc8-4b4b-95c0-6372a87a24e7')
                                                                 as sem_robos
from public.votes
group by choice
order by sem_robos desc;


-- ---------------------------------------------------------------------------
-- 7.4 LIMPEZA — só depois de conferir 7.1 e 7.3.
--     Backup primeiro; acrescente os device_id confirmados na lista.
-- ---------------------------------------------------------------------------
-- create table if not exists public.votes_robos_backup as
-- select * from public.votes
-- where device_id in ('cfe0ff13-...', '08028ec1-...');
--
-- delete from public.votes
-- where device_id in ('cfe0ff13-...', '08028ec1-...');
--
-- select choice, votos from public.resultados() order by votos desc;
