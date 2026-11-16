#!/usr/bin/env python3
"""Merges the research files (/mnt/project-files/tcgcompare/store-research/*.json) into data/crawl/own-stores.json.
Drops hosts already in known-hosts.txt or the blocklist; the weekly probe then keeps only stores whose collections hold a game."""
import json, glob, re, sys
R="/mnt/project-files/tcgcompare/store-research/"
known=set(open(R+"known-hosts.txt").read().split())
banned=("tcgsynergy","hbtcollectables","chromavaults")
out={}
try:
    for s in json.load(open("data/crawl/own-stores.json")): out[(s["base"],s["market"])]=s
except Exception: pass
for f in sorted(glob.glob(R+"*.json")):
    for s in json.load(open(f)):
        m=re.match(r"https?://(?:www\.)?([^/]+)",s["base"]); h=m.group(1).lower()
        if h in known or any(b in h for b in banned): continue  # myshopify hosts allowed since 2026-11-16 (owner: as many stores as possible)
        out[(s["base"].rstrip("/"),s["market"])]={k:s[k] for k in("key","name","base","market")}|{"base":s["base"].rstrip("/")}
lst=sorted(out.values(),key=lambda s:(s["market"],s["key"]))
json.dump(lst,open("data/crawl/own-stores.json","w"),indent=1); open("data/crawl/own-stores.json","a").write("\n")
print(len(lst))
