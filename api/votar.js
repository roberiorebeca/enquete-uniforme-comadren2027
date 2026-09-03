// Função serverless da Vercel: única porta de entrada dos votos.
//
// O navegador não escreve mais no Supabase. Ele manda o voto aqui, e esta
// função (1) valida o token do Cloudflare Turnstile, (2) só então chama a
// função registrar_voto no banco, usando a service role key — que fica em
// variável de ambiente na Vercel e nunca chega ao navegador.
//
// Variáveis de ambiente necessárias (Vercel > Settings > Environment Variables):
//   SUPABASE_URL               https://wklggcryshlwqsthyuzl.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  Supabase > Settings > API > service_role (SECRETA)
//   TURNSTILE_SECRET_KEY       Cloudflare > Turnstile > sua widget > Secret Key

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ resultado: "metodo_invalido" });
    return;
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TURNSTILE_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TURNSTILE_SECRET_KEY) {
    console.error("Variáveis de ambiente ausentes na Vercel");
    res.status(500).json({ resultado: "erro_config" });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const { voter_hash, choice, device_id, confirmar, token } = body;

  // IP real de quem votou. A Vercel põe o cliente na primeira posição.
  const fwd = req.headers["x-forwarded-for"] || "";
  const ip = String(fwd).split(",")[0].trim() || null;

  // ---- 1. Validar o token do Turnstile -------------------------------------
  if (!token) {
    res.status(400).json({ resultado: "sem_captcha" });
    return;
  }

  try {
    const verify = await fetch(SITEVERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip || undefined
      })
    });
    const veredito = await verify.json();
    if (!veredito.success) {
      console.warn("Turnstile recusou:", veredito["error-codes"]);
      res.status(403).json({ resultado: "captcha_invalido" });
      return;
    }
  } catch (e) {
    console.error("Falha ao falar com o Turnstile:", e);
    res.status(502).json({ resultado: "captcha_indisponivel" });
    return;
  }

  // ---- 2. Registrar o voto -------------------------------------------------
  try {
    const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/registrar_voto", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: "Bearer " + SUPABASE_SERVICE_ROLE_KEY
      },
      body: JSON.stringify({
        p_voter_hash: voter_hash,
        p_choice: choice,
        p_device_id: device_id,
        p_confirmar: !!confirmar,
        p_ip: ip
      })
    });

    if (!r.ok) {
      const texto = await r.text();
      console.error("Supabase recusou:", r.status, texto);
      res.status(502).json({ resultado: "erro_banco" });
      return;
    }

    const resultado = await r.json();
    res.status(200).json({ resultado: resultado });
  } catch (e) {
    console.error("Falha ao gravar o voto:", e);
    res.status(502).json({ resultado: "erro_banco" });
  }
};
