# Paraules · Xoriguer — llicències dels diccionaris

El joc (codi, gràfics i logo) és de Xoriguer.

Les llistes de paraules (`dades/ca.dawg` i `dades/es.dawg`) s'han generat amb `eines/fer_diccionaris.py` a partir d'aquests diccionaris lliures. Es distribueixen amb la mateixa llicència que els originals.

## Català — `dades/ca.dawg`
- Font: Softcatalà, *catalan-dict-tools*, fitxer `resultats/lt/diccionari.txt`
  <https://github.com/Softcatala/catalan-dict-tools>
- Llicència: GNU GPL 2.0 o posterior / GNU LGPL 2.1 o posterior.

## Castellano — `dades/es.dawg`
- Font: diccionari del projecte RLA-ES (<https://github.com/sbosio/rla-es>), tal com el distribueix LibreOffice: `es/es_ES.dic` i `es/es_ES.aff`
  <https://github.com/LibreOffice/dictionaries/tree/master/es>
- Llicència: GNU GPL 3.0 / GNU LGPL 3.0 / MPL 1.1 (a triar).

## Com es generen
1. Posa els fitxers originals a `font/`.
2. Executa `python -I eines/fer_diccionaris.py`.

L'script:
- treu els noms propis, les sigles i les paraules sense vocal;
- treu els accents (excepte Ç i Ñ);
- converteix L·L, NY i QU en una sola fitxa (català);
- guarda cada llista en un DAWG binari (el format està explicat a l'script).
