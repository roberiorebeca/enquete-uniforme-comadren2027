-- ===========================================================================
-- PASSO 1 — PAUSAR A VOTAÇÃO AGORA
-- Rodar no SQL Editor do Supabase. Leva 1 segundo.
-- A partir daqui ninguém mais grava na tabela: nem o script, nem o site.
-- O placar continua carregando normalmente; só o voto para.
-- ===========================================================================

drop policy if exists "insercao publica" on public.votes;
drop policy if exists "update publico"   on public.votes;

revoke insert, update on public.votes from anon;

-- Confirmação: deve sobrar apenas a política de leitura.
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'votes';
