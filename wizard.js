/*!
 * eSails Keuzehulp — Zonwering maken
 * Mount-id : esails-zonwering-mount
 * Namespace: window.esailsZonweringWizard
 * Prefix   : ez
 * Repo     : github.com/aivergelijker/keuzehulp-zonwering
 * CDN      : https://cdn.jsdelivr.net/gh/aivergelijker/keuzehulp-zonwering@v1/wizard.js
 *
 * PLAATSING (identiek aan Bootkap- en Jacuzzi-tool):
 *   1. Push dit bestand als wizard.js naar de GitHub-repo hierboven.
 *   2. Maak een versioned release tag aan (v1, v2, …) — gebruik NOOIT @main.
 *   3. CMS-pagina bevat alleen: <div id="esails-zonwering-mount"></div>
 *   4. Custom JavaScript-veld in Lightspeed:
 *        <script>
 *          if (document.getElementById('esails-zonwering-mount')) {
 *            var s = document.createElement('script');
 *            s.src = 'https://cdn.jsdelivr.net/gh/aivergelijker/keuzehulp-zonwering@v1/wizard.js';
 *            document.head.appendChild(s);
 *          }
 *        </script>
 *   5. Bij update: nieuwe tag aanmaken (v2, v3…) + versienummer in bovenstaande
 *      src aanpassen. Geen cache om te purgen.
 *
 * Vanilla JS (ES5-stijl IIFE). Geen build-step. Hergebruikt de gedeelde
 * esails- CSS-classes; injecteert alleen eigen preview-/container-basis.
 */
