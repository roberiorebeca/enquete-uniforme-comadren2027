-- Esquema da enquete da cor do uniforme COMADREN 2027
-- Já aplicado no projeto Supabase. Mantido aqui como referência / para recriar o banco.

create table if not exists public.votes (
  voter_hash text primary key,
  choice     text        not null,
  device_id  text,
  updated_at timestamptz not null default now()
);

-- RLS habilitado: o acesso é controlado pelas políticas abaixo, não pela chave anônima.
alter table public.votes enable row level security;

create policy "leitura publica"  on public.votes for select using (true);
create policy "insercao publica" on public.votes for insert with check (true);
create policy "update publico"   on public.votes for update using (true) with check (true);

-- Realtime: faz o placar atualizar ao vivo em todos os navegadores abertos.
alter publication supabase_realtime add table public.votes;


-- ---------------------------------------------------------------------------
-- MIGRAÇÃO: marcador de aparelho
-- Rodar no SQL Editor se a tabela já existia sem a coluna device_id.
-- ---------------------------------------------------------------------------
alter table public.votes add column if not exists device_id text;


-- ---------------------------------------------------------------------------
-- AUDITORIA: aparelhos que registraram voto com mais de um número
-- Rodar no SQL Editor do Supabase quando quiser conferir a votação.
-- ---------------------------------------------------------------------------
-- select device_id,
--        count(*)        as votos,
--        min(updated_at) as primeiro,
--        max(updated_at) as ultimo
-- from public.votes
-- where device_id is not null
-- group by device_id
-- having count(*) > 1
-- order by votos desc;
