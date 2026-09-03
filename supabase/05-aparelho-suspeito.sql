-- ===========================================================================
-- PASSO 5 — INVESTIGAR (e, se for o caso, limpar) OS APARELHOS COM MUITOS VOTOS
--
-- ATENÇÃO: aqui não há resposta automática. Um aparelho com 193 votos pode ser
-- fraude OU pode ser um ponto de coleta legítimo (alguém com um tablet
-- cadastrando irmãos no culto). Rode 5.1 a 5.3 e decida com base no que vir.
-- ===========================================================================

-- 5.1 Esses 193 votos são todos da mesma cor? Se sim, é manipulação.
--     Se estiverem espalhados entre as 6 cores, parece coleta legítima.
select choice, count(*) as votos
from public.votes
where device_id = 'cfe0ff13-3e3c-4b49-9bea-1819dbe2b4b0'
group by choice
order by votos desc;


-- 5.2 Qual o ritmo? Votos por hora.
--     Coleta humana num culto tem ritmo irregular e pausas.
--     Script tem intervalos regulares e rajadas.
select date_trunc('hour', updated_at) as hora, count(*) as votos
from public.votes
where device_id = 'cfe0ff13-3e3c-4b49-9bea-1819dbe2b4b0'
group by 1
order by 1;


-- 5.3 Intervalo entre um voto e o seguinte, em segundos.
--     Vários intervalos idênticos = script.
select updated_at,
       extract(epoch from (updated_at - lag(updated_at) over (order by updated_at)))::int as seg_desde_anterior,
       choice
from public.votes
where device_id = 'cfe0ff13-3e3c-4b49-9bea-1819dbe2b4b0'
order by updated_at
limit 60;


-- 5.4 O mesmo para o aparelho de 55 votos.
select choice, count(*) as votos
from public.votes
where device_id = '08028ec1-cbc8-4b4b-95c0-6372a87a24e7'
group by choice
order by votos desc;


-- ===========================================================================
-- 5.5 LIMPEZA — só rode depois de decidir. Mantém o voto MAIS ANTIGO do
--     aparelho e apaga os demais. Faça o backup primeiro.
-- ===========================================================================

-- backup
create table if not exists public.votes_aparelho_backup as
select * from public.votes
where device_id = 'cfe0ff13-3e3c-4b49-9bea-1819dbe2b4b0';

-- confira quantas linhas SERIAM apagadas antes de apagar
select count(*) as seriam_apagadas
from public.votes
where device_id = 'cfe0ff13-3e3c-4b49-9bea-1819dbe2b4b0'
  and voter_hash <> (
    select voter_hash from public.votes
    where device_id = 'cfe0ff13-3e3c-4b49-9bea-1819dbe2b4b0'
    order by updated_at asc
    limit 1
  );

-- a exclusão
delete from public.votes
where device_id = 'cfe0ff13-3e3c-4b49-9bea-1819dbe2b4b0'
  and voter_hash <> (
    select voter_hash from public.votes
    where device_id = 'cfe0ff13-3e3c-4b49-9bea-1819dbe2b4b0'
    order by updated_at asc
    limit 1
  );

-- placar depois
select choice, votos from public.resultados() order by votos desc;
