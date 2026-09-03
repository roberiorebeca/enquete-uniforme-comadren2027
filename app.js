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

  let selectedId = null;
  let currentVotes = []; // array of {voter_hash, choice, device_id}
  let canVote = true;
  let deviceWarningAccepted = false;

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
    voteBtn.disabled = !canVote;
  }

  function showError(text){
    errorMsg.textContent = text;
    errorMsg.hidden = false;
  }
  function hideError(){
    errorMsg.hidden = true;
    errorMsg.textContent = "";
  }

  function computeCounts(votes){
    const counts = {};
    OPTIONS.forEach(function(o){ counts[o.id] = 0; });
    votes.forEach(function(v){
      if (v && counts[v.choice] !== undefined) counts[v.choice]++;
    });
    return counts;
  }

  function renderResults(){
    const counts = computeCounts(currentVotes);
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

  async function loadVotes(){
    const { data, error } = await supabase.from("votes").select("voter_hash,choice,device_id");
    if (error) {
      console.error(error);
      canVote = false;
      unavailableBanner.textContent = "Não foi possível carregar os resultados agora. Tente recarregar a página.";
      unavailableBanner.hidden = false;
      updateSubmitEnabled();
      return;
    }
    currentVotes = data || [];
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

    const name = nameInput.value.trim();
    const phoneDigits = phoneInput.value.replace(/\D/g, "");

    if (!selectedId) { showError("Escolha uma cor antes de confirmar."); return; }
    if (!name) { showError("Escreva seu nome."); return; }
    if (phoneDigits.length < 10) { showError("Informe um WhatsApp válido, com DDD."); return; }

    setSubmitting(true);
    try {
      const key = await hashPhone(phoneDigits);
      const already = currentVotes.some(function(v){ return v.voter_hash === key; });
      const chosenId = selectedId;
      const deviceId = getDeviceId();

      // Este aparelho já votou com OUTRO número? Avisa uma vez e deixa seguir —
      // é legítimo alguém votar pelo celular de outra pessoa.
      const deviceTrackable = deviceId && deviceId !== "sem-storage";
      const otherOnDevice = deviceTrackable && currentVotes.some(function(v){
        return v.device_id === deviceId && v.voter_hash !== key;
      });
      if (otherOnDevice && !deviceWarningAccepted) {
        deviceWarningAccepted = true;
        showError("Este aparelho já registrou um voto com outro número. Se você está votando por outra pessoa, é só confirmar de novo.");
        return;
      }

      // A gravação passa por uma função no banco que valida o formato do hash,
      // a cor e um limite por IP. A tabela não aceita mais escrita direta.
      const { data: resultado, error } = await supabase.rpc("registrar_voto", {
        p_voter_hash: key,
        p_choice: chosenId,
        p_device_id: deviceId
      });

      if (error) { handleSupabaseError(error); return; }

      if (resultado === "limite") {
        showError("Chegaram muitos votos desta conexão em pouco tempo. Aguarde alguns minutos e tente de novo.");
        return;
      }
      if (resultado !== "ok") {
        showError("Não foi possível registrar seu voto. Recarregue a página e tente novamente.");
        return;
      }

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
    const existing = currentVotes.filter(function(v){ return v.voter_hash === key; })[0];
    if (!existing) return;
    const opt = OPTIONS.filter(function(o){ return o.id === existing.choice; })[0];
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
    await loadVotes();
    subscribeRealtime();
    await tryRestoreReturningVoter();
  })();
})();
