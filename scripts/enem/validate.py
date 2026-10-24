"""Validate the pinned corpus against INEP answer keys; never writes to Supabase."""
import argparse
import collections
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import urlparse, unquote

import pymupdf
from PIL import Image

COMMIT = "938c56fbd3b391e03d93316c920a90c3e54842e5"


def plain(text):
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if unicodedata.category(c) != "Mn")


def answer_key(path, year):
    result = {}
    for page in pymupdf.open(path):
        words = page.get_text("words")
        if not words:
            continue
        pairs = {}
        for word in words:
            if not re.fullmatch(r"[0-9]+", word[4]) or not 1 <= int(word[4]) <= 180:
                continue
            row = sorted([w for w in words if abs(w[1] - word[1]) < 2.8 and w[0] > word[2]], key=lambda w: w[0])
            next_number = next((w[0] for w in row if w[4].isdigit()), float("inf"))
            answers = [w for w in row if w[0] < next_number and w[0] - word[2] < 180 and re.fullmatch(r"[A-E]|[Aa]nulad[ao]|\*", w[4])]
            if not answers:
                continue
            if year == 2009:
                blue = next((w for w in words if w[4] == "Azul"), None)
                if not blue or abs(word[0] - blue[0]) > 35:
                    continue
            number = int(word[4])
            mapping = {"default": answers[0][4]}
            if len(answers) == 2:
                # The INEP tables label their two language columns explicitly.
                labels = [w for w in words if plain(w[4]) in ("ingles", "espanhol")]
                for answer in answers:
                    if labels:
                        label = min(labels, key=lambda w: abs((w[0]+w[2])/2 - (answer[0]+answer[2])/2))
                        mapping[plain(label[4])] = answer[4]
            pairs[number] = mapping
        # A prose page from the 2010 booklet must never be mistaken for an answer table.
        if len(pairs) >= 40:
            result.update(pairs)
    return result


def official_area(year, number):
    if number >= 136:
        return "mathematics"
    if year >= 2017:
        return "languages" if number <= 45 else "humanities" if number <= 90 else "nature"
    if number >= 91:
        return "languages"
    if year == 2009:
        return "nature" if number <= 45 else "humanities"
    return "humanities" if number <= 45 else "nature"


