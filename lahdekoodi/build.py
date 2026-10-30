#!/usr/bin/env python3
"""Kokoaa simulaattorin (index.html) ja Reittikartan (reittikartta.html) yksittäisiksi tiedostoiksi repon juureen.

Kaikki tyylit ja skriptit upotetaan sivuun, jotta valmis sovellus on yksi tiedosto ilman asennuksia."""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')


def css_tag(m):
    return '<style>\n' + read(m.group(1)) + '\n</style>'


def js_tag(m):
    src = read(m.group(1))
    if '</script' in src.lower():
        raise SystemExit('Skriptissä %s on </script>-merkkijono' % m.group(1))
    return '<script>\n' + src + '\n</script>'


def inline(src_name):
    html = (ROOT / src_name).read_text(encoding='utf-8')
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css_tag, html)
    return re.sub(r'<script src="([^"]+)"></script>', js_tag, html)


# SMPS-verkkosimulaattori (30.10.2026): molemmat sovellukset yhdeksi tiedostoksi repon juureen, josta Vercel julkaisee ne sellaisenaan.
# Simulaattori on etusivu (index.html) ja Reittikartta sen rinnalla (reittikartta.html). Sama osoite, joten Reittikartan reitit
# (selaimen localStorage, avain reittikartta.v1) näkyvät simulaattorin reittilistassa suoraan.
for src, dst in (('simulaattori.html', 'index.html'), ('index.html', 'reittikartta.html')):
    html = inline(src)
    out = ROOT.parent / dst
    out.write_text(html, encoding='utf-8')
    print(out, len(html.encode('utf-8')), 'tavua')
