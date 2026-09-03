-- Esquema da enquete da cor do uniforme COMADREN 2027 — estado final
--
-- Histórico: a versão original tinha políticas de insert/update abertas
-- (`using (true)`). Como a chave anônima é visível no JavaScript do site,
-- alguém escreveu um script e inseriu votos falsos direto na tabela. Desde
-- então toda escrita passa pela função `registrar_voto`, e a tabela não
-- aceita mais escrita direta do público.
--
-- Para aplicar num banco novo, rode este arquivo e depois `03-blindar.sql`.
-- Os arquivos 01/02/03 documentam a resposta ao incidente, na ordem.

create table if not exists public.votes (
  voter_hash text primary key,      -- SHA-256 do WhatsApp, 32 chars hex
  choice     text        not null,  -- uma das 6 cores
  device_id  text,                  -- UUID aleatório do navegador
  ip_hash    text,                  -- md5 do IP + sal, para o limite anti-robô
  updated_at timestamptz not null default now()
);

alter table public.votes enable row level security;

-- Leitura aberta: alimenta o placar em tempo real. Nada aqui identifica
-- pessoa — hash do telefone, id aleatório de navegador e hash de IP.
create policy "leitura publica" on public.votes for select using (true);

-- Sem políticas de insert/update: a escrita acontece só via
-- public.registrar_voto (security definer), definida em 03-blindar.sql.
revoke insert, update on public.votes from anon;

-- Realtime: faz o placar atualizar ao vivo em todos os navegadores abertos.
alter publication supabase_realtime add table public.votes;


-- ---------------------------------------------------------------------------
-- AUDITORIA
-- ---------------------------------------------------------------------------

-- Votos que não poderiam ter vindo do site (formato de hash errado).
-- Depois da blindagem isto deve retornar sempre zero.
-- select count(*) from public.votes where voter_hash !~ '^[0-9a-f]{32}$';

-- Aparelhos que registraram voto com mais de um número.
-- select device_id, count(*) as votos, min(updated_at), max(updated_at)
-- from public.votes
-- where device_id is not null and device_id <> 'sem-storage'
-- group by device_id having count(*) > 1 order by votos desc;

-- Conexões que concentraram muitos votos.
-- select ip_hash, count(*) as votos, min(updated_at), max(updated_at)
-- from public.votes
-- where ip_hash is not null
-- group by ip_hash having count(*) > 5 order by votos desc;
