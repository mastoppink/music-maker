"""Similarity guard for the komposer: a new song may not share too many melodic shapes with earlier songs.

Same idea as music-maker's JS guard: Jaccard similarity of 6-interval melody n-grams (transposition-free).
Catalogue: ~/.music-maker/katalog-komposer.json (or --katalog).
"""
import json, os, time

DEFAULT = os.path.expanduser('~/.music-maker/katalog-komposer.json')
THRESHOLD = 0.35


def grams(song, n=6):
    ns = [m[2] for m in sorted(song.mel)]
    iv = [b - a for a, b in zip(ns, ns[1:])]
    return {','.join(map(str, iv[k:k + n])) for k in range(len(iv) - n + 1)}


def load(path=DEFAULT):
    try:
        with open(path) as f: return json.load(f)
    except (OSError, ValueError):
        return {'lagu': []}


def check(song, path=DEFAULT, threshold=THRESHOLD):
    g = grams(song); best = (0.0, None)
    for e in load(path)['lagu']:
        o = set(e['g'])
        if not g or not o: continue
        j = len(g & o) / len(g | o)
        if j > best[0]: best = (j, e['judul'])
    return best[0] < threshold, round(best[0], 3), best[1]


def add(song, path=DEFAULT, extra=None):
    k = load(path)
    k['lagu'].append(dict(judul=song.name, waktu=time.strftime('%Y-%m-%d %H:%M'), g=sorted(grams(song)), **(extra or {})))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f: json.dump(k, f)
