/* =====================================================================
   eSails Zonwering Keuzehulp  -  wizard.js  (v2)
   ---------------------------------------------------------------------
   Volledig in de Bootkap-/Jacuzzi-huisstijl: dezelfde esails-* classes,
   dezelfde systeemfont, hetzelfde kleurenpalet (--esails-* tokens) en
   hetzelfde init-/cart-patroon. Gebruikt de gedeelde Bootkap-CSS die al
   op de pagina staat, plus een kleine aanvulling onderaan dit bestand
   (.esails-preview-* + mount-reset) voor de live visualisatie.

   MOUNT: <div id="esails-zonwering-mount"></div>  (eigen id — botst niet)
   CART : form-POST naar /cart/add/<id>/ (quantity) via verborgen iframe.

   TE DOEN: vervang elke "ID_..." en placeholder-prijs door de echte
   Lightspeed product-ID's en prijzen in CONFIG hieronder. Bevestig ook
   REKEN.rolBreedteCm zodra het Soltis-doek gevoerd wordt.
   ===================================================================== */
window.esailsZonweringWizard = (function () {
  "use strict";

  /* -------------------- CONFIGURATIE -------------------- */
  var CONFIG = {
    doek: {
      antraciet: { id: "ID_DOEK_ANTRACIET", naam: "Soltis-gaasdoek — Antraciet", prijs: 24.95, unit: "meter" },
      zwart:     { id: "ID_DOEK_ZWART",     naam: "Soltis-gaasdoek — Zwart",     prijs: 24.95, unit: "meter" },
      ecru:      { id: "ID_DOEK_ECRU",      naam: "Soltis-gaasdoek — Ecru",      prijs: 24.95, unit: "meter" },
      zand:      { id: "ID_DOEK_ZAND",      naam: "Soltis-gaasdoek — Zand",      prijs: 24.95, unit: "meter" },
      grijs:     { id: "ID_DOEK_GRIJS",     naam: "Soltis-gaasdoek — Lichtgrijs", prijs: 24.95, unit: "meter" }
    },
    zuignap:  { id: "314190231",  naam: "Zuignap met lip 50 mm (transparant, M4)", prijs: 1.67, unit: "stuk" },
    zeilring: { id: "260094625", naam: "Zeilring DIN 10 (RVS)",                   prijs: 0.45, unit: "stuk" },
    montageset: { id: "313445757", naam: "Montageset: holpijp + stempel (+ gratis stansblok)", prijs: 59.25, unit: "set" },
    shockcord: { id: "259527665", naam: "Elastisch koord (shockcord) 6 mm", prijs: 0.83, unit: "meter" },
    koordhaak: { id: "259140865", naam: "Musketonhaak 6 mm (nylon, zwart)",     prijs: 0.49, unit: "stuk" },
    zoomband:  { id: "ID_ZOOMBAND", naam: "Zoomband (randversteviging)",          prijs: 1.95, unit: "meter" },
    reiniger:  { id: "259191434", naam: "Serge Ferrari originele doekreiniger", prijs: 28.95, unit: "stuk" }
  };

  var REKEN = {
    zuignapIntervalCm: 50,
    zoomMargeCm: 5,
    rolBreedteCm: 180,          // PLACEHOLDER rolbreedte Soltis — BEVESTIGEN
    koordSpanMargeFactor: 1.15,
    koordHaakInterval: 50
  };

  var DOEKEN = [
    { key: "antraciet", naam: "Antraciet",  hex: "#3a3d40" },
    { key: "zwart",     naam: "Zwart",      hex: "#1f2024" },
    { key: "ecru",      naam: "Ecru",       hex: "#d9cfb8" },
    { key: "zand",      naam: "Zand",       hex: "#c2a878" },
    { key: "grijs",     naam: "Lichtgrijs", hex: "#9a9c9e" }
  ];

  var TOTAL_INPUT_STEPS = 5;
  var RESULT_STEP = 6;

  /* -------------------- STATE -------------------- */
  var state;
  function resetState() {
    state = {
      currentStep: 1,
      toepassing: null,
      breedte: 120,
      hoogte: 100,
      aantal: 1,
      kleur: "antraciet",
      afwerking: null,
      wil_reiniger: false,
      configs: [],      // opgeslagen openingen (raam/balkon configuraties)
      editIndex: -1,    // -1 = nieuwe opening; anders index die we bewerken
      bundle: {}
    };
  }

  /* Maakt een verse draft-config (begin van een nieuwe opening),
     met behoud van de eerder gekozen kleur als prettige default. */
  function nieuweOpening(behoudKleur) {
    state.currentStep = 1;
    state.toepassing = null;
    state.breedte = 120;
    state.hoogte = 100;
    state.aantal = 1;
    state.kleur = behoudKleur || "antraciet";
    state.afwerking = null;
    state.wil_reiniger = false;
    state.editIndex = -1;
  }

  /* Slaat de huidige draft op als config (nieuw of overschrijven bij edit). */
  function slaOpeningOp() {
    var cfg = {
      toepassing: state.toepassing,
      breedte: Math.max(20, state.breedte),
      hoogte: Math.max(20, state.hoogte),
      aantal: Math.max(1, state.aantal),
      kleur: state.kleur,
      afwerking: state.afwerking,
      wil_reiniger: state.wil_reiniger
    };
    if (state.editIndex >= 0 && state.configs[state.editIndex]) {
      state.configs[state.editIndex] = cfg;
    } else {
      state.configs.push(cfg);
    }
    state.editIndex = -1;
  }

  /* Laadt een opgeslagen config terug in de draft om te bewerken. */
  function bewerkOpening(i) {
    var c = state.configs[i];
    if (!c) return;
    state.toepassing = c.toepassing;
    state.breedte = c.breedte;
    state.hoogte = c.hoogte;
    state.aantal = c.aantal;
    state.kleur = c.kleur;
    state.afwerking = c.afwerking;
    state.wil_reiniger = c.wil_reiniger;
    state.editIndex = i;
    state.currentStep = 1;
  }

  /* -------------------- HELPERS -------------------- */
  var root;
  function $(id) { return document.getElementById(id); }
  function money(n) { return n.toFixed(2).replace('.', ','); }
  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function ceilDiv(a, b) { return Math.ceil(a / b); }

  /* -------------------- REKENMODULE -------------------- */
  /* Rekent voor één opening. Zonder argument: de live draft-state.
     Het 'aantal' (meerdere identieke ramen) vermenigvuldigt alle hoeveelheden. */
  function bereken(cfg) {
    var src = cfg || state;
    var b = Math.max(20, src.breedte);
    var h = Math.max(20, src.hoogte);
    var n = Math.max(1, src.aantal || 1);
    var toep = src.toepassing;

    var doekBreedteCm = b + REKEN.zoomMargeCm * 2;
    var doekHoogteCm = h + REKEN.zoomMargeCm * 2;
    var banen = Math.max(1, ceilDiv(doekBreedteCm, REKEN.rolBreedteCm));
    var doekPer = Math.ceil((banen * doekHoogteCm) / 100 * 2) / 2;
    var doekMeters = Math.round(doekPer * n * 2) / 2;
    var omtrekCm = 2 * (b + h);
    var r = { aantal: n, doekMeters: doekMeters, doekPer: doekPer, banen: banen, omtrekCm: omtrekCm };

    if (toep === 'raam') {
      var iv = REKEN.zuignapIntervalCm;
      var zPer = (ceilDiv(b, iv) + ceilDiv(h, iv)) * 2;
      r.zuignappen = zPer * n;
      r.zeilringen = zPer * n;
    } else if (toep === 'balkon') {
      var koordPer = Math.ceil((omtrekCm * REKEN.koordSpanMargeFactor) / 100 * 2) / 2;
      r.koordMeters = Math.round(koordPer * n * 2) / 2;
      var haakPer = ceilDiv(omtrekCm, REKEN.koordHaakInterval);
      r.koordhaken = haakPer * n;
      r.zeilringen = haakPer * n;
      var zoomPer = Math.ceil(omtrekCm / 100 * 2) / 2;
      r.zoombandMeters = Math.round(zoomPer * n * 2) / 2;
    }
    return r;
  }

  /* -------------------- HTML-TEMPLATE -------------------- */
  function wizardHTML() {
    return '' +
    '<div class="esails-wizard-header">' +
      '<h2>Zonwering Keuzehulp</h2>' +
      '<p>Stel in een paar stappen jouw ideale materiaalpakket samen</p>' +
      '<div class="esails-progress-wrapper"><div class="esails-progress-bar" id="ezProgressBar" style="width:20%;"></div></div>' +
      '<div class="esails-step-indicator" id="ezStepIndicator">Stap 1 van 5: Toepassing</div>' +
    '</div>' +

    '<div class="esails-preview" id="ezPreview">' +
      '<div class="esails-preview-label">Live preview</div>' +
      '<div class="esails-preview-canvas" id="ezPreviewCanvas"></div>' +
      '<div class="esails-preview-stats" id="ezPreviewStats"></div>' +
    '</div>' +

    '<div class="esails-wizard-step active" data-step="1">' +
      '<h3>Waar komt je zonwering?</h3>' +
      '<p class="esails-step-subtitle">Dat bepaalt meteen de beste manier om het doek te bevestigen.</p>' +
      '<div class="esails-card-grid esails-grid-2">' +
        cardBadge('toepassing','raam','🪟','Voor een raam','Het doek komt tegen het glas met zuignappen aan de binnenzijde. Geen boren, zo weer weg.','Geen boren','navy') +
        cardBadge('toepassing','balkon','🏙️','Voor een balkon','Het doek spant met elastisch koord langs de spijlen of railing. Beweegt mee met de wind.','Voor railing','navy') +
      '</div>' +
    '</div>' +

    '<div class="esails-wizard-step" data-step="2">' +
      '<h3>Wat zijn de maten van de opening?</h3>' +
      '<p class="esails-step-subtitle">In centimeters. De preview hierboven beweegt direct mee terwijl je sleept.</p>' +
      sliderHTML('breedte','Breedte','cm',30,400,1) +
      sliderHTML('hoogte','Hoogte','cm',30,400,1) +
      sliderHTML('aantal','Aantal van dit formaat','st',1,20,1) +
      '<p class="esails-help-note" id="ezAfmNote"></p>' +
    '</div>' +

    '<div class="esails-wizard-step" data-step="3">' +
      '<h3>Kies de kleur van je gaasdoek</h3>' +
      '<p class="esails-step-subtitle">Serge Ferrari Soltis — open weefsel dat zon en warmte tegenhoudt, maar waar je doorheen kunt kijken. De preview toont je keuze direct.</p>' +
      '<div class="esails-color-grid" id="ezColorGrid">' + kleurKaarten() + '</div>' +
    '</div>' +

    '<div class="esails-wizard-step" data-step="4">' +
      '<h3 id="ezRandTitel">Randafwerking</h3>' +
      '<p class="esails-step-subtitle" id="ezRandSub"></p>' +
      '<div class="esails-card-grid esails-grid-2" id="ezRandCards"></div>' +
    '</div>' +

    '<div class="esails-wizard-step" data-step="5">' +
      '<h3>Handig om mee te bestellen</h3>' +
      '<p class="esails-step-subtitle">Optioneel — houd je zonwering langer mooi.</p>' +
      '<div class="esails-garen-keuze">' +
        '<div class="esails-garen-info"><strong>Serge Ferrari originele doekreiniger toevoegen?</strong>' +
          '<span>Speciaal voor het gaasdoek — reinigt zonder de UV-coating aan te tasten.</span></div>' +
        '<button type="button" class="esails-pill esails-toggle-off" data-toggle="wil_reiniger" id="ezToggleReiniger">Toevoegen</button>' +
      '</div>' +
      '<p class="esails-help-note" id="ezWindNote"></p>' +
    '</div>' +

    '<div class="esails-wizard-step" data-step="6">' +
      '<div class="esails-success-banner">' +
        '<h3>✓ Jouw materiaallijst is klaar!</h3>' +
        '<p>Op basis van je keuzes hebben we het pakket op maat berekend. Je kunt elke opening nog wijzigen, verwijderen, of een raam of balkon toevoegen.</p>' +
      '</div>' +
      '<div class="esails-configuration-board">' +
        '<div class="esails-board-header"><span>Onderdeel</span><span style="text-align:right;">Aantal / Prijs</span></div>' +
        '<div id="ezDynamicLines"></div>' +
        '<div class="esails-board-footer">' +
          '<div class="esails-total-price">Totaalprijs pakket: <span id="ezTotalAmount">€ 0,00</span></div>' +
          '<button type="button" class="esails-btn-submit" id="ezBtnAddToCart">' +
            '<span class="btn-text">Voeg complete pakket toe aan winkelwagen</span>' +
            '<div class="esails-loader" style="display:none;"></div>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="esails-wizard-navigation" id="ezNav">' +
      '<button type="button" class="esails-btn esails-btn-secondary" id="ezBtnPrev" disabled>Vorige</button>' +
      '<button type="button" class="esails-btn esails-btn-primary" id="ezBtnNext" disabled>Volgende</button>' +
    '</div>';
  }

  /* ---------- card-helpers (Bootkap-idioom) ---------- */
  function card(group, val, icon, titel, oms) {
    return '<div class="esails-selection-card" data-group="' + group + '" data-value="' + val + '">' +
      '<span class="esails-badge esails-badge-placeholder">&nbsp;</span>' +
      '<div class="esails-card-icon">' + icon + '</div>' +
      '<h4>' + titel + '</h4><p>' + oms + '</p></div>';
  }
  function cardBadge(group, val, icon, titel, oms, badgeText, badgeType) {
    var badgeCls = (badgeType === 'budget') ? 'esails-badge esails-badge-budget' : 'esails-badge';
    return '<div class="esails-selection-card" data-group="' + group + '" data-value="' + val + '">' +
      '<span class="' + badgeCls + '">' + badgeText + '</span>' +
      '<div class="esails-card-icon">' + icon + '</div>' +
      '<h4>' + titel + '</h4><p>' + oms + '</p></div>';
  }
  function kleurKaarten() {
    var h = '';
    for (var i = 0; i < DOEKEN.length; i++) {
      var d = DOEKEN[i];
      h += '<div class="esails-color-card" data-group="kleur" data-value="' + d.key + '">' +
        '<div class="esails-color-swatch" style="background:' + d.hex + ';"></div>' +
        '<span>' + d.naam + '</span></div>';
    }
    return h;
  }
  function sliderHTML(key, label, unit, min, max, step) {
    return '<div class="esails-slider-wrapper">' +
      '<label>' + label + ': <span id="ezVal_' + key + '">' + state[key] + '</span> ' + unit + '</label>' +
      '<input type="range" id="ezSlider_' + key + '" data-slider="' + key + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + state[key] + '">' +
    '</div>';
  }

  function renderContext() {
    var randCards = $('ezRandCards');
    var randTitel = $('ezRandTitel');
    var randSub = $('ezRandSub');
    var afmNote = $('ezAfmNote');
    var windNote = $('ezWindNote');

    if (state.toepassing === 'raam') {
      if (afmNote) afmNote.innerHTML = '<strong>Meet het glas</strong> dat je wilt afdekken. Tip: dek het raam zo volledig mogelijk af — dat voorkomt temperatuurverschillen in de ruit.';
      if (randTitel) randTitel.innerText = 'Zeilringen plaatsen';
      if (randSub) randSub.innerHTML = 'Bij elke zuignap hoort een zeilring in het doek. Die verdeelt de kracht en voorkomt uitscheuren — we rekenen ze automatisch mee.';
      if (randCards) randCards.innerHTML =
        cardBadge('afwerking','set','🛠️','Montageset erbij','Professionele holpijp + stempel om de zeilringen netjes te zetten. Inclusief gratis stansblok.','Aanrader','navy') +
        card('afwerking','zelf','✅','Ik heb al gereedschap','Sla de montageset over — alleen de zeilringen zelf komen in je pakket.');
      if (windNote) windNote.innerHTML = '<strong>💡 Tip:</strong> maak het glas en de zuignappen vetvrij vóór montage — dan houden ze veel beter vast.';
    } else if (state.toepassing === 'balkon') {
      if (afmNote) afmNote.innerHTML = '<strong>Meet de balkonopening</strong> die je wilt afschermen — van spijl tot spijl, en de hoogte van de railing.';
      if (randTitel) randTitel.innerText = 'Rand verstevigen';
      if (randSub) randSub.innerHTML = 'Langs de rand komen zeilringen waar het koord doorheen loopt. Een zoomband maakt die rand extra sterk — fijn op een winderig balkon.';
      if (randCards) randCards.innerHTML =
        cardBadge('afwerking','zoom','🧵','Met zoomband','Versterkte rand rondom. Steviger bevestigingspunten, langere levensduur.','Aanrader bij wind','navy') +
        card('afwerking','kaal','➖','Zonder zoomband','Zeilringen direct in het doek. Prima voor een luwe plek.');
      if (windNote) windNote.innerHTML = '<strong>💡 Tip:</strong> span het koord niet keihard aan. Een doek dat licht meebeweegt met de wind gaat langer mee dan een doek dat muurvast staat.';
    }
  }

  /* -------------------- PREVIEW (live) -------------------- */
  function previewSVG() {
    var b = Math.max(20, state.breedte);
    var h = Math.max(20, state.hoogte);
    var d = DOEKEN.filter(function (x) { return x.key === state.kleur; })[0] || DOEKEN[0];

    var VW = 220, VH = 220, padding = 34;
    var maxW = VW - padding * 2, maxH = VH - padding * 2;
    var ratio = Math.min(maxW / b, maxH / h);
    var w = b * ratio, hh = h * ratio;
    var x = (VW - w) / 2, y = (VH - hh) / 2;
    var ease = 'transition:all .4s ease;';

    var svg = '<svg viewBox="0 0 ' + VW + ' ' + VH + '" width="100%" style="max-width:200px;display:block;margin:0 auto;">';
    svg += '<defs>' +
      '<filter id="ezShadow" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#0f1c3f" flood-opacity="0.16"/></filter>' +
      '<pattern id="ezMesh" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 0 H5 M0 0 V5" stroke="#000" stroke-width="0.4" opacity="0.18"/></pattern>' +
    '</defs>';

    if (state.toepassing === 'balkon') {
      var spijlen = Math.max(3, Math.round(w / 16));
      for (var s = 0; s <= spijlen; s++) {
        var sx = x + (w * s) / spijlen;
        svg += '<line x1="' + sx.toFixed(1) + '" y1="' + (y - 6) + '" x2="' + sx.toFixed(1) + '" y2="' + (y + hh + 6) + '" stroke="#cfd3d6" stroke-width="2"/>';
      }
      svg += '<line x1="' + (x - 6) + '" y1="' + (y - 6) + '" x2="' + (x + w + 6) + '" y2="' + (y - 6) + '" stroke="#b9bdc0" stroke-width="3"/>';
      svg += '<line x1="' + (x - 6) + '" y1="' + (y + hh + 6) + '" x2="' + (x + w + 6) + '" y2="' + (y + hh + 6) + '" stroke="#b9bdc0" stroke-width="3"/>';
    } else if (state.toepassing === 'raam') {
      svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + hh + '" rx="2" fill="#dce8ee" stroke="#b9c4cb" stroke-width="2" style="' + ease + '"/>';
      svg += '<line x1="' + (x + w / 2) + '" y1="' + y + '" x2="' + (x + w / 2) + '" y2="' + (y + hh) + '" stroke="#cdd6db" stroke-width="2"/>';
      svg += '<line x1="' + x + '" y1="' + (y + hh / 2) + '" x2="' + (x + w) + '" y2="' + (y + hh / 2) + '" stroke="#cdd6db" stroke-width="2"/>';
    }

    var op = (state.toepassing === 'balkon') ? 0.82 : 0.72;
    svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + hh + '" rx="2" fill="' + d.hex + '" opacity="' + op + '" filter="url(#ezShadow)" style="' + ease + '"/>';
    svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + hh + '" rx="2" fill="url(#ezMesh)" style="' + ease + '"/>';

    if (state.toepassing === 'raam') {
      var inset = Math.min(12, w * 0.14, hh * 0.14);
      var ix = x + inset, iy = y + inset, iw = w - inset * 2, ih = hh - inset * 2;
      var nB = Math.max(1, Math.min(5, Math.round(b / 60)));
      var nH = Math.max(1, Math.min(5, Math.round(h / 60)));
      var c, px, py;
      for (c = 0; c <= nB; c++) {
        px = ix + (iw * c) / nB;
        svg += dot(px, iy);
        svg += dot(px, iy + ih);
      }
      for (c = 1; c < nH; c++) {
        py = iy + (ih * c) / nH;
        svg += dot(ix, py);
        svg += dot(ix + iw, py);
      }
    } else if (state.toepassing === 'balkon') {
      var oB = Math.max(2, Math.min(7, Math.round(b / 45)));
      var oH = Math.max(2, Math.min(7, Math.round(h / 45)));
      var o, ox, oy;
      for (o = 0; o <= oB; o++) {
        ox = x + (w * o) / oB;
        svg += oog(ox, y);
        svg += oog(ox, y + hh);
      }
      for (o = 1; o < oH; o++) {
        oy = y + (hh * o) / oH;
        svg += oog(x, oy);
        svg += oog(x + w, oy);
      }
    }

    svg += '</svg>';
    return svg;
  }
  function dot(cx, cy) {
    return '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="3" fill="#ffffff" stroke="#8a8f93" stroke-width="1.3" opacity="0.95"/>';
  }
  function oog(cx, cy) {
    return '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="2.6" fill="#fff" stroke="#5a5042" stroke-width="1.4"/>';
  }

  function renderPreview() {
    var canvas = $('ezPreviewCanvas'); if (!canvas) return;
    canvas.innerHTML = previewSVG();
    var r = bereken();
    var stats = $('ezPreviewStats');
    if (!stats) return;
    var html = '<div class="esails-stat"><small>Afmeting</small><strong>' + Math.max(20, state.breedte) + ' × ' + Math.max(20, state.hoogte) + ' cm</strong></div>' +
               '<div class="esails-stat"><small>Doek nodig</small><strong>' + r.doekMeters.toFixed(1) + ' m</strong></div>';
    if (state.toepassing === 'raam') {
      html += '<div class="esails-stat"><small>Zuignappen</small><strong>' + r.zuignappen + ' st</strong></div>';
    } else if (state.toepassing === 'balkon') {
      html += '<div class="esails-stat"><small>Koord</small><strong>' + r.koordMeters.toFixed(1) + ' m</strong></div>';
    } else {
      html += '<div class="esails-stat"><small>Omtrek</small><strong>' + (r.omtrekCm / 100).toFixed(2) + ' m</strong></div>';
    }
    stats.innerHTML = html;
  }

  /* -------------------- BUNDLE (per opening) -------------------- */
  /* Bouwt de materiaalregels voor één config. Geeft een geordende array. */
  function bouwBundleVoor(cfg) {
    var r = bereken(cfg);
    var doek = CONFIG.doek[cfg.kleur] || CONFIG.doek.antraciet;
    var lijnen = [];
    lijnen.push({ key: 'doek', id: doek.id, naam: doek.naam, notitie: 'UV-werend gaasdoek, op maat te knippen (rafelt niet)', prijs: doek.prijs, qty: r.doekMeters, unit: 'm' });

    if (cfg.toepassing === 'raam') {
      lijnen.push({ key: 'zuignap', id: CONFIG.zuignap.id, naam: CONFIG.zuignap.naam, notitie: 'Houdt het doek strak tegen het glas — geen boren', prijs: CONFIG.zuignap.prijs, qty: r.zuignappen, unit: 'st' });
      lijnen.push({ key: 'zeilring', id: CONFIG.zeilring.id, naam: CONFIG.zeilring.naam, notitie: 'Eén per zuignap — voorkomt uitscheuren', prijs: CONFIG.zeilring.prijs, qty: r.zeilringen, unit: 'st' });
      if (cfg.afwerking === 'set') {
        lijnen.push({ key: 'montageset', id: CONFIG.montageset.id, naam: CONFIG.montageset.naam, notitie: 'Holpijp + stempel om de zeilringen te zetten · gratis stansblok', prijs: CONFIG.montageset.prijs, qty: 1, unit: 'set' });
      }
    } else if (cfg.toepassing === 'balkon') {
      lijnen.push({ key: 'shockcord', id: CONFIG.shockcord.id, naam: CONFIG.shockcord.naam, notitie: 'Spant het doek soepel langs de railing — beweegt mee met de wind', prijs: CONFIG.shockcord.prijs, qty: r.koordMeters, unit: 'm' });
      lijnen.push({ key: 'koordhaak', id: CONFIG.koordhaak.id, naam: CONFIG.koordhaak.naam, notitie: 'Haakt het koord aan de spijlen of railing', prijs: CONFIG.koordhaak.prijs, qty: r.koordhaken, unit: 'st' });
      lijnen.push({ key: 'zeilring', id: CONFIG.zeilring.id, naam: CONFIG.zeilring.naam, notitie: 'Bevestigingspunt in het doek voor het koord', prijs: CONFIG.zeilring.prijs, qty: r.zeilringen, unit: 'st' });
      if (cfg.afwerking === 'zoom') {
        lijnen.push({ key: 'zoomband', id: CONFIG.zoomband.id, naam: CONFIG.zoomband.naam, notitie: 'Versterkt de rand waar de zeilringen komen', prijs: CONFIG.zoomband.prijs, qty: r.zoombandMeters, unit: 'm' });
      }
    }
    if (cfg.wil_reiniger) lijnen.push({ key: 'reiniger', id: CONFIG.reiniger.id, naam: CONFIG.reiniger.naam, notitie: 'Reinigt het gaasdoek zonder de coating aan te tasten', prijs: CONFIG.reiniger.prijs, qty: 1, unit: 'st' });
    return lijnen;
  }

  function openingLabel(cfg, index) {
    var basis = cfg.toepassing === 'balkon' ? 'Balkon' : 'Raam';
    var aantal = cfg.aantal > 1 ? (' · ' + cfg.aantal + '×') : '';
    return basis + ' ' + (index + 1) + ' · ' + cfg.breedte + ' × ' + cfg.hoogte + ' cm' + aantal;
  }

  /* Telt alle producten over alle openingen samen, per product-id. */
  function geaggregeerdeRegels() {
    var map = {};
    var volgorde = [];
    state.configs.forEach(function (cfg) {
      bouwBundleVoor(cfg).forEach(function (ln) {
        if (!map[ln.id]) {
          map[ln.id] = { id: ln.id, naam: ln.naam, prijs: ln.prijs, unit: ln.unit, qty: 0 };
          volgorde.push(ln.id);
        }
        map[ln.id].qty += ln.qty;
      });
    });
    return volgorde.map(function (id) { return map[id]; });
  }

  function formatQty(item) {
    if (item.unit === 'm') return (Math.round(item.qty * 10) / 10).toFixed(1) + ' m';
    if (item.unit === 'set') return item.qty + ' set';
    return String(item.qty);
  }

  /* -------------------- RESULTAAT RENDEREN -------------------- */
  function renderLines() {
    var container = $('ezDynamicLines'); if (!container) return;
    var html = '';

    // Per opening een blok met eigen kop, regels en subtotaal
    state.configs.forEach(function (cfg, idx) {
      var lijnen = bouwBundleVoor(cfg);
      var sub = 0;
      var rows = '';
      lijnen.forEach(function (ln) {
        var lt = ln.qty * ln.prijs; sub += lt;
        rows += '<div class="esails-line-item">' +
          '<div class="esails-line-info"><h5>' + esc(ln.naam) + '</h5><p>' + esc(ln.notitie) + '</p></div>' +
          '<div class="esails-line-controls">' +
            '<div class="esails-line-qty">' + formatQty(ln) + '</div>' +
            '<div class="esails-line-price">€ ' + money(lt) + '</div>' +
          '</div></div>';
      });
      html +=
        '<div class="esails-opening-block">' +
          '<div class="esails-opening-head">' +
            '<span class="esails-opening-title">' + esc(openingLabel(cfg, idx)) + '</span>' +
            '<span class="esails-opening-actions">' +
              '<button type="button" class="esails-opening-edit" data-edit-index="' + idx + '">Wijzig</button>' +
              (state.configs.length > 1 ? '<button type="button" class="esails-opening-remove" data-remove-index="' + idx + '">Verwijder</button>' : '') +
            '</span>' +
          '</div>' +
          rows +
          '<div class="esails-opening-subtotal">Subtotaal: <strong>€ ' + money(sub) + '</strong></div>' +
        '</div>';
    });

    // "Nog een raam/balkon toevoegen"
    html +=
      '<div class="esails-add-opening">' +
        '<button type="button" class="esails-btn esails-btn-secondary" id="ezAddOpening">+ Nog een raam of balkon toevoegen</button>' +
      '</div>';

    container.innerHTML = html;
    calcTotal();
  }

  function calcTotal() {
    var total = 0;
    state.configs.forEach(function (cfg) {
      bouwBundleVoor(cfg).forEach(function (ln) { total += ln.qty * ln.prijs; });
    });
    var el = $('ezTotalAmount');
    if (el) el.textContent = '€ ' + money(total);
  }

  /* -------------------- NAVIGATIE / VALIDATIE -------------------- */
  var STAP_NAMEN = ['Toepassing', 'Afmetingen', 'Doek & kleur', 'Randafwerking', "Extra's", 'Klaar'];
  function stapCompleet(stap) {
    if (stap === 1) return !!state.toepassing;
    if (stap === 2) return state.breedte >= 20 && state.hoogte >= 20;
    if (stap === 3) return !!state.kleur;
    if (stap === 4) return !!state.afwerking;
    if (stap === 5) return true;
    return true;
  }
  function toonStap(stap) {
    var steps = root.querySelectorAll('.esails-wizard-step');
    for (var i = 0; i < steps.length; i++) {
      steps[i].classList.toggle('active', parseInt(steps[i].getAttribute('data-step'), 10) === stap);
    }
    var pct = (stap / TOTAL_INPUT_STEPS) * 100; if (pct > 100) pct = 100;
    var bar = $('ezProgressBar'); if (bar) bar.style.width = pct + '%';
    var ind = $('ezStepIndicator');
    if (ind) ind.innerText = (stap <= TOTAL_INPUT_STEPS)
      ? ('Stap ' + stap + ' van ' + TOTAL_INPUT_STEPS + ': ' + STAP_NAMEN[stap - 1])
      : 'Jouw materiaallijst';

    var prev = $('ezBtnPrev'), next = $('ezBtnNext');
    prev.disabled = (stap === 1);
    if (stap === RESULT_STEP) {
      next.style.display = 'none';
    } else {
      next.style.display = '';
      next.disabled = !stapCompleet(stap);
      next.innerText = (stap === TOTAL_INPUT_STEPS) ? 'Bekijk pakket →' : 'Volgende';
    }
    var prevBox = $('ezPreview');
    if (prevBox) prevBox.style.display = (stap === RESULT_STEP) ? 'none' : '';
    if (stap === RESULT_STEP) renderLines();
  }
  function ga(naarStap) {
    if (naarStap < 1) naarStap = 1;
    if (naarStap > RESULT_STEP) naarStap = RESULT_STEP;
    // Bij het betreden van het resultaat: sla de huidige draft op als opening
    if (naarStap === RESULT_STEP && state.currentStep === TOTAL_INPUT_STEPS) {
      slaOpeningOp();
    }
    state.currentStep = naarStap;
    toonStap(naarStap);
  }

  /* -------------------- EVENTS -------------------- */
  function bindEvents() {
    root.addEventListener('click', function (e) {
      var selCard = e.target.closest('.esails-selection-card, .esails-color-card');
      if (selCard && root.contains(selCard)) {
        var group = selCard.getAttribute('data-group');
        var value = selCard.getAttribute('data-value');
        var was = state[group];
        state[group] = value;
        var siblings = root.querySelectorAll('[data-group="' + group + '"]');
        for (var i = 0; i < siblings.length; i++) siblings[i].classList.remove('selected');
        selCard.classList.add('selected');

        if (group === 'kleur') renderPreview();
        if (group === 'toepassing') {
          if (was !== value) {
            state.afwerking = null;
            var afwSibs = root.querySelectorAll('[data-group="afwerking"]');
            for (var j = 0; j < afwSibs.length; j++) afwSibs[j].classList.remove('selected');
          }
          renderContext();
          renderPreview();
        }
        $('ezBtnNext').disabled = !stapCompleet(state.currentStep);
        return;
      }
      var toggle = e.target.closest('[data-toggle]');
      if (toggle) {
        var k = toggle.getAttribute('data-toggle');
        state[k] = !state[k];
        toggle.classList.toggle('active', state[k]);
        toggle.classList.toggle('esails-toggle-off', !state[k]);
        toggle.innerHTML = state[k] ? '<span class="esails-check">✓</span> Toegevoegd' : 'Toevoegen';
        return;
      }
      var editBtn = e.target.closest('[data-edit-index]');
      if (editBtn) {
        bewerkOpening(parseInt(editBtn.getAttribute('data-edit-index'), 10));
        herstelDraftUI();
        toonStap(1);
        return;
      }
      var removeBtn = e.target.closest('[data-remove-index]');
      if (removeBtn) {
        var ri = parseInt(removeBtn.getAttribute('data-remove-index'), 10);
        state.configs.splice(ri, 1);
        renderLines();
        return;
      }
      if (e.target.closest('#ezAddOpening')) {
        nieuweOpening(state.kleur);
        herstelDraftUI();
        toonStap(1);
        return;
      }
      if (e.target.closest('#ezBtnNext')) { if (!$('ezBtnNext').disabled) ga(state.currentStep + 1); return; }
      if (e.target.closest('#ezBtnPrev')) { ga(state.currentStep - 1); return; }
      if (e.target.closest('#ezBtnAddToCart')) { addToCart(); return; }
    });

    root.addEventListener('input', function (e) {
      var slider = e.target.closest('[data-slider]');
      if (slider) {
        var key = slider.getAttribute('data-slider');
        state[key] = parseInt(slider.value, 10) || 0;
        var valEl = $('ezVal_' + key);
        if (valEl) valEl.textContent = state[key];
        renderPreview();
        $('ezBtnNext').disabled = !stapCompleet(state.currentStep);
      }
    });
  }

  /* -------------------- CART -------------------- */
  function addToCart() {
    var regels = geaggregeerdeRegels().filter(function (r) { return r.qty > 0; });
    if (!regels.length) { alert('Voeg minimaal één product toe.'); return; }
    var placeholder = regels.some(function (r) { return /^ID_/.test(r.id); });
    if (placeholder) {
      alert('Let op: er staan nog placeholder product-ID\'s in de configuratie. Vul de echte Lightspeed-ID\'s in voordat je live gaat.');
      return;
    }
    var btn = $('ezBtnAddToCart');
    var txt = btn.querySelector('.btn-text'), loader = btn.querySelector('.esails-loader');
    btn.disabled = true; if (txt) txt.style.display = 'none'; if (loader) loader.style.display = 'inline-block';

    var iframe = ensureFrame();
    var i = 0;
    function addNext() {
      if (i >= regels.length) { window.location.href = '/cart'; return; }
      var item = regels[i]; i++;
      postOne(iframe, item.id, Math.ceil(item.qty), addNext);
    }
    addNext();
  }
  function ensureFrame() {
    var iframe = document.getElementById('ezCartFrame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'ezCartFrame'; iframe.name = 'ezCartFrame';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }
    return iframe;
  }
  function postOne(iframe, productId, quantity, onDone) {
    var form = document.createElement('form');
    // Lightspeed verwacht het product-ID in het URL-pad: POST /cart/add/<id>/ met veld 'quantity'
    form.method = 'POST'; form.action = '/cart/add/' + productId + '/'; form.target = 'ezCartFrame'; form.style.display = 'none';
    form.appendChild(hidden('quantity', quantity));
    document.body.appendChild(form);
    var done = false;
    function finish() {
      if (done) return; done = true;
      iframe.removeEventListener('load', finish);
      if (form.parentNode) form.parentNode.removeChild(form);
      onDone();
    }
    iframe.addEventListener('load', finish);
    form.submit();
    setTimeout(finish, 1500);
  }
  function hidden(name, value) {
    var input = document.createElement('input');
    input.type = 'hidden'; input.name = name; input.value = value;
    return input;
  }

  /* Zet de zichtbare wizard-UI gelijk aan de huidige draft-state.
     Nodig bij 'nog een opening toevoegen' en bij 'wijzig'. */
  function herstelDraftUI() {
    // Sliders + labels
    ['breedte', 'hoogte', 'aantal'].forEach(function (k) {
      var sl = $('ezSlider_' + k); if (sl) sl.value = state[k];
      var lb = $('ezVal_' + k); if (lb) lb.textContent = state[k];
    });
    // Kaart-selecties (toepassing, kleur, afwerking)
    root.querySelectorAll('.esails-selection-card, .esails-color-card').forEach(function (c) {
      c.classList.remove('selected');
    });
    ['toepassing', 'kleur', 'afwerking'].forEach(function (group) {
      if (!state[group]) return;
      var c = root.querySelector('[data-group="' + group + '"][data-value="' + state[group] + '"]');
      if (c) c.classList.add('selected');
    });
    // Reiniger-toggle
    var tog = $('ezToggleReiniger');
    if (tog) {
      tog.classList.toggle('active', state.wil_reiniger);
      tog.classList.toggle('esails-toggle-off', !state.wil_reiniger);
      tog.innerHTML = state.wil_reiniger ? '<span class="esails-check">✓</span> Toegevoegd' : 'Toevoegen';
    }
    renderContext();
    renderPreview();
  }

  /* -------------------- INIT -------------------- */
  function init() {
    root = $('esails-zonwering-mount');
    if (!root) return false;
    if (root.getAttribute('data-ez-init') === '1') return true;
    root.setAttribute('data-ez-init', '1');
    injectPreviewCSS();
    resetState();
    root.innerHTML = wizardHTML();
    bindEvents();
    var kleurCard = root.querySelector('[data-group="kleur"][data-value="' + state.kleur + '"]');
    if (kleurCard) kleurCard.classList.add('selected');
    renderContext();
    renderPreview();
    toonStap(1);
    return true;
  }

  function injectPreviewCSS() {
    if (document.getElementById('ezPreviewCSS')) return;
    var css =
      '#esails-zonwering-mount,#esails-zonwering-mount *{box-sizing:border-box;}' +
      '#esails-zonwering-mount{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;display:block;max-width:900px;margin:40px auto;padding:30px;background:#ffffff;border:1px solid var(--esails-border,#e2e2e2);border-radius:var(--esails-radius,8px);color:var(--esails-dark,#111);box-shadow:0 4px 20px rgba(0,0,0,0.02);}' +
      '.esails-preview{position:sticky;top:8px;z-index:5;background:var(--esails-light);border:1px solid var(--esails-border);border-radius:var(--esails-radius);padding:16px 20px;margin-bottom:20px;box-shadow:0 6px 16px rgba(0,0,0,0.06);}' +
      '.esails-preview-label{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--esails-muted);font-weight:600;text-align:center;margin-bottom:10px;}' +
      '.esails-preview-canvas{display:flex;justify-content:center;align-items:center;min-height:130px;}' +
      '.esails-preview-stats{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:14px;}' +
      '.esails-stat{flex:1;min-width:110px;max-width:170px;background:#fff;border:1px solid var(--esails-border);border-radius:var(--esails-radius);padding:14px 10px;text-align:center;}' +
      '.esails-stat small{display:block;font-size:12px;color:var(--esails-muted);}' +
      '.esails-stat strong{display:block;font-size:17px;font-weight:600;margin-top:6px;color:var(--esails-dark);}' +
      '.esails-help-note{background:var(--esails-light);border:1px solid var(--esails-border);border-radius:var(--esails-radius);padding:16px 20px;font-size:13.5px;color:var(--esails-muted);line-height:1.6;max-width:600px;margin:8px auto 0;}' +
      '.esails-help-note strong{color:var(--esails-dark);}' +
      /* Opening-blokken op het pakket-scherm */
      '.esails-opening-block{border:1px solid var(--esails-border,#e2e2e2);border-radius:var(--esails-radius,8px);margin-bottom:18px;overflow:hidden;}' +
      '.esails-opening-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 18px;background:var(--esails-light,#f6f6f4);border-bottom:1px solid var(--esails-border,#e2e2e2);}' +
      '.esails-opening-title{font-weight:600;font-size:14.5px;color:var(--esails-dark,#111);}' +
      '.esails-opening-actions{display:flex;gap:8px;flex-shrink:0;}' +
      '.esails-opening-edit,.esails-opening-remove{background:none;border:1px solid var(--esails-border,#ccc);border-radius:6px;padding:5px 12px;font-size:12.5px;cursor:pointer;color:var(--esails-muted,#555);transition:all .15s ease;}' +
      '.esails-opening-edit:hover{border-color:var(--esails-dark,#111);color:var(--esails-dark,#111);}' +
      '.esails-opening-remove:hover{border-color:#c0392b;color:#c0392b;}' +
      '.esails-opening-block .esails-line-item{padding:12px 18px;}' +
      '.esails-line-qty{min-width:64px;text-align:right;font-size:13.5px;color:var(--esails-muted,#555);}' +
      '.esails-line-controls{display:flex;align-items:center;gap:18px;}' +
      '.esails-opening-subtotal{text-align:right;padding:10px 18px;font-size:13px;color:var(--esails-muted,#555);border-top:1px dashed var(--esails-border,#e2e2e2);}' +
      '.esails-opening-subtotal strong{color:var(--esails-dark,#111);font-size:14.5px;}' +
      '.esails-add-opening{margin:6px 0 22px;text-align:center;}' +
      '.esails-add-opening .esails-btn{width:100%;}';
    var style = document.createElement('style');
    style.id = 'ezPreviewCSS'; style.textContent = css;
    document.head.appendChild(style);
  }

  return { init: init, _bereken: bereken, _bouwBundleVoor: bouwBundleVoor, _geaggregeerd: geaggregeerdeRegels, _slaOpeningOp: slaOpeningOp, _nieuweOpening: nieuweOpening, _bewerkOpening: bewerkOpening, _resetState: resetState, _state: function(){return state;} };
})();

(function () {
  function start() { if (window.esailsZonweringWizard.init()) return; }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
    window.addEventListener('load', start);
  } else {
    start();
  }
})();