window.esailsZonweringWizard = (function () {
  "use strict";

  /* =========================================================================
   * CONFIG — product-ID's en prijzen. Vervang elke "ID_..." door het echte
   * Lightspeed variant-ID. Prijzen incl. btw, per verkoopeenheid.
   * Eenheid: "m" = per (halve) meter, "stuk" = per heel stuk.
   * ===================================================================== */
  var CONFIG = {
    // --- DOEK: Serge Ferrari Soltis-gaasdoek (open, UV-werend) -------------
    // Nog te voeren door eSails. Kleuren + ID's hieronder zijn placeholders.
    // rolBreedteCm staat in REKEN (bepaalt de meterberekening).
    doek: {
      eenheid: "m",
      prijs: 24.95, // PLACEHOLDER meterprijs Soltis-gaasdoek
      kleuren: [
        // naam, hex-swatch (voor preview), variant-ID
        { key: "antraciet", naam: "Antraciet", hex: "#3a3d40", id: "ID_DOEK_ANTRACIET" },
        { key: "zwart",     naam: "Zwart",     hex: "#1b1b1b", id: "ID_DOEK_ZWART" },
        { key: "ecru",      naam: "Ecru",      hex: "#d9cfb8", id: "ID_DOEK_ECRU" },
        { key: "zand",      naam: "Zand",      hex: "#c2a878", id: "ID_DOEK_ZAND" },
        { key: "grijs",     naam: "Lichtgrijs",hex: "#9a9c9e", id: "ID_DOEK_GRIJS" }
      ]
    },

    // --- ZUIGNAP-SYSTEEM (raam) -------------------------------------------
    // Echte eSails-data: zuignap met lip 50 mm transparant M4 (HZG1262TR).
    zuignap: { eenheid: "stuk", prijs: 1.67, id: "ID_ZUIGNAP_50MM" },
    // DIN 10 RVS zeilring/zeilkous — "vaak samen gekocht" op de zuignappagina.
    zeilring: { eenheid: "stuk", prijs: 0.45, id: "ID_ZEILRING_DIN10" },
    // Zeilringtang/montageset (eenmalig). Optioneel, default uit.
    zeilringTang: { eenheid: "stuk", prijs: 12.95, id: "ID_ZEILRING_TANG" },

    // --- KOORD-SYSTEEM (balkon/railing) -----------------------------------
    shockcord: { eenheid: "m", prijs: 1.35, id: "ID_SHOCKCORD_PER_M" }, // per meter
    koordhaak: { eenheid: "stuk", prijs: 0.85, id: "ID_KOORDHAAK" },    // haken aan uiteinden/spijlen

    // --- GEDEELD / EXTRA'S -------------------------------------------------
    zoomband:  { eenheid: "m", prijs: 1.95, id: "ID_ZOOMBAND_PER_M" },  // randversteviging
    opbergtas: { eenheid: "stuk", prijs: 9.95, id: "ID_OPBERGTAS" },
    reiniger:  { eenheid: "stuk", prijs: 12.95, id: "ID_REINIGER" }
  };

  /* =========================================================================
   * REKEN — alle rekenconstanten. Finetune hier zonder de logica te raken.
   * ===================================================================== */
  var REKEN = {
    zuignapIntervalCm: 50,   // 1 zuignap per 50 cm (concurrent-norm)
    zoomMargeCm: 5,          // extra doek rondom voor zoom/afwerking (per zijde)
    rolBreedteCm: 180,       // PLACEHOLDER rolbreedte Soltis-gaasdoek — BEVESTIGEN
    koordSpanMargeFactor: 1.15, // koord = omtrek × deze factor (spanning/knopen)
    koordHaakInterval: 50,   // 1 haak per 50 cm langs de railing
    doekAfrondStapM: 0.5,    // doek per halve meter
    koordAfrondStapM: 0.5    // koord per halve meter
  };

  /* =========================================================================
   * STATE
   * ===================================================================== */
  var state;
  function resetState() {
    state = {
      stap: 1,
      toepassing: null,      // "raam" | "balkon"
      breedte: 120,          // cm
      hoogte: 100,           // cm
      kleur: null,           // key uit CONFIG.doek.kleuren
      zeilringTang: false,   // raam-extra
      zoomband: false,       // balkon-extra (randversteviging)
      opbergtas: false,
      reiniger: false,
      qty: {},               // override-aantallen per regel-key (na bewerken)
      locked: {}             // welke regels handmatig zijn aangepast (niet herberekenen)
    };
  }
  resetState();

  var TOTAAL_STAPPEN = 6; // 5 keuzestappen + resultaat

  /* =========================================================================
   * HELPERS
   * ===================================================================== */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function money(n) {
    return "\u20ac\u00a0" + (Math.round(n * 100) / 100).toFixed(2).replace(".", ",");
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function ceilDiv(a, b) { return Math.ceil(a / b); }
  function roundUpTo(value, step) { return Math.ceil(value / step) * step; }

  /* =========================================================================
   * bereken() — kern van de rekenmodule. Geeft een object met alle
   * berekende aantallen, op basis van de huidige state.
   * ===================================================================== */
  function bereken() {
    var b = Math.max(20, state.breedte);
    var h = Math.max(20, state.hoogte);

    // Doek: opening + zoommarge rondom, in m², vertaald naar strekkende meters
    // van de rol. We rekenen het benodigde aantal "banen" × hoogte.
    var doekBreedteCm = b + REKEN.zoomMargeCm * 2;
    var doekHoogteCm = h + REKEN.zoomMargeCm * 2;
    var banen = Math.max(1, ceilDiv(doekBreedteCm, REKEN.rolBreedteCm));
    var doekMeters = roundUpTo((banen * doekHoogteCm) / 100, REKEN.doekAfrondStapM);

    // Omtrek van de opening (voor zeilringen langs alle zijden / koordlengte)
    var omtrekCm = 2 * (b + h);

    var res = {
      doekMeters: doekMeters,
      banen: banen,
      omtrekCm: omtrekCm
    };

    if (state.toepassing === "raam") {
      // Zuignappen: ceil(b/interval) + ceil(h/interval), × 2 (beide richtingen)
      var iv = REKEN.zuignapIntervalCm;
      var perBreedte = ceilDiv(b, iv);
      var perHoogte = ceilDiv(h, iv);
      var aantalZuignappen = (perBreedte + perHoogte) * 2;
      res.zuignappen = aantalZuignappen;
      res.zeilringen = aantalZuignappen; // 1-op-1: altijd een zeilring per zuignap
    } else if (state.toepassing === "balkon") {
      // Koord: omtrek × spanmarge, in meters, afgerond
      var koordM = roundUpTo((omtrekCm * REKEN.koordSpanMargeFactor) / 100, REKEN.koordAfrondStapM);
      res.koordMeters = koordM;
      // Haken langs de railing (boven- en onderzijde + zijkanten ~ omtrek)
      res.koordhaken = ceilDiv(omtrekCm, REKEN.koordHaakInterval);
      // Zeilringen in het doek waar het koord doorheen/aanhaakt = aantal haken
      res.zeilringen = res.koordhaken;
    }

    return res;
  }

  /* =========================================================================
   * bouwBundle() — vertaalt bereken() + keuzes naar een lijst materiaalregels.
   * Elke regel: { key, naam, functie, eenheid, prijs, aantal, id }
   * ===================================================================== */
  function bouwBundle() {
    var r = bereken();
    var lijnen = [];
    var kleur = getKleur();

    // 1) Doek (altijd)
    lijnen.push({
      key: "doek",
      naam: "Serge Ferrari Soltis-gaasdoek" + (kleur ? " \u2014 " + kleur.naam : ""),
      functie: "Het UV-werende zonweringsdoek, op maat te knippen (rafelt niet).",
      eenheid: "m",
      prijs: CONFIG.doek.prijs,
      aantal: r.doekMeters,
      id: kleur ? kleur.id : "ID_DOEK"
    });

    if (state.toepassing === "raam") {
      // 2) Zuignappen
      lijnen.push({
        key: "zuignap",
        naam: "Zuignap met lip 50 mm (transparant, M4)",
        functie: "Houdt het doek strak tegen het glas \u2014 geen boren nodig.",
        eenheid: "stuk",
        prijs: CONFIG.zuignap.prijs,
        aantal: r.zuignappen,
        id: CONFIG.zuignap.id
      });
      // 3) Zeilringen (1 per zuignap)
      lijnen.push({
        key: "zeilring",
        naam: "Zeilring DIN 10 (RVS)",
        functie: "Verdeelt de kracht rond elk gat \u2014 voorkomt uitscheuren. \u00c9\u00e9n per zuignap.",
        eenheid: "stuk",
        prijs: CONFIG.zeilring.prijs,
        aantal: r.zeilringen,
        id: CONFIG.zeilring.id
      });
      // 4) Zeilringtang (optioneel)
      if (state.zeilringTang) {
        lijnen.push({
          key: "zeilringTang",
          naam: "Zeilring-montageset met tang",
          functie: "Eenmalig gereedschap om de zeilringen netjes te zetten.",
          eenheid: "stuk",
          prijs: CONFIG.zeilringTang.prijs,
          aantal: 1,
          id: CONFIG.zeilringTang.id
        });
      }
    } else if (state.toepassing === "balkon") {
      // 2) Shockcord
      lijnen.push({
        key: "shockcord",
        naam: "Elastisch koord (shockcord)",
        functie: "Spant het doek soepel langs de railing \u2014 beweegt mee met de wind.",
        eenheid: "m",
        prijs: CONFIG.shockcord.prijs,
        aantal: r.koordMeters,
        id: CONFIG.shockcord.id
      });
      // 3) Koordhaken
      lijnen.push({
        key: "koordhaak",
        naam: "Koordhaak",
        functie: "Haakt het koord aan de spijlen of railing.",
        eenheid: "stuk",
        prijs: CONFIG.koordhaak.prijs,
        aantal: r.koordhaken,
        id: CONFIG.koordhaak.id
      });
      // 4) Zeilringen in het doek
      lijnen.push({
        key: "zeilring",
        naam: "Zeilring DIN 10 (RVS)",
        functie: "Bevestigingspunt in het doek voor het koord. Voorkomt uitscheuren.",
        eenheid: "stuk",
        prijs: CONFIG.zeilring.prijs,
        aantal: r.zeilringen,
        id: CONFIG.zeilring.id
      });
      // 5) Zoomband (optioneel randversteviging)
      if (state.zoomband) {
        lijnen.push({
          key: "zoomband",
          naam: "Zoomband (randversteviging)",
          functie: "Versterkt de rand waar de zeilringen komen \u2014 extra stevig bij wind.",
          eenheid: "m",
          prijs: CONFIG.zoomband.prijs,
          aantal: roundUpTo(r.omtrekCm / 100, REKEN.doekAfrondStapM),
          id: CONFIG.zoomband.id
        });
      }
    }

    // Gedeelde extra's
    if (state.opbergtas) {
      lijnen.push({
        key: "opbergtas",
        naam: "Opbergtas",
        functie: "Bewaart het doek netjes in het seizoen dat je het niet gebruikt.",
        eenheid: "stuk",
        prijs: CONFIG.opbergtas.prijs,
        aantal: 1,
        id: CONFIG.opbergtas.id
      });
    }
    if (state.reiniger) {
      lijnen.push({
        key: "reiniger",
        naam: "Doekreiniger",
        functie: "Houdt het gaasdoek schoon zonder de coating aan te tasten.",
        eenheid: "stuk",
        prijs: CONFIG.reiniger.prijs,
        aantal: 1,
        id: CONFIG.reiniger.id
      });
    }

    // Override met handmatig aangepaste aantallen
    for (var i = 0; i < lijnen.length; i++) {
      var ln = lijnen[i];
      if (state.locked[ln.key] && typeof state.qty[ln.key] === "number") {
        ln.aantal = state.qty[ln.key];
      }
    }
    return lijnen;
  }

  function getKleur() {
    if (!state.kleur) return null;
    for (var i = 0; i < CONFIG.doek.kleuren.length; i++) {
      if (CONFIG.doek.kleuren[i].key === state.kleur) return CONFIG.doek.kleuren[i];
    }
    return null;
  }

  /* =========================================================================
   * HTML-helpers (card, badge, kleurkaarten, slider)
   * ===================================================================== */
  function cardBadge(label, type) {
    if (label === null) {
      // Onzichtbare placeholder zodat titels uitlijnen
      return '<span class="esails-badge" style="visibility:hidden">&nbsp;</span>';
    }
    var cls = "esails-badge";
    if (type === "budget" || type === "letop") cls += " esails-badge--budget";
    return '<span class="' + cls + '">' + esc(label) + "</span>";
  }

  function card(opts) {
    // opts: { value, group, icon, titel, tekst, badge, badgeType, selected }
    var sel = opts.selected ? " esails-selection-card--selected" : "";
    return (
      '<div class="esails-selection-card' + sel + '" ' +
        'data-action="select" data-group="' + esc(opts.group) + '" data-value="' + esc(opts.value) + '">' +
        cardBadge(opts.badge === undefined ? null : opts.badge, opts.badgeType) +
        '<div class="esails-selection-card__icon">' + (opts.icon || "") + "</div>" +
        '<div class="esails-selection-card__title">' + esc(opts.titel) + "</div>" +
        '<div class="esails-selection-card__desc">' + esc(opts.tekst) + "</div>" +
      "</div>"
    );
  }

  function kleurKaarten() {
    var html = '<div class="esails-color-grid">';
    for (var i = 0; i < CONFIG.doek.kleuren.length; i++) {
      var k = CONFIG.doek.kleuren[i];
      var sel = state.kleur === k.key ? " esails-color-card--selected" : "";
      html +=
        '<div class="esails-color-card' + sel + '" data-action="select" data-group="kleur" data-value="' + esc(k.key) + '">' +
          '<span class="esails-color-swatch" style="background:' + esc(k.hex) + '"></span>' +
          '<span class="esails-color-name">' + esc(k.naam) + "</span>" +
        "</div>";
    }
    html += "</div>";
    return html;
  }

  function sliderHTML(opts) {
    // opts: { id, label, min, max, value, suffix }
    return (
      '<div class="esails-slider-wrapper">' +
        '<label class="esails-slider-label" for="' + opts.id + '">' + esc(opts.label) + "</label>" +
        '<div class="esails-slider-value"><span id="' + opts.id + '-val">' + opts.value + "</span> " + esc(opts.suffix) + "</div>" +
        '<input type="range" class="esails-slider" id="' + opts.id + '" ' +
          'data-action="slider" data-field="' + opts.field + '" ' +
          'min="' + opts.min + '" max="' + opts.max + '" value="' + opts.value + '" step="1">' +
      "</div>"
    );
  }

  /* =========================================================================
   * verSVG() / renderPreview() — live vooraanzicht dat meebeweegt
   * ===================================================================== */
  function verSVG() {
    var b = Math.max(20, state.breedte);
    var h = Math.max(20, state.hoogte);
    var kleur = getKleur();
    var doekKleur = kleur ? kleur.hex : "#9a9c9e";

    // Schaal de opening in een 320×220 viewport met marge
    var VW = 320, VH = 220, pad = 30;
    var maxW = VW - pad * 2, maxH = VH - pad * 2;
    var ratio = Math.min(maxW / b, maxH / h);
    var w = b * ratio, hh = h * ratio;
    var x = (VW - w) / 2, y = (VH - hh) / 2;

    var svg = '<svg viewBox="0 0 ' + VW + " " + VH + '" class="ez-preview-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vooraanzicht zonwering">';

    // Muur/achtergrond
    svg += '<rect x="0" y="0" width="' + VW + '" height="' + VH + '" fill="#f4f2ee"/>';

    if (state.toepassing === "balkon") {
      // Balkon: teken railing-spijlen achter het doek
      var spijlen = Math.max(3, Math.round(w / 18));
      for (var s = 0; s <= spijlen; s++) {
        var sx = x + (w * s) / spijlen;
        svg += '<line x1="' + sx.toFixed(1) + '" y1="' + y + '" x2="' + sx.toFixed(1) + '" y2="' + (y + hh) + '" stroke="#c9c3b8" stroke-width="2"/>';
      }
      // Boven- en onderregel
      svg += '<line x1="' + x + '" y1="' + y + '" x2="' + (x + w) + '" y2="' + y + '" stroke="#b3ab9c" stroke-width="3"/>';
      svg += '<line x1="' + x + '" y1="' + (y + hh) + '" x2="' + (x + w) + '" y2="' + (y + hh) + '" stroke="#b3ab9c" stroke-width="3"/>';
    } else {
      // Raam: glasvlak
      svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + hh + '" fill="#dce8ee" stroke="#b9c4cb" stroke-width="2"/>';
      // Kozijn-kruis
      svg += '<line x1="' + (x + w / 2) + '" y1="' + y + '" x2="' + (x + w / 2) + '" y2="' + (y + hh) + '" stroke="#cdd6db" stroke-width="2"/>';
      svg += '<line x1="' + x + '" y1="' + (y + hh / 2) + '" x2="' + (x + w) + '" y2="' + (y + hh / 2) + '" stroke="#cdd6db" stroke-width="2"/>';
    }

    // Het doek (semi-transparant gaas-effect met patroon)
    var doekOpacity = (state.toepassing === "balkon") ? 0.82 : 0.7;
    svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + hh + '" fill="' + doekKleur + '" opacity="' + doekOpacity + '"/>';
    // Subtiel gaaspatroon
    svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + hh + '" fill="url(#ezMesh)" opacity="0.25"/>';

    // Bevestiging tekenen
    if (state.toepassing === "raam") {
      // Zuignappen langs de rand (indicatief, niet 1:1 het berekende aantal)
      var nB = Math.max(2, Math.min(6, Math.round(b / 50)));
      var nH = Math.max(2, Math.min(6, Math.round(h / 50)));
      var c, cx, cy;
      for (c = 0; c <= nB; c++) {
        cx = x + (w * c) / nB;
        svg += zuignapDot(cx, y);
        svg += zuignapDot(cx, y + hh);
      }
      for (c = 1; c < nH; c++) {
        cy = y + (hh * c) / nH;
        svg += zuignapDot(x, cy);
        svg += zuignapDot(x + w, cy);
      }
    } else if (state.toepassing === "balkon") {
      // Koord-ophanging: gestippelde lijn langs boven + ogen
      svg += '<line x1="' + x + '" y1="' + (y - 6) + '" x2="' + (x + w) + '" y2="' + (y - 6) + '" stroke="#5a5042" stroke-width="2" stroke-dasharray="4 3"/>';
      var no = Math.max(2, Math.min(7, Math.round(b / 40)));
      for (var o = 0; o <= no; o++) {
        var ox = x + (w * o) / no;
        svg += '<circle cx="' + ox.toFixed(1) + '" cy="' + y + '" r="2.4" fill="#fff" stroke="#5a5042" stroke-width="1.4"/>';
      }
    }

    // Defs: gaaspatroon
    svg =
      '<svg viewBox="0 0 ' + VW + " " + VH + '" class="ez-preview-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Vooraanzicht zonwering">' +
      '<defs><pattern id="ezMesh" width="6" height="6" patternUnits="userSpaceOnUse">' +
        '<path d="M0 0 H6 M0 0 V6" stroke="#000" stroke-width="0.5"/>' +
      "</pattern></defs>" +
      svg.substring(svg.indexOf(">") + 1);

    svg += "</svg>";
    return svg;
  }

  function zuignapDot(cx, cy) {
    return '<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="3.2" fill="#ffffff" stroke="#8a8f93" stroke-width="1.4" opacity="0.95"/>';
  }

  function renderPreview() {
    if (state.stap >= TOTAAL_STAPPEN) return ""; // verberg op resultaat
    var maat = Math.max(20, state.breedte) + " \u00d7 " + Math.max(20, state.hoogte) + " cm";
    var label = state.toepassing === "balkon" ? "Balkon \u2014 elastisch koord" :
                state.toepassing === "raam" ? "Raam \u2014 zuignappen" : "Vooraanzicht";
    return (
      '<div class="esails-preview ez-preview">' +
        verSVG() +
        '<div class="ez-preview-caption">' + esc(label) + " \u00b7 " + esc(maat) + "</div>" +
      "</div>"
    );
  }

  /* =========================================================================
   * Stap-content
   * ===================================================================== */
  function stapTitel(n) {
    return ["TOEPASSING", "AFMETINGEN", "DOEK & KLEUR", "RANDAFWERKING", "EXTRA'S", "JOUW PAKKET"][n - 1];
  }

  function stapContent() {
    switch (state.stap) {
      case 1: return stapToepassing();
      case 2: return stapAfmetingen();
      case 3: return stapDoek();
      case 4: return stapRand();
      case 5: return stapExtras();
      case 6: return stapResultaat();
    }
    return "";
  }

  function stapToepassing() {
    return (
      '<div class="esails-step-intro">Waar komt je zonwering? Dat bepaalt meteen de beste manier om het doek te bevestigen.</div>' +
      '<div class="esails-card-grid">' +
        card({
          group: "toepassing", value: "raam",
          icon: "\uD83E\uDE9F",
          titel: "Voor een raam",
          tekst: "Het doek komt tegen het glas met zuignappen. Geen boren, zo weer weg.",
          badge: "Geen boren",
          selected: state.toepassing === "raam"
        }) +
        card({
          group: "toepassing", value: "balkon",
          icon: "\uD83C\uDFD9\uFE0F",
          titel: "Voor een balkon",
          tekst: "Het doek spant met elastisch koord langs de spijlen of railing. Beweegt mee met de wind.",
          badge: "Voor railing/spijlen",
          selected: state.toepassing === "balkon"
        }) +
      "</div>"
    );
  }

  function stapAfmetingen() {
    var tip = state.toepassing === "balkon"
      ? "Meet de breedte en hoogte van de balkonopening die je wilt afschermen."
      : "Meet het glas dat je wilt afdekken. Tip: dek het raam zo volledig mogelijk af \u2014 dat voorkomt temperatuurverschillen in de ruit.";
    return (
      '<div class="esails-step-intro">' + tip + "</div>" +
      sliderHTML({ id: "ezBreedte", field: "breedte", label: "Breedte", min: 30, max: 400, value: state.breedte, suffix: "cm" }) +
      sliderHTML({ id: "ezHoogte", field: "hoogte", label: "Hoogte", min: 30, max: 400, value: state.hoogte, suffix: "cm" })
    );
  }

  function stapDoek() {
    return (
      '<div class="esails-step-intro">Kies de kleur van je Soltis-gaasdoek. Het open weefsel houdt de zon en warmte tegen, maar je kunt er nog doorheen kijken.</div>' +
      kleurKaarten()
    );
  }

  function stapRand() {
    if (state.toepassing === "raam") {
      return (
        '<div class="esails-step-intro">Bij elke zuignap hoort een zeilring in het doek. Die verdeelt de kracht en voorkomt dat een gaatje uitscheurt \u2014 we rekenen ze automatisch mee.</div>' +
        '<div class="esails-card-grid">' +
          card({
            group: "zeilringTang", value: "ja",
            icon: "\uD83D\uDD27",
            titel: "Zeilringen zelf zetten",
            tekst: "Voeg een montageset met tang toe om de zeilringen netjes te plaatsen.",
            badge: state.zeilringTang ? "Toegevoegd" : "Aanrader",
            selected: state.zeilringTang
          }) +
          card({
            group: "zeilringTang", value: "nee",
            icon: "\u2705",
            titel: "Ik heb al gereedschap",
            tekst: "Sla de montageset over \u2014 alleen de zeilringen zelf komen in je pakket.",
            badge: undefined,
            selected: !state.zeilringTang
          }) +
        "</div>"
      );
    }
    // balkon
    return (
      '<div class="esails-step-intro">Langs de rand komen zeilringen waar het koord doorheen loopt. Een zoomband maakt die rand extra sterk \u2014 fijn op een winderig balkon.</div>' +
      '<div class="esails-card-grid">' +
        card({
          group: "zoomband", value: "ja",
          icon: "\uD83E\uDDF5",
          titel: "Met zoomband",
          tekst: "Versterkte rand rondom. Steviger bevestigingspunten, langere levensduur.",
          badge: state.zoomband ? "Toegevoegd" : "Aanrader bij wind",
          selected: state.zoomband
        }) +
        card({
          group: "zoomband", value: "nee",
          icon: "\u2796",
          titel: "Zonder zoomband",
          tekst: "Zeilringen direct in het doek. Prima voor een luwe plek.",
          badge: undefined,
          selected: !state.zoomband
        }) +
      "</div>"
    );
  }

  function stapExtras() {
    var windTip = state.toepassing === "balkon"
      ? '<div class="esails-step-note">\uD83D\uDCA1 Span het koord niet keihard aan. Een doek dat licht meebeweegt met de wind houdt het langer vol dan een doek dat muurvast staat.</div>'
      : '<div class="esails-step-note">\uD83D\uDCA1 Maak het glas en de zuignappen vetvrij voor montage \u2014 dan houden ze veel beter vast.</div>';
    return (
      '<div class="esails-step-intro">Handig om meteen mee te bestellen (optioneel).</div>' +
      '<div class="esails-card-grid">' +
        card({
          group: "opbergtas", value: "toggle",
          icon: "\uD83D\uDC5C",
          titel: "Opbergtas",
          tekst: "Bewaar het doek netjes buiten het seizoen.",
          badge: state.opbergtas ? "Toegevoegd" : undefined,
          selected: state.opbergtas
        }) +
        card({
          group: "reiniger", value: "toggle",
          icon: "\uD83E\uDDFD",
          titel: "Doekreiniger",
          tekst: "Houd het gaasdoek schoon zonder de coating aan te tasten.",
          badge: state.reiniger ? "Toegevoegd" : undefined,
          selected: state.reiniger
        }) +
      "</div>" + windTip
    );
  }

  function stapResultaat() {
    var lijnen = bouwBundle();
    var rows = "";
    var totaal = 0;
    for (var i = 0; i < lijnen.length; i++) {
      var ln = lijnen[i];
      var regelTotaal = ln.aantal * ln.prijs;
      if (ln.aantal > 0) totaal += regelTotaal;
      var stap = ln.eenheid === "m" ? "0.5" : "1";
      var aantalLabel = ln.eenheid === "m"
        ? (Math.round(ln.aantal * 10) / 10).toFixed(1).replace(".", ",") + " m"
        : ln.aantal + " st";
      rows +=
        '<div class="esails-config-row' + (ln.aantal <= 0 ? " esails-config-row--zero" : "") + '" data-key="' + esc(ln.key) + '">' +
          '<div class="esails-config-row__info">' +
            '<div class="esails-config-row__name">' + esc(ln.naam) + "</div>" +
            '<div class="esails-config-row__fn">' + esc(ln.functie) + "</div>" +
          "</div>" +
          '<div class="esails-counter" data-step="' + stap + '">' +
            '<button class="esails-counter__btn" data-action="qty" data-key="' + esc(ln.key) + '" data-dir="-1" type="button" aria-label="Minder">\u2212</button>' +
            '<span class="esails-counter__val">' + aantalLabel + "</span>" +
            '<button class="esails-counter__btn" data-action="qty" data-key="' + esc(ln.key) + '" data-dir="1" type="button" aria-label="Meer">+</button>' +
          "</div>" +
          '<div class="esails-config-row__price">' + money(regelTotaal) + "</div>" +
        "</div>";
    }

    var placeholderWaarschuwing = heeftPlaceholders()
      ? '<div class="esails-step-note" style="margin:0 16px 12px">\u26A0\uFE0F Let op: er staan nog product-ID\'s als placeholder in de configuratie. Vul de echte Lightspeed-ID\'s in voordat je live gaat.</div>'
      : "";

    return (
      '<div class="esails-result-intro">Op basis van je keuzes hebben we dit pakket samengesteld. Je kunt elk aantal nog aanpassen \u2014 de berekening is ons advies.</div>' +
      '<div class="esails-configuration-board">' +
        '<div class="esails-configuration-board__header">' +
          '<span>Onderdeel</span><span>Aantal</span><span>Prijs</span>' +
        "</div>" +
        rows +
        placeholderWaarschuwing +
        '<div class="esails-configuration-board__footer">' +
          '<span class="esails-configuration-board__total-label">Totaal (incl. btw)</span>' +
          '<span class="esails-configuration-board__total" id="ezTotaal">' + money(totaal) + "</span>" +
        "</div>" +
      "</div>" +
      '<button class="esails-submit-btn" id="ezAddToCart" data-action="addcart" type="button">' +
        "Alles in winkelwagen \u2192" +
      "</button>"
    );
  }

  function heeftPlaceholders() {
    var lijnen = bouwBundle();
    for (var i = 0; i < lijnen.length; i++) {
      if (lijnen[i].aantal > 0 && /^ID_/.test(String(lijnen[i].id))) return true;
    }
    return false;
  }

  /* =========================================================================
   * wizardHTML() — volledige template
   * ===================================================================== */
  function wizardHTML() {
    var pct = Math.round((state.stap / TOTAAL_STAPPEN) * 100);
    var isResultaat = state.stap >= TOTAAL_STAPPEN;
    var nextLabel = (state.stap === TOTAAL_STAPPEN - 1) ? "Bekijk mijn pakket" : "Volgende";
    return (
      '<div class="esails-wizard">' +
        '<div class="esails-wizard__header">' +
          '<h2 class="esails-wizard__title">Zonwering-keuzehulp</h2>' +
          '<p class="esails-wizard__subtitle">Stel in een paar stappen jouw ideale materiaalpakket samen</p>' +
        "</div>" +
        '<div class="esails-progress">' +
          '<div class="esails-progress__bar" style="width:' + pct + '%"></div>' +
        "</div>" +
        '<div class="esails-progress__label">STAP ' + state.stap + " VAN " + TOTAAL_STAPPEN + ": " + stapTitel(state.stap) + "</div>" +
        renderPreview() +
        '<div class="esails-step" id="ezStep">' + stapContent() + "</div>" +
        '<div class="esails-nav">' +
          '<button class="esails-nav__prev" id="ezBtnPrev" data-action="prev" type="button"' + (state.stap === 1 ? " disabled" : "") + ">\u2190 Vorige</button>" +
          (isResultaat
            ? ""
            : '<button class="esails-nav__next" id="ezBtnNext" data-action="next" type="button"' + (stapCompleet() ? "" : " disabled") + ">" + nextLabel + "</button>") +
        "</div>" +
        '<iframe id="ezCartFrame" name="ezCartFrame" style="display:none" title="cart"></iframe>' +
      "</div>"
    );
  }

  /* =========================================================================
   * Navigatie & validatie
   * ===================================================================== */
  function stapCompleet() {
    switch (state.stap) {
      case 1: return !!state.toepassing;
      case 2: return state.breedte >= 20 && state.hoogte >= 20;
      case 3: return !!state.kleur;
      case 4: return true; // keuze heeft altijd een default
      case 5: return true; // extra's optioneel
      default: return true;
    }
  }

  function ga(dir) {
    if (dir > 0) {
      if (!stapCompleet()) return;
      if (state.stap < TOTAAL_STAPPEN) state.stap++;
    } else {
      if (state.stap > 1) state.stap--;
    }
    render();
  }

  function toonStap() { render(); }

  /* =========================================================================
   * Aantallen bewerken
   * ===================================================================== */
  function adjustQty(key, dir) {
    var lijnen = bouwBundle();
    var huidig = null, eenheid = "stuk";
    for (var i = 0; i < lijnen.length; i++) {
      if (lijnen[i].key === key) { huidig = lijnen[i].aantal; eenheid = lijnen[i].eenheid; break; }
    }
    if (huidig === null) return;
    var step = eenheid === "m" ? REKEN.doekAfrondStapM : 1;
    var nieuw = huidig + dir * step;
    if (nieuw < 0) nieuw = 0;
    nieuw = Math.round(nieuw * 100) / 100;
    state.locked[key] = true;
    state.qty[key] = nieuw;
    render();
  }

  function calcTotal() {
    var lijnen = bouwBundle();
    var t = 0;
    for (var i = 0; i < lijnen.length; i++) {
      if (lijnen[i].aantal > 0) t += lijnen[i].aantal * lijnen[i].prijs;
    }
    return t;
  }

  /* =========================================================================
   * Winkelwagen — form-POST naar verborgen iframe, één voor één
   * ===================================================================== */
  function addToCart() {
    if (heeftPlaceholders()) {
      alert("Er staan nog placeholder product-ID's in de configuratie. Vervang de ID_-waarden door echte Lightspeed-ID's voordat je toevoegt.");
      return;
    }
    var lijnen = bouwBundle().filter(function (l) { return l.aantal > 0; });
    if (!lijnen.length) return;

    var btn = $("#ezAddToCart", root);
    if (btn) { btn.disabled = true; btn.textContent = "Toevoegen\u2026"; }

    ensureFrame();
    var idx = 0;
    function next() {
      if (idx >= lijnen.length) {
        window.location.href = "/cart";
        return;
      }
      var ln = lijnen[idx++];
      var qty = Math.ceil(ln.aantal); // Lightspeed: hele aantallen
      postOne(ln.id, qty, next);
    }
    next();
  }

  function ensureFrame() {
    if (!$("#ezCartFrame", root)) {
      var f = document.createElement("iframe");
      f.id = "ezCartFrame"; f.name = "ezCartFrame"; f.style.display = "none";
      root.appendChild(f);
    }
  }

  function postOne(productId, qty, done) {
    var form = document.createElement("form");
    form.method = "POST";
    form.action = "/cart";
    form.target = "ezCartFrame";
    form.style.display = "none";
    form.appendChild(hidden("product", productId));
    form.appendChild(hidden("quantity", qty));
    document.body.appendChild(form);

    var frame = $("#ezCartFrame", root) || document.getElementsByName("ezCartFrame")[0];
    var done2 = false;
    function finish() {
      if (done2) return; done2 = true;
      if (frame) frame.onload = null;
      try { document.body.removeChild(form); } catch (e) {}
      done();
    }
    if (frame) frame.onload = finish;
    form.submit();
    setTimeout(finish, 1500); // fallback
  }

  function hidden(name, value) {
    var i = document.createElement("input");
    i.type = "hidden"; i.name = name; i.value = value;
    return i;
  }

  /* =========================================================================
   * Events — één gedelegeerde listener
   * ===================================================================== */
  function bindEvents() {
    root.addEventListener("click", function (e) {
      var el = e.target.closest("[data-action]");
      if (!el || !root.contains(el)) return;
      var action = el.getAttribute("data-action");

      if (action === "next") { ga(1); }
      else if (action === "prev") { ga(-1); }
      else if (action === "select") { handleSelect(el); }
      else if (action === "qty") { adjustQty(el.getAttribute("data-key"), parseInt(el.getAttribute("data-dir"), 10)); }
      else if (action === "addcart") { addToCart(); }
    });

    root.addEventListener("input", function (e) {
      var el = e.target;
      if (el.getAttribute && el.getAttribute("data-action") === "slider") {
        var field = el.getAttribute("data-field");
        var v = parseInt(el.value, 10);
        state[field] = v;
        var lbl = $("#" + el.id + "-val", root);
        if (lbl) lbl.textContent = v;
        // herteken alleen de preview live (niet de hele stap, voor soepelheid)
        var prev = $(".ez-preview", root);
        if (prev) {
          var tmp = document.createElement("div");
          tmp.innerHTML = renderPreview();
          if (tmp.firstChild) prev.parentNode.replaceChild(tmp.firstChild, prev);
        }
        // Volgende-knop kan nu enabled worden
        var nb = $("#ezBtnNext", root);
        if (nb) nb.disabled = !stapCompleet();
      }
    });
  }

  function handleSelect(el) {
    var group = el.getAttribute("data-group");
    var value = el.getAttribute("data-value");
    if (group === "toepassing") {
      if (state.toepassing !== value) {
        // wissel van toepassing → reset bevestigingsgebonden keuzes
        state.toepassing = value;
        state.zeilringTang = false;
        state.zoomband = false;
        state.locked = {};
        state.qty = {};
      }
    } else if (group === "kleur") {
      state.kleur = value;
    } else if (group === "zeilringTang") {
      state.zeilringTang = (value === "ja");
    } else if (group === "zoomband") {
      state.zoomband = (value === "ja");
    } else if (group === "opbergtas") {
      state.opbergtas = !state.opbergtas;
    } else if (group === "reiniger") {
      state.reiniger = !state.reiniger;
    }
    render();
  }

  /* =========================================================================
   * Render
   * ===================================================================== */
  var root = null;
  function render() {
    if (!root) return;
    root.innerHTML = wizardHTML();
  }

  /* =========================================================================
   * injectPreviewCSS() — eigen preview + container-basis op de mount-id
   * ===================================================================== */
  function injectPreviewCSS() {
    if (document.getElementById("ez-inline-css")) return;
    var css =
      "#esails-zonwering-mount{box-sizing:border-box;max-width:900px;margin:0 auto;padding:32px;" +
        "border:1px solid var(--esails-border,#e2e2e2);border-radius:var(--esails-radius,8px);" +
        "background:#fff;box-shadow:0 2px 16px rgba(0,0,0,.04);" +
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--esails-dark,#111)}" +
      "#esails-zonwering-mount *{box-sizing:border-box}" +
      ".ez-preview{display:flex;flex-direction:column;align-items:center;gap:8px;margin:0 0 24px}" +
      ".ez-preview-svg{width:100%;max-width:320px;height:auto;border-radius:var(--esails-radius,8px);" +
        "border:1px solid var(--esails-border,#e2e2e2)}" +
      ".ez-preview-caption{font-size:13px;color:var(--esails-muted,#666);letter-spacing:.02em}";
    var tag = document.createElement("style");
    tag.id = "ez-inline-css";
    tag.appendChild(document.createTextNode(css));
    document.head.appendChild(tag);
  }

  /* =========================================================================
   * init() — zoekt de eigen mount-div; stopt netjes als die er niet is
   * ===================================================================== */
  function init() {
    root = document.getElementById("esails-zonwering-mount");
    if (!root) return false;
    if (root.getAttribute("data-ez-init") === "1") return true; // idempotent
    root.setAttribute("data-ez-init", "1");
    injectPreviewCSS();
    resetState();
    bindEvents();
    render();
    return true;
  }

  return { init: init, _bereken: bereken, _bouwBundle: bouwBundle, _resetState: resetState, _state: function(){return state;} };
})();

/* init-runner: DOMContentLoaded én load (vangnet), idempotent */
(function () {
  function go() { try { window.esailsZonweringWizard.init(); } catch (e) {} }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", go);
  } else { go(); }
  window.addEventListener("load", go);
})();
