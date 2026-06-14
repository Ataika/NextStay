#!/usr/bin/env python3
"""Build the most complete 'our variant' report → docs/report/NextStay_Report_FULL.docx.

Reuses soft.docx prose (Introduction, Software Requirements), authors every other
chapter, embeds all diagrams + the live screenshots, and appends an appendix of
key listings. Optional --template inherits a base document's styles.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
os.environ.setdefault("REPORT_OUT", str(ROOT / "docs" / "report" / "NextStay_Report_FULL.docx"))
sys.path.insert(0, str(ROOT))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--template", default=os.getenv("REPORT_TEMPLATE"))
    args = ap.parse_args()

    from scripts.report.build_report import OUT, Report
    from scripts.report.full_content import write_full

    rep = Report(args.template)
    rep.title_page()
    rep.toc()
    write_full(rep)
    rep.save()
    print(f"FULL report written: {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