def clean_markdown(text):
    text = (text or "").replace("\r\n", "\n")
    text = re.sub(r"<sub>([0-9+-]+)</sub>", lambda m: m[1].translate(str.maketrans("0123456789+-", "₀₁₂₃₄₅₆₇₈₉₊₋")), text, flags=re.I)
    text = re.sub(r"<sup>([0-9+-]+)</sup>", lambda m: m[1].translate(str.maketrans("0123456789+-", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻")), text, flags=re.I)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    # HTML tags can themselves be an answer (e.g. an HTML programming question).
    return re.sub(r"</?[a-zA-Z][^>\n]*>", lambda m: m[0].replace("<", "&lt;").replace(">", "&gt;"), text).strip()


def insufficient_context(area, context, prompt):
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", context).strip()
    # Formula/diagram-only STEM imports often lost the entire introductory paragraph.
    return len(prompt) < 180 and ((not text and "![" not in context) or (area in ("nature", "mathematics") and len(text) < 80))


def validate(source, output):
    manifest = json.loads((output / "official-sources.json").read_text(encoding="utf8"))
    if manifest["commit"] != COMMIT:
        raise ValueError("O manifesto não corresponde ao commit fixado")
    years = {r["year"]: r for r in manifest["years"]}
    keys = {}
    for year, info in years.items():
        for doc in info["documents"]:
            keys[year, doc["day"]] = answer_key(output / doc["file"], year)
    assets = output / "assets"
    assets.mkdir(exist_ok=True)
    approved, quarantine, corrected = [], [], []
    exclusions = json.loads((Path(__file__).parent / "exclusions.json").read_text(encoding="utf8"))
    fingerprints = {}
    for path in sorted(source.glob("*/questions/*/details.json")):
        q = json.loads(path.read_text(encoding="utf8"))
        year, number, language = q.get("year"), q.get("index"), q.get("language")
        qid = f"enem-{year}-regular-{number}" + (f"-{language}" if language else "")
        reasons = []
        if qid in exclusions:
            reasons.append(exclusions[qid])
        if year not in years or not isinstance(number, int) or not 1 <= number <= 180:
            quarantine.append({"id": qid, "reasons": ["invalid_identity"]})
            continue
        area = official_area(year, number)
        if language not in (None, "ingles", "espanhol"):
            reasons.append("invalid_language")
        foreign = year >= 2010 and (1 <= number <= 5 if year >= 2017 else 91 <= number <= 95)
        if foreign != bool(language):
            reasons.append("language_not_identified")
        day = (1 if number <= 90 else 2)
        official = keys.get((year, day), {}).get(number)
        answer = official.get(language or "default") if official else None
        if answer not in list("ABCDE"):
            reasons.append("annulled" if answer and plain(answer).startswith("anulad") else "official_answer_unverified")
        elif answer != q.get("correctAlternative"):
            reasons.append("answer_mismatch")
        alternatives = q.get("alternatives", [])
        if len(alternatives) != 5 or [a.get("letter") for a in alternatives] != list("ABCDE"):
            reasons.append("invalid_alternatives")
        if sum(a.get("isCorrect") is True for a in alternatives) != 1 or any(a.get("isCorrect") is True and a.get("letter") != q.get("correctAlternative") for a in alternatives):
            reasons.append("inconsistent_answer_flags")
        context, prompt = clean_markdown(q.get("context")), clean_markdown(q.get("alternativesIntroduction"))
        if len(context + prompt) < 35 or len(prompt) < 5 or "�" in context + prompt:
            reasons.append("incomplete_text")
        if insufficient_context(area, context, prompt):
            reasons.append("context_requires_review")
        local_assets = {}

        def image_url(url):
            if not url:
                return None
            if url in local_assets:
                return local_assets[url]
            parsed = urlparse(url)
            rel = unquote(parsed.path).lstrip("/")
            target = (source / rel).resolve()
            if parsed.hostname not in ("enem.dev", "api.enem.dev") or not target.is_relative_to(source.resolve()) or "broken-image" in rel or not target.is_file():
                reasons.append("missing_image")
                return url
            try:
                with Image.open(target) as image:
                    image.verify()
                ext = target.suffix.lower()
                data = target.read_bytes()
                if ext == ".bmp":
                    import io
                    buffer = io.BytesIO()
                    with Image.open(target) as image:
                        image.save(buffer, format="PNG")
                    data, ext = buffer.getvalue(), ".png"
                if ext not in (".jpg", ".jpeg", ".png", ".webp"):
                    raise ValueError("Unsupported image")
                name = hashlib.sha256(data).hexdigest() + ext
                if not (assets / name).exists():
                    (assets / name).write_bytes(data)
                local_assets[url] = f"__ENEM_ASSETS__/{name}"
                return local_assets[url]
            except Exception:
                reasons.append("invalid_image")
                return url

        def rewrite(text):
            return re.sub(r"!\[([^\]]*)\]\((https?://[^\s)]+)(?:\s+\"[^\"]*\")?\)", lambda m: f"![{m[1]}]({image_url(m[2])})", text)

        context, prompt = rewrite(context), rewrite(prompt)
        for url in q.get("files", []):
            own = image_url(url)
            if own and own not in context + prompt:
                reasons.append("unplaced_image")
        normalized = [{"letter": a.get("letter"), "text": rewrite(clean_markdown(a.get("text"))), "image": image_url(a.get("file"))} for a in alternatives]
        if any(not a["text"] and not a["image"] for a in normalized):
            reasons.append("empty_alternative")
        if "https://enem.dev/" in context + prompt + json.dumps(normalized):
            reasons.append("unresolved_media")
        fingerprint = hashlib.sha256(re.sub(r"\s+", " ", context + prompt + json.dumps(normalized, ensure_ascii=False, sort_keys=True)).encode()).hexdigest()
        if fingerprint in fingerprints:
            reasons.append("duplicate_content")
        else:
            fingerprints[fingerprint] = qid
        if reasons:
            quarantine.append({"id": qid, "reasons": sorted(set(reasons)), "file": str(path.relative_to(source)), "officialAnswer": answer})
            continue
        original_area = {"matematica": "mathematics", "ciencias-natureza": "nature", "ciencias-humanas": "humanities", "linguagens": "languages"}.get(q.get("discipline"))
        if area != original_area:
            corrected.append({"id": qid, "from": original_area, "to": area, "reason": "official_exam_numbering"})
        document = next(d for d in years[year]["documents"] if d["day"] == day)
        approved.append({
            "id": qid, "year": year, "number": number, "area": area, "language": language,
            "context": context, "prompt": prompt, "alternatives": normalized, "correct_index": ord(answer) - 65,
            "source": {"application": "Regular", "booklet": f"{1 if day == 1 else 7} · Azul", "page": years[year]["page"], "answerKey": document["url"], "commit": COMMIT},
            "source_commit": COMMIT, "checksum": fingerprint,
        })
    report = {"commit": COMMIT, "total": len(approved) + len(quarantine), "approved": len(approved), "quarantined": len(quarantine),
              "byYear": dict(collections.Counter(q["year"] for q in approved)), "byArea": dict(collections.Counter(q["area"] for q in approved)),
              "reasons": dict(collections.Counter(r for q in quarantine for r in q["reasons"])), "correctedAreas": corrected, "quarantine": quarantine,
              "officialKeys": {f"{y}-day{d}": len(k) for (y, d), k in keys.items()}}
    (output / "approved.json").write_text(json.dumps(approved, ensure_ascii=False), encoding="utf8")
    (output / "validation.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps({k: v for k, v in report.items() if k not in ("quarantine", "correctedAreas")}, ensure_ascii=True))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("output/enem-source/public"))
    parser.add_argument("--output", type=Path, default=Path("output/enem"))
    args = parser.parse_args()
    validate(args.source, args.output)
