#!/usr/bin/env python3
import json
import sys

bg_path = "/home/dejan/Tigo Energy SHOP/tigoenergy/src/messages/bg.json"
static_path = "/home/dejan/Tigo Energy SHOP/tigoenergy/src/messages/bg_staticPages.json"

with open(bg_path, "r", encoding="utf-8") as f:
    bg = json.load(f)

with open(static_path, "r", encoding="utf-8") as f:
    static_pages = json.load(f)

bg["staticPages"] = static_pages

with open(bg_path, "w", encoding="utf-8") as f:
    json.dump(bg, f, ensure_ascii=False, indent=2)
    f.write("\n")

print("Done. staticPages merged into bg.json.")
