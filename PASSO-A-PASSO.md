# Limpar e reabrir com captcha — passo a passo

Ordem exata. Cada passo depende do anterior.

---

## 1. Confirmar a extensão da fraude

No SQL Editor do Supabase, rode `supabase/07-varredura.sql`.

A consulta 7.1 lista todos os aparelhos com 8 ou mais votos. Leia assim:

- `desvio` **abaixo de ~15** e `maior` perto da `mediana` → **script**
- `desvio` **alto** (dezenas ou centenas) e `maior` muito acima da mediana → **humano**

Anote os `device_id` que forem script. A 7.3 mostra o placar com e sem eles.

---

## 2. Limpar

Descomente o bloco 7.4, coloque na lista os `device_id` confirmados, e rode.
Ele faz backup em `votes_robos_backup` antes de apagar.

---

## 3. Criar a widget no Cloudflare Turnstile

1. Acesse `dash.cloudflare.com` e crie uma conta (gratuita, não precisa mover
   o domínio para a Cloudflare).
2. Menu lateral → **Turnstile** → **Add widget**.
3. Widget name: `enquete-comadren`
4. Hostnames: `enquete.comadren.com.br` — e acrescente também o domínio
   `.vercel.app` do projeto, se você testa por lá.
5. Widget Mode: **Managed** (a Cloudflare decide quando desafiar; a maioria
   das pessoas só vê uma marca de confirmação).
6. Create. A tela mostra duas chaves:
   - **Site Key** — pública, vai no `index.html`
   - **Secret Key** — secreta, vai na Vercel. Nunca no código.

---

## 4. Colar a Site Key no site

Em `index.html`, troque:

```html
data-sitekey="SUBSTITUA_PELA_SITE_KEY"
```

pela sua Site Key.

---

## 5. Configurar as variáveis na Vercel

Projeto → **Settings** → **Environment Variables**. Crie as três, marcando
todos os ambientes (Production, Preview, Development):

| Nome | Valor |
|---|---|
| `SUPABASE_URL` | `https://wklggcryshlwqsthyuzl.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** |
| `TURNSTILE_SECRET_KEY` | a Secret Key do passo 3 |

**A service_role key dá poder total sobre o banco.** Ela só pode existir aqui,
nas variáveis da Vercel. Nunca no `app.js`, nunca no repositório — que é
público.

---

## 6. Fechar a escrita no banco

Rode `supabase/08-fechar-escrita.sql`.

A consulta final (8.4) deve mostrar `registrar_voto` **sem** `anon` na coluna
`quem_pode`. Se `anon` ainda aparecer, a escrita continua exposta — não siga
adiante até isso estar certo.

---

## 7. Subir o código

Suba a pasta inteira. Arquivos novos e alterados:

```
api/votar.js      NOVO — a função serverless que valida o captcha
index.html        widget do Turnstile + app.js?v=5
app.js            manda o voto para /api/votar em vez de gravar direto
style.css         estilo da caixa do captcha
```

Espere o deploy ficar verde na Vercel.

---

## 8. Testar antes de divulgar

1. Abra o site com **Ctrl+Shift+R**.
2. O captcha deve aparecer acima do botão. Se não aparecer, a Site Key está
   errada ou o hostname não bate com o cadastrado no passo 3.
3. Vote com um número de teste. Confira a linha no banco: deve ter
   `device_id` com UUID e `ip_hash` preenchido.
4. Tente votar sem completar o captcha — deve recusar.

---

## O que continua verdade depois de tudo isso

O captcha eleva muito o custo do ataque, mas não é uma garantia matemática.
Existem serviços que resolvem captcha por dinheiro. O que a proteção faz é
transformar "escrevi um script numa tarde" em "preciso pagar e ter trabalho" —
o que basta para uma enquete de cor de camiseta.

Se mesmo assim aparecer um novo padrão suspeito, o próximo degrau é a
verificação real de posse do número por SMS ou WhatsApp, que a gente tinha
descartado por ser desproporcional. Depois de duas fraudes, deixou de ser.

Monitore com a 7.1 de vez em quando. É a consulta que pega automação.
