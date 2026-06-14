"""Extract the written prose from the team's base report (soft.docx) so the full
report can reuse their actual text/examples for the chapters they already wrote
(Introduction, Software Requirements, Before Sprints / Pricing description).
"""

from __future__ import annotations

from pathlib import Path

from docx import Document

SOFT = Path(__file__).resolve().parents[2] / "soft.docx"


def _size(p):
    for r in p.runs:
        if r.font.size:
            return r.font.size.pt
    return None


def _body(doc):
    """Return the body paragraphs (skip the leading outline block) as (size, text, is_list)."""
    paras = doc.paragraphs
    # body begins at the first chapter heading rendered large (>=20pt)
    start = 0
    for i, p in enumerate(paras):
        if _size(p) and _size(p) >= 20:
            start = i
            break
    out = []
    for p in paras[start:]:
        out.append((_size(p), p.text.strip(), "list" in p.style.name.lower()))
    return out


def emit(rep, start_heading: str, end_heading: str | None):
    """Emit soft.docx prose between two chapter headings into `rep`, mapping the
    base document's manual sizes to rep.h2/h3/bullets/p. The chapter heading itself
    is NOT emitted (rep already added it)."""
    body = _body(Document(str(SOFT)))
    sh = start_heading.strip().lower()
    eh = end_heading.strip().lower() if end_heading else None

    i = 0
    while i < len(body) and body[i][1].strip().lower() != sh:
        i += 1
    i += 1  # skip the start heading
    pending_bullets = []

    def flush():
        if pending_bullets:
            rep.bullets(pending_bullets[:])
            pending_bullets.clear()

    while i < len(body):
        size, text, is_list = body[i]
        if eh and text.strip().lower() == eh:
            break
        if size and size >= 20:  # next chapter — stop
            break
        if not text:
            i += 1
            continue
        if is_list:
            pending_bullets.append(text)
        else:
            flush()
            if size and size >= 15:
                rep.h2(text)
            elif size and size >= 13:
                rep.h3(text)
            else:
                rep.p(text)
        i += 1
    flush()
