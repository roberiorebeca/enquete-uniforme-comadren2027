# Enquete da cor do uniforme — COMADREN 2027

Site da votação da cor do uniforme para a Confraternização Oficial da COMADREN (Juína, 2027).

**No ar em:** https://enquete.comadren.com.br

## Como funciona

Site estático (HTML/CSS/JS puro, sem framework) que grava os votos direto no Supabase
pelo SDK oficial via CDN. O placar é atualizado ao vivo em todos os navegadores abertos
usando Supabase Realtime.

Cada pessoa informa nome e WhatsApp. O número vira um hash SHA-256 usado como chave
primária da tabela `votes` — votar de novo com o mesmo número **atualiza** o voto
(upsert), não duplica. O nome não é salvo no banco: só é usado localmente na mensagem
de agradecimento.

Não há verificação de posse do número (SMS/WhatsApp OTP). Foi avaliado e descartado por
ser desproporcional para uma enquete interna.

## Estrutura

```
index.html            página única
style.css             estilos
app.js                lógica da votação + integração com o Supabase
images/               banner e as 6 fotos das camisetas
supabase/schema.sql   esquema do banco (referência — já aplicado)
```

## Configuração

As credenciais do Supabase ficam no topo de `app.js`:

- `SUPABASE_URL` — URL do projeto
- `SUPABASE_ANON_KEY` — chave anônima (pública por design; a proteção real vem das
  políticas de RLS da tabela, então pode ficar no código do site)

## Deploy

Hospedado na Vercel, conectado a este repositório. Todo push na branch `main` dispara
um deploy automático — não há build, os arquivos são servidos direto da raiz.
