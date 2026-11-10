# -*- coding: utf-8 -*-
"""
Genera els diccionaris del joc a partir de les fonts de font/:
  - font/diccionari.txt  (Softcatala, catalan-dict-tools, GPL-2.0+/LGPL-2.1+)
  - font/es_ES.dic + font/es_ES.aff  (RLA-ES via LibreOffice, GPL/LGPL/MPL)

Sortides (a dades/):
  ca.dawg / es.dawg  : DAWG binari (Uint32 little-endian), vegeu format a sota
  ca.txt / es.txt    : llista de paraules normalitzades (per a proves; no es publica)

Format DAWG: cada node es una tira d'arestes consecutives (Uint32):
  bits 0-5   index de la lletra a l'alfabet
  bit  6     la paraula acaba aqui (el node desti es final)
  bit  7     ultima aresta del node
  bits 8-31  index de la primera aresta del node desti (0 = sense fills)
L'arrel comenca a l'index 1 (l'index 0 es una aresta buida).

Us:  python -I eines\\fer_diccionaris.py
"""
import os, re, sys, struct, unicodedata

ARREL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ARREL, 'font')
DADES = os.path.join(ARREL, 'dades')

# Alfabets interns (una lletra = una fitxa).  Catala: L = L·L, N = NY, Q = QU
ALFA = {
    'ca': 'ABCDEFGHIJLMNOPQRSTUVXZÇŁŊ',
    'es': 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ',
}
MINL, MAXL = 2, 15
# abreviatures del diccionari de LibreOffice que no son paraules de joc
EXCLOSES = {
    'es': set('AD AJ AP AV ED EJ IB ID OB OP QU'.split()),
}


def treu_accents(s, guarda=''):
    out = []
    for ch in s:
        if ch in guarda:
            out.append(ch)
            continue
        d = unicodedata.normalize('NFD', ch)
        out.append(''.join(c for c in d if not unicodedata.combining(c)))
    return ''.join(out)


# ---------------------------------------------------------------- catala
def norm_ca(w):
    w = w.lower().replace('ŀl', 'l·l').replace('l.l', 'l·l')
    if w.count('q') != w.count('qu') and w.count('q') != (w.count('qu') + w.count('qü')):
        return None
    w = w.replace('qü', 'q').replace('qu', 'q')
    w = w.replace('l·l', 'ł').replace('ny', 'ŋ')
    w = treu_accents(w, 'çłŋ')
    if '·' in w or 'y' in w:
        return None
    return w.upper()


def paraules_ca():
    res = set()
    with open(os.path.join(FONT, 'diccionari.txt'), encoding='utf-8') as f:
        for line in f:
            p = line.split()
            if len(p) < 3:
                continue
            forma, tag = p[0], p[2]
            if tag.startswith(('NP', 'Y', 'F')):
                continue
            if forma != forma.lower():
                continue  # sigles, majuscules
            w = norm_ca(forma)
            if w:
                res.add(w)
    return res


# ---------------------------------------------------------------- castella (hunspell)
def llegeix_aff(path):
    pfx, sfx = {}, {}
    with open(path, encoding='utf-8') as f:
        lines = f.read().splitlines()
    i = 0
    while i < len(lines):
        p = lines[i].split()
        if len(p) >= 4 and p[0] in ('PFX', 'SFX') and p[2] in ('Y', 'N') and p[3].isdigit():
            kind, flag, cross, n = p[0], p[1], p[2] == 'Y', int(p[3])
            regles = []
            for j in range(1, n + 1):
                q = lines[i + j].split()
                strip = '' if q[2] == '0' else q[2]
                add = q[3]
                cont = ''
                if '/' in add:
                    add, cont = add.split('/', 1)
                if add == '0':
                    add = ''
                cond = q[4] if len(q) > 4 else '.'
                rx = re.compile(('^' + cond) if kind == 'PFX' else (cond + '$'))
                regles.append((strip, add, cont, rx))
            (pfx if kind == 'PFX' else sfx)[flag] = (cross, regles)
            i += n + 1
        else:
            i += 1
    return pfx, sfx


def parteix_flags(s, conegudes):
    """FLAG UTF-8: un flag = un punt de codi, pero alguns flags (emoji) en tenen dos."""
    out, i = [], 0
    while i < len(s):
        if s[i:i + 2] in conegudes:
            out.append(s[i:i + 2]); i += 2
        else:
            out.append(s[i]); i += 1
    return out


def expandeix(arrel, flags, pfx, sfx, coneg):
    formes = {arrel}

    def aplica_sfx(w, fl, profunditat):
        res = []
        for f in fl:
            if f not in sfx:
                continue
            cross, regles = sfx[f]
            for strip, add, cont, rx in regles:
                if strip and not w.endswith(strip):
                    continue
                if not rx.search(w):
                    continue
                nw = w[:len(w) - len(strip)] + add if strip else w + add
                cf = parteix_flags(cont, coneg) if cont else []
                res.append((nw, cross, cf))
                if profunditat < 1 and cf:
                    for x in aplica_sfx(nw, cf, profunditat + 1):
                        res.append((x[0], cross and x[1], cf + x[2]))
        return res

    def aplica_pfx(w, fl):
        res = []
        for f in fl:
            if f not in pfx:
                continue
            cross, regles = pfx[f]
            for strip, add, cont, rx in regles:
                if strip and not w.startswith(strip):
                    continue
                if not rx.search(w):
                    continue
                res.append(add + w[len(strip):])
        return res

    sufixades = aplica_sfx(arrel, flags, 0)
    for nw, cross, cf in sufixades:
        formes.add(nw)
        if cross:
            for x in aplica_pfx(nw, [f for f in flags + cf if f in pfx and pfx[f][0]]):
                formes.add(x)
    for x in aplica_pfx(arrel, flags):
        formes.add(x)
    return formes


