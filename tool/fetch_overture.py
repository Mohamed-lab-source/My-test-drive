"""Downloads REAL places from Overture Maps (free, open data) for Khroga.

    pip install pyarrow
    python tool/fetch_overture.py build/overture.jsonl

Overture Maps Foundation publishes places gathered from real business
sources (license: CDLA-Permissive-2.0; the app credits it). We only copy
fields; nothing is invented. Output: one JSON object per line.
"""

import json
import os
import re
import sys
import time
import urllib.request

import pyarrow.compute as pc
import pyarrow.dataset as ds
import pyarrow.fs as pafs

BUCKET = "overturemaps-us-west-2"
REGION = "us-west-2"

# Areas to download: (name, lng_min, lng_max, lat_min, lat_max)
AREAS = [
    ("greater_cairo", 30.8, 31.8, 29.7, 30.4),
    ("alexandria", 29.55, 30.2, 30.85, 31.4),
]

MIN_CONFIDENCE = 0.45

# Overture categories (basic_category or taxonomy.primary) worth keeping.
# Shops ("*_store") are kept too, but the builder only uses those inside malls.
KEEP = re.compile(
    r"(restaurant|eatery|food_court|cafe|coffee|bakery|dessert|ice_cream|juice|donut|patisserie|"
    r"lounge|hookah|movie_theater|shopping_mall|escape_room|amusement|arcade|bowling|zoo|aquarium|"
    r"water_park|skating_rink|playcenter|karaoke|laser_tag|billiards|paintball|go_kart|kids_recreation|"
    r"atv_recreation|park$|botanical_garden|museum|art_gallery|theatre_venue|historic_site|monument|"
    r"landmark|horse_riding|horseback_riding|golf_course|skate_park|climbing|boat_tour|boat_rental|beach|"
    r"_store$|^shopping$|department_store)"
)
SKIP = re.compile(r"(airport_lounge|parking|dog_park|mobile_home_park|car_|auto|vehicle|boat_dealer|boat_parts|"
                  r"grilling_equipment|golf_cart|_dealer$|wholesale|b2b)")


def latest_release():
    url = f"https://{BUCKET}.s3.{REGION}.amazonaws.com/?list-type=2&prefix=release/&delimiter=/"
    xml = urllib.request.urlopen(url, timeout=60).read().decode()
    releases = sorted(re.findall(r"<Prefix>release/([^/]+)/</Prefix>", xml))
    if not releases:
        raise RuntimeError("No Overture releases found")
    return releases[-1]


def first(values):
    return values[0] if values else None


def main(out_path):
    release = latest_release()
    print(f"Overture release {release}")
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    fs = pafs.S3FileSystem(anonymous=True, region=REGION, proxy_options=proxy) if proxy \
        else pafs.S3FileSystem(anonymous=True, region=REGION)
    dataset = ds.dataset(f"{BUCKET}/release/{release}/theme=places/type=place",
                         filesystem=fs, format="parquet")
    columns = ["id", "names", "confidence", "basic_category", "taxonomy", "websites",
               "phones", "addresses", "brand", "operating_status", "bbox"]
    kept = 0
    seen = set()
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as out:
        for name, x0, x1, y0, y1 in AREAS:
            started = time.time()
            box = ((pc.field(("bbox", "xmin")) >= x0) & (pc.field(("bbox", "xmax")) <= x1) &
                   (pc.field(("bbox", "ymin")) >= y0) & (pc.field(("bbox", "ymax")) <= y1) &
                   (pc.field("confidence") >= MIN_CONFIDENCE))
            table = dataset.to_table(filter=box, columns=columns)
            area_kept = 0
            for r in table.to_pylist():
                if r["id"] in seen or r.get("operating_status") == "permanently_closed":
                    continue
                tax = (r.get("taxonomy") or {}).get("primary")
                basic = r.get("basic_category")
                cats = " ".join(c for c in (tax, basic) if c)
                if not cats or not KEEP.search(cats) or SKIP.search(cats):
                    continue
                place_name = (r.get("names") or {}).get("primary")
                if not place_name:
                    continue
                address = first(r.get("addresses") or []) or {}
                seen.add(r["id"])
                out.write(json.dumps({
                    "id": r["id"],
                    "name": place_name.strip(),
                    "conf": round(r["confidence"] or 0, 3),
                    "tax": tax,
                    "basic": basic,
                    "lat": round(r["bbox"]["ymin"], 6),
                    "lng": round(r["bbox"]["xmin"], 6),
                    "website": first(r.get("websites") or []),
                    "phone": first(r.get("phones") or []),
                    "brand": ((r.get("brand") or {}).get("names") or {}).get("primary"),
                    "address": address.get("freeform"),
                    "locality": address.get("locality"),
                    "region": address.get("region"),
                }, ensure_ascii=False) + "\n")
                area_kept += 1
            kept += area_kept
            print(f"  {name}: {table.num_rows} places read, {area_kept} kept "
                  f"in {round(time.time() - started)}s")
    print(f"Wrote {kept} Overture places to {out_path}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "build/overture.jsonl")
