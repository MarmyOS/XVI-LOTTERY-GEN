"""
Werkt jackpots.json bij voor de XVI nummergenerator.

Handmatig (werkt meteen):
    python update_jackpots.py --lotto 2000000 --euromillions 37000000

Automatisch:
    1. Vul hieronder bij BRONNEN de URL in waar het bedrag staat (zie uitleg onderaan).
    2. Run:  python update_jackpots.py

De datum van de volgende trekking rekent het script zelf uit:
    Lotto         -> woensdag en zaterdag
    EuroMillions  -> dinsdag en vrijdag
"""

import argparse
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

BESTAND = Path(__file__).with_name("jackpots.json")

# Weekdagen van de trekkingen (maandag = 0 ... zondag = 6)
TREKDAGEN = {
    "lotto": (2, 5),
    "euromillions": (1, 4),
}
# Na dit uur op een trekdag kijkt het script al naar de volgende trekking
CUT_OFF_UUR = 22

# ---------------------------------------------------------------------------
# Automatische bronnen (optioneel).
#   url : adres dat JSON teruggeeft met het jackpotbedrag
#   pad : weg naar het bedrag in die JSON, bv. ["jackpot", "amount"] of ["draws", 0, "jackpot"]
# Laat url leeg om een spel alleen handmatig bij te werken.
# ---------------------------------------------------------------------------
BRONNEN = {
    "lotto": {"url": "", "pad": []},
    "euromillions": {"url": "", "pad": []},
}


def volgende_trekking(spel, nu=None):
    nu = nu or datetime.now()
    dag = nu.date()
    if nu.hour >= CUT_OFF_UUR and dag.weekday() in TREKDAGEN[spel]:
        dag += timedelta(days=1)
    while dag.weekday() not in TREKDAGEN[spel]:
        dag += timedelta(days=1)
    return dag


def haal_bedrag_op(spel):
    """Geeft het bedrag in euro (int) of None als er geen bron is of het mislukt."""
    bron = BRONNEN[spel]
    if not bron["url"]:
        return None
    try:
        req = urllib.request.Request(bron["url"], headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as res:
            data = json.load(res)
        for stap in bron["pad"]:
            data = data[stap]
        if isinstance(data, str):
            data = re.sub(r"[^\d]", "", data)  # "€ 2.000.000" -> "2000000"
        return int(float(data))
    except Exception as fout:
        print(f"[{spel}] ophalen mislukt: {fout}", file=sys.stderr)
        return None


def lees_bestand():
    try:
        return json.loads(BESTAND.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def schrijf_bestand(data):
    tijdelijk = BESTAND.with_suffix(".tmp")
    tijdelijk.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tijdelijk.replace(BESTAND)  # in één keer vervangen, nooit een half bestand


def main():
    parser = argparse.ArgumentParser(description="Werk jackpots.json bij.")
    parser.add_argument("--lotto", type=int, help="Lotto-jackpot in euro, bv. 2000000")
    parser.add_argument("--euromillions", type=int, help="EuroMillions-jackpot in euro, bv. 37000000")
    args = parser.parse_args()

    data = lees_bestand()
    gewijzigd = False

    for spel in ("lotto", "euromillions"):
        bedrag = getattr(args, spel)
        if bedrag is None:
            bedrag = haal_bedrag_op(spel)
        if bedrag is None:
            print(f"[{spel}] geen nieuw bedrag, ongewijzigd gelaten.")
            continue

        data[spel] = {"datum": volgende_trekking(spel).isoformat(), "bedrag": bedrag}
        if spel == "euromillions":
            data[spel]["ongeveer"] = True  # EuroMillions-bedragen zijn schattingen ("zo'n")
        print(f"[{spel}] {data[spel]['datum']}: € {bedrag:,}".replace(",", "."))
        gewijzigd = True

    if gewijzigd:
        schrijf_bestand(data)
        print(f"Opgeslagen in {BESTAND.name}")


if __name__ == "__main__":
    main()

# ---------------------------------------------------------------------------
# Het adres van de bron vinden (1 minuutje):
#   1. Open https://www.nationale-loterij.be/uitslagen-trekkingen in Chrome.
#   2. F12 -> tabblad "Network" -> filter "Fetch/XHR" -> pagina herladen.
#   3. Klik de aanvragen aan tot je een JSON-antwoord ziet met het jackpotbedrag.
#   4. Kopieer die URL naar BRONNEN["lotto"]["url"] en geef bij "pad" de weg naar het bedrag.
# Check de gebruiksvoorwaarden van de site voor je dit automatisch en vaak laat draaien.
#
# Automatisch laten draaien:
#   Windows: Taakplanner -> elke dag om 22:30  ->  python update_jackpots.py
#   Mac/Linux: crontab  ->  30 22 * * *  python3 /pad/naar/update_jackpots.py
# ---------------------------------------------------------------------------