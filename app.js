(function(){
  "use strict";

  const SUPABASE_URL = "https://wklggcryshlwqsthyuzl.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndrbGdnY3J5c2hsd3FzdGh5dXpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyMTg2ODksImV4cCI6MjEwMzc5NDY4OX0.IUUEVboUMrxLtOVqJ6NqOJYUmNhLlhQI24eJQPFGgOg";

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const OPTIONS = [
    {id:"orange", name:"Energy Orange", tag:"Energia e ação", hex:"var(--shirt-orange)", img:"images/shirt-orange.jpg"},
    {id:"blue", name:"Luminous Blue", tag:"Foco e estabilidade", hex:"var(--shirt-blue)", img:"images/shirt-blue.jpg"},
    {id:"green", name:"Meadowland Green", tag:"Renovação e natureza", hex:"var(--shirt-green)", img:"images/shirt-green.jpg"},
    {id:"pink", name:"Pop Pink", tag:"Expressão individual", hex:"var(--shirt-pink)", img:"images/shirt-pink.jpg"},
    {id:"gold", name:"Sunshine", tag:"Alegria e leveza", hex:"var(--shirt-gold)", img:"images/shirt-gold.jpg"},
    {id:"turquoise", name:"Turquesa", tag:"Equilíbrio entre azul e verde", hex:"var(--shirt-turquoise)", img:"images/shirt-turquoise.jpg"}
  ];

  const optionsGrid = document.getElementById("optionsGrid");
  const nameInput = document.getElementById("nameInput");
  const phoneInput = document.getElementById("phoneInput");
  const voteForm = document.getElementById("voteForm");
  const voteBtn = document.getElementById("voteBtn");
  const errorMsg = document.getElementById("errorMsg");
  const thanksPanel = document.getElementById("thanksPanel");
  const resultsList = document.getElementById("resultsList");
  const resultsTotal = document.getElementById("resultsTotal");
  const unavailableBanner = document.getElementById("unavailableBanner");
  const returningNote = document.getElementById("returningNote");
  const countdownBox = document.getElementById("countdown");
  const cdLabel = document.getElementById("cdLabel");
  const cdDeadline = document.getElementById("cdDeadline");
  const cdDays = document.getElementById("cdDays");
  const cdHours = document.getElementById("cdHours");
  const cdMin = document.getElementById("cdMin");
  const cdSec = document.getElementById("cdSec");
  const captchaBox = document.querySelector(".captcha-box");
  const resultsTitle = document.getElementById("resultsTitle");
  const resultsHint = document.getElementById("resultsHint");

  let selectedId = null;
  let currentCounts = {}; // {orange: 12, blue: 7, ...} vindo da função resultados()
  let canVote = true;
  let deviceWarningAccepted = false;
  let votacaoEncerrada = false;
  let prazo = null;
  let relogio = null;

  // Identificador aleatório por navegador. Não identifica a pessoa: serve só para
  // detectar votos repetidos vindos do mesmo aparelho. Some se o usuário limpar o
  // navegador ou usar aba anônima — é uma camada de auditoria, não um bloqueio.
  const DEVICE_KEY = "comadren_device";

  function getDeviceId(){
    try {
      let id = localStorage.getItem(DEVICE_KEY);
      if (!id) {
        id = (window.crypto && window.crypto.randomUUID)
          ? window.crypto.randomUUID()
          : "dev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(DEVICE_KEY, id);
      }
      return id;
    } catch(e) {
      // Navegador com armazenamento bloqueado (aba anônima, webview restrito).
      // Grava um valor fixo em vez de null, para diferenciar no banco
      // "código novo, sem storage" de "código velho, sem device_id".
      return "sem-storage";
    }
  }

  function buildOptionCards(){
    optionsGrid.innerHTML = OPTIONS.map(function(o){
      return '<button type="button" class="option-card" data-id="'+o.id+'" role="radio" aria-checked="false" style="--ring-color:'+o.hex+';--card-color:'+o.hex+'">'+
        '<span class="check"></span>'+
        '<img src="'+o.img+'" alt="Camiseta COMADREN 2027 cor '+o.name+'">'+
        '<span class="oname">'+o.name+'</span>'+
        '<span class="otag">'+o.tag+'</span>'+
      '</button>';
    }).join("");
    Array.prototype.forEach.call(optionsGrid.querySelectorAll(".option-card"), function(btn){
      btn.addEventListener("click", function(){
        if(!canVote) return;
        selectOption(btn.getAttribute("data-id"));
      });
    });
  }

  function selectOption(id){
    selectedId = id;
    Array.prototype.forEach.call(optionsGrid.querySelectorAll(".option-card"), function(btn){
      const on = btn.getAttribute("data-id") === id;
      btn.classList.toggle("selected", on);
      btn.setAttribute("aria-checked", on ? "true" : "false");
    });
    updateSubmitEnabled();
  }

  function updateSubmitEnabled(){
    voteBtn.disabled = !canVote || votacaoEncerrada;
  }

  // ---- Encerramento da votação -------------------------------------------
  // O prazo verdadeiro é o do banco: registrar_voto recusa qualquer voto
  // depois dele. O contador abaixo é a versão visível disso.
  // Reserva usada só se a consulta ao banco falhar: 08/09/2026 23:59:59 em
  // Mato Grosso (UTC-4) = 09/09/2026 03:59:59 UTC.
  const PRAZO_RESERVA = "2026-09-09T03:59:59Z";

  async function carregarPrazo(){
    try {
      const { data, error } = await supabase.rpc("enquete_fim");
      if (!error && data) {
        const d = new Date(data);
        if (!isNaN(d.getTime())) { prazo = d; return; }
      }
    } catch(e) { /* cai na reserva */ }
    prazo = new Date(PRAZO_RESERVA);
  }

  function dois(n){ return String(n).padStart(2, "0"); }

  function tiquetaquear(){
    const restante = prazo.getTime() - Date.now();
    if (restante <= 0) { encerrarVotacao(); return; }
    const s = Math.floor(restante / 1000);
    cdDays.textContent  = String(Math.floor(s / 86400));
    cdHours.textContent = dois(Math.floor((s % 86400) / 3600));
    cdMin.textContent   = dois(Math.floor((s % 3600) / 60));
    cdSec.textContent   = dois(s % 60);
  }

  function iniciarContador(){
    cdDeadline.textContent =
      "Encerra em 8 de setembro de 2026, às 23h59 — horário de Mato Grosso.";
    countdownBox.hidden = false;
    tiquetaquear();
    if (relogio) clearInterval(relogio);
    relogio = setInterval(tiquetaquear, 1000);
  }

  function encerrarVotacao(){
    if (votacaoEncerrada) return;
    votacaoEncerrada = true;
    if (relogio) { clearInterval(relogio); relogio = null; }

    countdownBox.hidden = false;
    countdownBox.classList.add("encerrada");
    cdLabel.textContent = "Votação encerrada";
    cdDeadline.textContent =
      "A votação foi encerrada em 8 de setembro de 2026, às 23h59. Obrigado a quem participou!";

    voteForm.querySelectorAll("input, button").forEach(function(el){ el.disabled = true; });
    Array.prototype.forEach.call(optionsGrid.querySelectorAll(".option-card"), function(btn){
      btn.disabled = true;
    });
    if (captchaBox) captchaBox.hidden = true;
    voteBtn.textContent = "Votação encerrada";
    hideError();
    thanksPanel.hidden = true;
    returningNote.hidden = true;

    resultsTitle.textContent = "Resultado final";
    resultsHint.textContent = "Votação encerrada. Estes são os números definitivos.";
  }

  function showError(text){
    errorMsg.textContent = text;
    errorMsg.hidden = false;
  }
  function hideError(){
    errorMsg.hidden = true;
    errorMsg.textContent = "";
  }

  function renderResults(){
    const counts = currentCounts;
    const total = Object.keys(counts).reduce(function(sum,k){ return sum + counts[k]; }, 0);
    const sorted = OPTIONS.slice().sort(function(a,b){ return counts[b.id]-counts[a.id]; });
    resultsList.innerHTML = sorted.map(function(o){
      const c = counts[o.id];
      const pct = total ? Math.round((c/total)*100) : 0;
      return '<div class="result-row">'+
        '<span class="result-name">'+o.name+'</span>'+
        '<div class="result-bar-track"><div class="result-bar-fill" style="width:'+pct+'%;background:'+o.hex+'"></div></div>'+
        '<span class="result-pct">'+pct+'% <span class="result-count">('+c+')</span></span>'+
      '</div>';
    }).join("");
    resultsTotal.textContent = total === 1 ? "1 voto registrado até agora" : (total + " votos registrados até agora");
  }

  async function hashPhone(digits){
    if (window.crypto && window.crypto.subtle) {
      const enc = new TextEncoder().encode("comadren2027|" + digits);
      const buf = await window.crypto.subtle.digest("SHA-256", enc);
      return Array.prototype.map.call(new Uint8Array(buf), function(b){ return b.toString(16).padStart(2,"0"); }).join("").slice(0,32);
    }
    let h = 0;
    const s = "comadren2027|" + digits;
    for (let i=0;i<s.length;i++){ h = (h*31 + s.charCodeAt(i)) | 0; }
    return "fallback" + Math.abs(h);
  }

  function setSubmitting(on){
    voteBtn.textContent = on ? "Enviando..." : "Confirmar meu voto";
    voteBtn.disabled = on || !canVote;
  }

  function showThanks(name, choiceId, wasChange){
    const opt = OPTIONS.filter(function(o){ return o.id === choiceId; })[0];
    thanksPanel.innerHTML = "<strong>" + (wasChange ? "Voto atualizado!" : "Voto registrado!") + "</strong>" +
      "<p>" + (name ? (name + ", seu") : "Seu") + " voto agora é <strong>" + (opt ? opt.name : "") + "</strong>. Obrigado por participar" + (wasChange ? " de novo" : "") + "!</p>";
    thanksPanel.hidden = false;
  }

  function handleSupabaseError(err){
    console.error(err);
    showError("Não foi possível registrar seu voto agora. Verifique sua conexão e tente novamente.");
  }

  // A contagem é feita no banco e volta em 6 linhas, uma por cor.
  // Baixar a tabela inteira não funcionava: a API do Supabase devolve no
  // máximo 1000 linhas por requisição, então o placar congelava em 1000.
  async function loadVotes(){
    const { data, error } = await supabase.rpc("resultados");
    if (error) {
      console.error(error);
      canVote = false;
      unavailableBanner.textContent = "Não foi possível carregar os resultados agora. Tente recarregar a página.";
      unavailableBanner.hidden = false;
      updateSubmitEnabled();
      return;
    }
    const counts = {};
    OPTIONS.forEach(function(o){ counts[o.id] = 0; });
    (data || []).forEach(function(r){
      if (r && counts[r.choice] !== undefined) counts[r.choice] = Number(r.votos) || 0;
    });
    currentCounts = counts;
    renderResults();
  }

  function subscribeRealtime(){
    supabase
      .channel("votes-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, function(){
        loadVotes();
      })
      .subscribe();
  }

  async function onSubmit(e){
    e.preventDefault();
    hideError();
    thanksPanel.hidden = true;

    if (votacaoEncerrada) {
      showError("A votação já foi encerrada.");
      return;
    }

    const name = nameInput.value.trim();
    const phoneDigits = phoneInput.value.replace(/\D/g, "");

    if (!selectedId) { showError("Escolha uma cor antes de confirmar."); return; }
    if (!name) { showError("Escreva seu nome."); return; }
    if (phoneDigits.length < 10) { showError("Informe um WhatsApp válido, com DDD."); return; }

    setSubmitting(true);
    try {
      const key = await hashPhone(phoneDigits);
      const chosenId = selectedId;
      const deviceId = getDeviceId();

      // Token do Turnstile: prova de que quem está enviando é um navegador
      // com uma pessoa atrás, não um script. Vale 5 minutos e só uma vez.
      const token = (window.turnstile && window.turnstile.getResponse()) || "";
      if (!token) {
        showError("Confirme a verificação de segurança logo acima do botão e tente novamente.");
        return;
      }

      // O navegador não escreve mais no banco. Manda o voto para /api/votar,
      // que valida o token no servidor e só então grava.
      let resultado = null;
      try {
        const resposta = await fetch("/api/votar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voter_hash: key,
            choice: chosenId,
            device_id: deviceId,
            confirmar: deviceWarningAccepted,
            token: token
          })
        });
        const corpo = await resposta.json();
        resultado = corpo && corpo.resultado;
      } catch (err) {
        handleSupabaseError(err);
        return;
      } finally {
        // O token é de uso único: sempre renova, deu certo ou não.
        if (window.turnstile) window.turnstile.reset();
      }

      // O banco é a autoridade sobre o prazo: se ele disse que acabou, acabou,
      // mesmo que o relógio do aparelho de quem vota esteja atrasado.
      if (resultado === "encerrada") {
        encerrarVotacao();
        showError("A votação foi encerrada. Seu voto não pôde ser registrado.");
        return;
      }
      if (resultado === "sem_captcha" || resultado === "captcha_invalido") {
        showError("A verificação de segurança expirou. Refaça a verificação e confirme de novo.");
        return;
      }
      if (resultado === "captcha_indisponivel" || resultado === "erro_banco" || resultado === "erro_config") {
        showError("Não foi possível registrar seu voto agora. Tente novamente em alguns instantes.");
        return;
      }

      // Aparelho já votou com OUTRO número: avisa uma vez e deixa seguir —
      // é legítimo alguém votar pelo celular de outra pessoa.
      if (resultado === "aparelho_repetido") {
        deviceWarningAccepted = true;
        showError("Este aparelho já registrou um voto com outro número. Se você está votando por outra pessoa, é só confirmar de novo.");
        return;
      }
      if (resultado === "limite") {
        showError("Chegaram muitos votos desta conexão em pouco tempo. Aguarde alguns minutos e tente de novo.");
        return;
      }
      if (resultado !== "ok" && resultado !== "ok_atualizado") {
        showError("Não foi possível registrar seu voto. Recarregue a página e tente novamente.");
        return;
      }

      const already = (resultado === "ok_atualizado");

      try {
        localStorage.setItem("comadren_voter", JSON.stringify({name: name, phone: phoneDigits}));
      } catch(e) { /* ignore */ }

      nameInput.value = "";
      phoneInput.value = "";
      Array.prototype.forEach.call(optionsGrid.querySelectorAll(".option-card"), function(btn){
        btn.classList.remove("selected");
        btn.setAttribute("aria-checked", "false");
      });
      selectedId = null;

      deviceWarningAccepted = false; // próximo número neste aparelho recebe o aviso de novo

      await loadVotes();
      showThanks(name, chosenId, already);
    } catch(err) {
      handleSupabaseError(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function tryRestoreReturningVoter(){
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem("comadren_voter") || "null"); } catch(e){ saved = null; }
    if (!saved || !saved.phone) return;
    const key = await hashPhone(saved.phone);
    const { data: escolha, error } = await supabase.rpc("meu_voto", { p_voter_hash: key });
    if (error || !escolha) return;
    const opt = OPTIONS.filter(function(o){ return o.id === escolha; })[0];
    nameInput.value = saved.name || "";
    phoneInput.value = saved.phone || "";
    if (opt) {
      selectOption(opt.id);
      returningNote.textContent = "Bem-vindo(a) de volta! Seu voto atual é " + opt.name + ". Pode trocar se mudou de ideia.";
      returningNote.hidden = false;
    }
  }

  (async function init(){
    buildOptionCards();
    voteForm.addEventListener("submit", onSubmit);
    await carregarPrazo();
    if (Date.now() >= prazo.getTime()) {
      encerrarVotacao();
    } else {
      iniciarContador();
    }
    await loadVotes();
    subscribeRealtime();
    if (!votacaoEncerrada) await tryRestoreReturningVoter();
  })();
})();