def norm_es(w):
    w = w.lower()
    w = treu_accents(w, 'ñ')
    if not re.fullmatch('[a-zñ]+', w):
        return None
    return w.upper()


def paraules_es():
    pfx, sfx = llegeix_aff(os.path.join(FONT, 'es_ES.aff'))
    coneg = set(pfx) | set(sfx)
    res = set()
    with open(os.path.join(FONT, 'es_ES.dic'), encoding='utf-8') as f:
        f.readline()
        for line in f:
            line = line.strip().split('\t')[0].split(' ')[0]
            if not line:
                continue
            if '/' in line:
                arrel, fl = line.split('/', 1)
                flags = parteix_flags(fl, coneg)
            else:
                arrel, flags = line, []
            if arrel != arrel.lower():
                continue  # noms propis i sigles
            for forma in expandeix(arrel, flags, pfx, sfx, coneg):
                w = norm_es(forma)
                if w:
                    res.add(w)
    return res


# ---------------------------------------------------------------- DAWG
def construeix_dawg(paraules, alfa):
    idx = {c: i for i, c in enumerate(alfa)}
    # Daciuk incremental (paraules ordenades segons l'alfabet)
    paraules = sorted(paraules, key=lambda w: [idx[c] for c in w])
    nodes = [[{}, False]]  # [fills {lletra: node}, final]
    registre = {}
    pendents = []  # (pare, lletra, fill) no minimitzats

    def clau(n):
        fills, fin = nodes[n]
        return (fin, tuple(sorted(fills.items())))

    def minimitza(fins):
        while len(pendents) > fins:
            pare, l, fill = pendents.pop()
            k = clau(fill)
            if k in registre:
                nodes[pare][0][l] = registre[k]
            else:
                registre[k] = fill

    anterior = ''
    for w in paraules:
        comu = 0
        while comu < min(len(w), len(anterior)) and w[comu] == anterior[comu]:
            comu += 1
        minimitza(comu)
        n = pendents[-1][2] if pendents else 0
        for c in w[comu:]:
            nodes.append([{}, False])
            nou = len(nodes) - 1
            nodes[n][0][idx[c]] = nou
            pendents.append((n, idx[c], nou))
            n = nou
        nodes[n][1] = True
        anterior = w
    minimitza(0)

    # serialitza: cada node amb fills -> tira d'arestes
    ordre, pos, cua = [], {}, [0]
    vist = {0}
    while cua:
        n = cua.pop()
        if nodes[n][0]:
            ordre.append(n)
        for l, f in sorted(nodes[n][0].items()):
            if f not in vist:
                vist.add(f); cua.append(f)
    p = 1
    for n in ordre:
        pos[n] = p
        p += len(nodes[n][0])
    out = [0] * p
    for n in ordre:
        items = sorted(nodes[n][0].items())
        for k, (l, f) in enumerate(items):
            v = l | (64 if nodes[f][1] else 0) | (128 if k == len(items) - 1 else 0)
            v |= (pos.get(f, 0)) << 8
            out[pos[n] + k] = v
    assert p < (1 << 24)
    return out


def comprova(dawg, alfa, paraules, mostra=2000):
    import random
    def hi_es(w):
        e = 1
        for k, c in enumerate(w):
            li = alfa.index(c)
            if e == 0:
                return False
            while True:
                v = dawg[e]
                if (v & 63) == li:
                    break
                if v & 128:
                    return False
                e += 1
            if k == len(w) - 1:
                return bool(v & 64)
            e = v >> 8
        return False
    llista = random.sample(sorted(paraules), min(mostra, len(paraules)))
    assert all(hi_es(w) for w in llista)
    falses = 0
    for w in llista[:500]:
        x = w + 'Q'
        if x not in paraules and hi_es(x):
            falses += 1
    assert falses == 0


def main():
    os.makedirs(DADES, exist_ok=True)
    langs = sys.argv[1:] or ['ca', 'es']
    for lang in langs:
        alfa = ALFA[lang]
        ws = paraules_ca() if lang == 'ca' else paraules_es()
        ws = {w for w in ws if MINL <= len(w) <= MAXL and all(c in alfa for c in w)}
        # fora sigles i simbols (cm, kg, hl...): tota paraula ha de tenir alguna vocal
        ws = {w for w in ws if any(v in w for v in 'AEIOU')}
        ws -= EXCLOSES.get(lang, set())
        with open(os.path.join(DADES, lang + '.txt'), 'w', encoding='utf-8') as f:
            f.write('\n'.join(sorted(ws)) + '\n')
        d = construeix_dawg(ws, alfa)
        comprova(d, alfa, ws)
        with open(os.path.join(DADES, lang + '.dawg'), 'wb') as f:
            f.write(struct.pack('<%dI' % len(d), *d))
        print(lang, len(ws), 'paraules,', len(d), 'arestes,', len(d) * 4 // 1024, 'KB')


if __name__ == '__main__':
    main()
