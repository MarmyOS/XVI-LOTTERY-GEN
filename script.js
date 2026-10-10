// ---------- Random ----------
// Veilige random integer (inclusief min en max), zonder modulo-bias
function randomInt(min, max) {
    const range = max - min + 1;
    const limiet = Math.floor(0x100000000 / range) * range;
    const buf = new Uint32Array(1);
    do { crypto.getRandomValues(buf); } while (buf[0] >= limiet);
    return min + (buf[0] % range);
}
function uniek(aantal, min, max) {
    const set = new Set();
    while (set.size < aantal) set.add(randomInt(min, max));
    return [...set].sort((a, b) => a - b);
}

// ---------- Spellen ----------
const SPELLEN = {
    lotto: {
        themeColor: "#e5271a",
        hero: "Kies je Lotto-nummers",
        kop: "Jouw Lotto-rijen",
        trek: () => ({ nummers: uniek(6, 1, 45), sterren: [] }),
    },
    euromillions: {
        themeColor: "#001263",
        hero: "Kies je EuroMillions-nummers",
        kop: "Jouw EuroMillions-rijen",
        trek: () => ({ nummers: uniek(5, 1, 50), sterren: uniek(2, 1, 12) }),
    },
};

// ---------- State ----------
let huidig = "lotto";
let aantal = 1;
const resultaten = { lotto: [], euromillions: [] };
let jackpots = {};

const $ = (id) => document.getElementById(id);

// ---------- Weergave ----------
function kiesSpel(spel) {
    huidig = spel;
    document.body.dataset.game = spel;
    $("theme-color").content = SPELLEN[spel].themeColor;
    document.querySelectorAll(".tab").forEach((t) =>
        t.setAttribute("aria-selected", String(t.dataset.game === spel))
    );
    toonHero();
    $("kaart-kop").textContent = SPELLEN[spel].kop;
    toon(false);
}

// ---------- Jackpot ----------
const JACKPOT_BRON = "jackpots.json";   // later eventueel een API-adres
const VERVERS_ELKE_MS = 5 * 60 * 1000;  // elke 5 minuten opnieuw ophalen

function jackpotGeldig(j) {
    if (!j || typeof j.bedrag !== "number" || !j.datum) return false;
    const trekking = new Date(j.datum + "T23:59:59");
    return trekking >= new Date(); // verlopen trekking = niet tonen
}

function toonHero() {
    const j = jackpots[huidig];
    if (jackpotGeldig(j)) {
        const dag = new Date(j.datum + "T12:00:00").toLocaleDateString("nl-BE", {
            weekday: "long", day: "numeric", month: "long",
        });
        $("hero-spel").textContent = dag + " Jackpot van" + (j.ongeveer ? " zo'n" : "");
        $("hero-regel").textContent = "€ " + new Intl.NumberFormat("nl-BE").format(j.bedrag);
    } else {
        // geen (actuele) jackpot beschikbaar: toon de standaardtekst
        $("hero-spel").textContent = SPELLEN[huidig].hero;
        $("hero-regel").textContent = "Today is your day";
    }
}

async function laadJackpots() {
    try {
        const res = await fetch(JACKPOT_BRON, { cache: "no-store" });
        if (!res.ok) throw new Error(res.status);
        jackpots = await res.json();
    } catch (e) {
        jackpots = {};
    }
    toonHero();
}

function toon(animeer) {
    const uit = $("resultaten");
    uit.replaceChildren();
    const rijen = resultaten[huidig];
    $("kopieer").hidden = rijen.length === 0;

    if (rijen.length === 0) {
        const p = document.createElement("p");
        p.className = "leeg";
        p.textContent = "Druk op “Genereer nummers” voor je eerste rij.";
        uit.append(p);
        return;
    }

    for (const r of rijen) {
        const div = document.createElement("div");
        div.className = "rij" + (animeer ? " nieuw" : "");
        div.style.setProperty("--n", r.nummers.length + r.sterren.length);
        let i = 0;
        for (const n of r.nummers) div.append(bal(n, false, i++));
        for (const s of r.sterren) div.append(bal(s, true, i++));
        uit.append(div);
    }
}

function bal(waarde, isSter, index) {
    const span = document.createElement("span");
    span.className = "nr" + (isSter ? " ster" : "");
    span.style.setProperty("--i", index);
    span.textContent = waarde;
    if (isSter) span.setAttribute("aria-label", "ster " + waarde);
    return span;
}

function zetAantal(n) {
    aantal = Math.max(1, Math.min(10, n));
    $("aantal").textContent = aantal;
    $("min").disabled = aantal === 1;
    $("plus").disabled = aantal === 10;
}

// ---------- Events ----------
document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => kiesSpel(t.dataset.game))
);
$("min").addEventListener("click", () => zetAantal(aantal - 1));
$("plus").addEventListener("click", () => zetAantal(aantal + 1));

$("genereer").addEventListener("click", () => {
    resultaten[huidig] = Array.from({ length: aantal }, SPELLEN[huidig].trek);
    toon(true);
});

$("kopieer").addEventListener("click", async () => {
    const tekst = resultaten[huidig]
        .map((r) => r.nummers.join(" ") + (r.sterren.length ? "  ★ " + r.sterren.join(" ") : ""))
        .join("\n");
    const knop = $("kopieer");
    try {
        await navigator.clipboard.writeText(tekst);
        knop.textContent = "Gekopieerd!";
    } catch {
        knop.textContent = "Kopiëren lukt niet";
    }
    setTimeout(() => (knop.textContent = "Kopieer nummers"), 1500);
});

// ---------- Start ----------
zetAantal(1);
kiesSpel("lotto");
laadJackpots();
setInterval(laadJackpots, VERVERS_ELKE_MS);
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) laadJackpots();
});