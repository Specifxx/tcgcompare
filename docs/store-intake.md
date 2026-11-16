# Adding stores to TCG Prices (standing procedure, 2026-11-16)

Owner's rule: as many stores and listings as possible; vet loosely, keep the hard floors (blocklist, placeholder prices,
too-cheap shelves, HBT Collectibles and other banned hosts).

1. **Where candidates come from.** Store-request issues on each site's GitHub repo (the daily triage issues in
   Specifxx/TCGEmpire, "<site>: N open reports", list each shop's domain and market), the store-finding threads' reports,
   and research files in `/mnt/project-files/tcgcompare/store-research/*.json`.
2. **Write them down.** One JSON array per round in that folder: `{"key","name","base","market"}`, `base` the shop's own
   site, `market` one of US, UK, CA, AU, NZ, EU, SG. Any Shopify shop qualifies, including `*.myshopify.com` ones.
3. **Merge.** `python3 scripts/own-stores-merge.py` adds them to `data/crawl/own-stores.json` (skips hosts a sister already
   lists, `known-hosts.txt`, and banned hosts such as hbtcollectables, tcgsynergy, chromavaults). Commit that file.
4. **The machine does the rest.** The weekly crawl probe keeps a shop only if its robots.txt allows, it answers
   `/meta.json` in its market's currency and a collection names a game. The import then takes listings by TCGplayer id or,
   for every crawled shop, by title (`pickByTitle`). Shops needing a custom reader (not Shopify: Bangerpack, Frontline
   Hobbies) wait for a reader.
5. **Measure.** After the next import, `meta.json` `crawl` has stores read, listings, taken, refused by reason; report
   store offers per game against the products-times-stores ceiling.
