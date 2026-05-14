import argparse
import html
import json
import sqlite3
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

LIST_TEMPLATE = """
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>DPE Minimal Site</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 24px; background: #f8fafc; color: #111827; }}
    h1 {{ margin-bottom: 8px; }}
    .muted {{ color: #6b7280; margin-bottom: 18px; }}
    form {{ display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }}
    input, button {{ padding: 8px 10px; border-radius: 6px; border: 1px solid #d1d5db; }}
    button {{ background: #1f2937; color: #fff; border: none; cursor: pointer; }}
    table {{ border-collapse: collapse; width: 100%; background: #fff; }}
    th, td {{ border: 1px solid #e5e7eb; padding: 8px; font-size: 14px; text-align: left; }}
    th {{ background: #f3f4f6; }}
    .badge {{ padding: 2px 6px; border-radius: 999px; background: #e5e7eb; font-size: 12px; }}
    a {{ color: #1d4ed8; text-decoration: none; }}
  </style>
</head>
<body>
  <h1>Dynamic Pricing Engine - Minimal Site</h1>
  <div class="muted">Reads from SQLite and shows published prices by hotel/room/stay date.</div>

  <form method="get" action="/">
    <input type="text" name="hotel_id" placeholder="hotel_id" value="{hotel_id}">
    <input type="text" name="stay_date" placeholder="stay_date (YYYY-MM-DD)" value="{stay_date}">
    <input type="number" name="limit" placeholder="limit" value="{limit}">
    <button type="submit">Filter</button>
  </form>

  <div class="muted">
    Showing <span class="badge">{row_count}</span> rows.
    API endpoint: <code>/api/published-prices?hotel_id=&stay_date=&limit=</code>
  </div>

  <table>
    <thead>
      <tr>
        <th>hotel_id</th>
        <th>room_type_id</th>
        <th>stay_date</th>
        <th>snapshot_date</th>
        <th>final_price</th>
        <th>updated_at</th>
        <th>in_rollout</th>
        <th>inference_status</th>
        <th>details</th>
      </tr>
    </thead>
    <tbody>
      {rows_html}
    </tbody>
  </table>
</body>
</html>
"""


DETAIL_TEMPLATE = """
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>DPE Decision Detail</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 24px; background: #f8fafc; color: #111827; }}
    h1 {{ margin-bottom: 8px; }}
    h2 {{ margin-top: 22px; margin-bottom: 8px; }}
    .muted {{ color: #6b7280; margin-bottom: 14px; }}
    table {{ border-collapse: collapse; width: 100%; background: #fff; margin-bottom: 12px; }}
    th, td {{ border: 1px solid #e5e7eb; padding: 8px; font-size: 14px; text-align: left; vertical-align: top; }}
    th {{ background: #f3f4f6; width: 280px; }}
    ul {{ background: #fff; border: 1px solid #e5e7eb; padding: 12px 16px; margin: 0; }}
    li {{ margin-bottom: 6px; }}
    a {{ color: #1d4ed8; text-decoration: none; }}
    code {{ background: #eef2ff; padding: 2px 6px; border-radius: 4px; }}
  </style>
</head>
<body>
  <h1>Decision Detail</h1>
  <div class="muted">{key_line}</div>
  <div><a href="/">Back to list</a> | <a href="{api_link}">JSON detail API</a></div>

  <h2>Why This Price Was Chosen</h2>
  <ul>
    {reason_items}
  </ul>

  <h2>Published Output</h2>
  <table>{published_rows}</table>

  <h2>Decision Engine Output</h2>
  <table>{decision_rows}</table>

  <h2>Input Context Used</h2>
  <table>{context_rows}</table>
</body>
</html>
"""


def _safe_int(value: str | None, default: int) -> int:
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _safe_float(value: object) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def query_published_rows(
    db_path: str,
    hotel_id: str | None,
    stay_date: str | None,
    limit: int,
) -> list[sqlite3.Row]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        sql = """
            SELECT p.hotel_id, p.room_type_id, p.stay_date, p.snapshot_date,
                   p.final_price, p.updated_at, p.in_rollout, p.inference_status
            FROM published_prices p
            WHERE 1=1
        """
        params: list[object] = []
        if hotel_id:
            sql += " AND p.hotel_id = ?"
            params.append(int(hotel_id))
        if stay_date:
            sql += " AND p.stay_date = ?"
            params.append(stay_date)

        sql += " ORDER BY p.updated_at DESC, p.stay_date, p.hotel_id, p.room_type_id, p.snapshot_date"
        sql += " LIMIT ?"
        params.append(limit)
        return conn.execute(sql, params).fetchall()
    finally:
        conn.close()


def _query_latest_row(
    conn: sqlite3.Connection,
    table_name: str,
    hotel_id: int,
    room_type_id: int,
    stay_date: str,
    snapshot_date: str,
    order_column: str,
) -> sqlite3.Row | None:
    sql = f"""
        SELECT *
        FROM {table_name}
        WHERE hotel_id = ?
          AND room_type_id = ?
          AND stay_date = ?
          AND snapshot_date = ?
        ORDER BY {order_column} DESC
        LIMIT 1
    """
    return conn.execute(sql, (hotel_id, room_type_id, stay_date, snapshot_date)).fetchone()


def build_reason_summary(detail: dict[str, dict]) -> list[str]:
    published = detail.get("published", {})
    decision = detail.get("decision", {})
    context = detail.get("context", {})
    lines: list[str] = []

    model_version = decision.get("model_version")
    if model_version:
        lines.append(f"Model used: {model_version}")

    prob = _safe_float(decision.get("predicted_probability"))
    exp_rev = _safe_float(decision.get("expected_revenue"))
    final_price = _safe_float(published.get("final_price"))
    if prob is not None and exp_rev is not None and final_price is not None:
        lines.append(
            f"At final price {final_price:.2f}, predicted booking probability is {prob:.4f}, "
            f"expected revenue is {exp_rev:.2f}."
        )

    optimized_price = _safe_float(decision.get("optimized_price"))
    if optimized_price is not None and final_price is not None:
        if abs(optimized_price - final_price) > 1e-6:
            lines.append(f"Optimizer selected {optimized_price:.2f}, then rules adjusted it to {final_price:.2f}.")
        else:
            lines.append("Final price equals optimizer output (no post-optimization change).")

    rules = str(decision.get("rule_adjustments", "") or "").strip()
    if rules and rules.lower() != "none":
        lines.append(f"Applied rules: {rules}")

    status = str(decision.get("inference_status", "") or "")
    if status:
        if status == "ok":
            lines.append("Inference status is OK.")
        elif status == "fallback":
            fallback_reason = str(decision.get("fallback_reason", "") or "")
            lines.append(f"Fallback mode was used. Reason: {fallback_reason or 'unknown'}")
        elif status == "skipped_rollout":
            lines.append("This row was excluded by rollout policy and kept previous/base price.")

    base_price = _safe_float(context.get("base_price"))
    lead_time = context.get("lead_time")
    occupancy = _safe_float(context.get("occupancy_rate"))
    if base_price is not None:
        if occupancy is not None:
            lines.append(
                f"Context included base_price={base_price:.2f}, lead_time={lead_time}, occupancy_rate={occupancy:.4f}."
            )
        else:
            lines.append(f"Context included base_price={base_price:.2f}, lead_time={lead_time}.")

    weekend = context.get("is_weekend")
    holiday = context.get("is_holiday")
    if weekend is not None and holiday is not None:
        lines.append(f"Calendar flags: is_weekend={weekend}, is_holiday={holiday}.")

    return lines or ["No detail data found for this decision."]


def query_decision_detail(
    db_path: str,
    hotel_id: int,
    room_type_id: int,
    stay_date: str,
    snapshot_date: str,
) -> dict[str, dict] | None:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        published_row = _query_latest_row(
            conn,
            "published_prices",
            hotel_id=hotel_id,
            room_type_id=room_type_id,
            stay_date=stay_date,
            snapshot_date=snapshot_date,
            order_column="updated_at",
        )
        if published_row is None:
            return None

        decision_row = _query_latest_row(
            conn,
            "price_decisions",
            hotel_id=hotel_id,
            room_type_id=room_type_id,
            stay_date=stay_date,
            snapshot_date=snapshot_date,
            order_column="created_at",
        )
        context_row = _query_latest_row(
            conn,
            "inventory_snapshots",
            hotel_id=hotel_id,
            room_type_id=room_type_id,
            stay_date=stay_date,
            snapshot_date=snapshot_date,
            order_column="rowid",
        )

        detail = {
            "published": dict(published_row) if published_row else {},
            "decision": dict(decision_row) if decision_row else {},
            "context": dict(context_row) if context_row else {},
        }
        detail["reason_summary"] = build_reason_summary(detail)
        return detail
    finally:
        conn.close()


def _dict_to_rows_html(data: dict[str, object]) -> str:
    if not data:
        return "<tr><td colspan='2'>No data found.</td></tr>"
    rows = []
    for key in sorted(data.keys()):
        value = data[key]
        value_txt = "" if value is None else str(value)
        rows.append(f"<tr><th>{html.escape(str(key))}</th><td>{html.escape(value_txt)}</td></tr>")
    return "\n".join(rows)


def format_detail_html(detail: dict[str, dict]) -> str:
    published = detail.get("published", {})
    decision = detail.get("decision", {})
    context = detail.get("context", {})
    reasons = detail.get("reason_summary", [])

    key_line = (
        f"hotel_id={published.get('hotel_id')} | room_type_id={published.get('room_type_id')} | "
        f"stay_date={published.get('stay_date')} | snapshot_date={published.get('snapshot_date')}"
    )
    api_link = "/api/decision-details?" + urlencode(
        {
            "hotel_id": published.get("hotel_id", ""),
            "room_type_id": published.get("room_type_id", ""),
            "stay_date": published.get("stay_date", ""),
            "snapshot_date": published.get("snapshot_date", ""),
        }
    )
    reason_items = "\n".join(f"<li>{html.escape(str(item))}</li>" for item in reasons)

    return DETAIL_TEMPLATE.format(
        key_line=html.escape(key_line),
        api_link=html.escape(api_link),
        reason_items=reason_items,
        published_rows=_dict_to_rows_html(published),
        decision_rows=_dict_to_rows_html(decision),
        context_rows=_dict_to_rows_html(context),
    )


def format_rows_html(rows: list[sqlite3.Row]) -> str:
    if not rows:
        return "<tr><td colspan='9'>No rows found.</td></tr>"

    parts: list[str] = []
    for row in rows:
        query = urlencode(
            {
                "hotel_id": row["hotel_id"],
                "room_type_id": row["room_type_id"],
                "stay_date": row["stay_date"],
                "snapshot_date": row["snapshot_date"],
            }
        )
        details_link = f"/decision?{query}"
        final_price = _safe_float(row["final_price"])
        final_price_txt = f"{final_price:.2f}" if final_price is not None else ""

        parts.append(
            "<tr>"
            f"<td>{row['hotel_id']}</td>"
            f"<td>{row['room_type_id']}</td>"
            f"<td>{html.escape(str(row['stay_date']))}</td>"
            f"<td>{html.escape(str(row['snapshot_date']))}</td>"
            f"<td>{final_price_txt}</td>"
            f"<td>{html.escape(str(row['updated_at']))}</td>"
            f"<td>{row['in_rollout']}</td>"
            f"<td>{html.escape(str(row['inference_status']))}</td>"
            f"<td><a href='{html.escape(details_link)}'>details</a></td>"
            "</tr>"
        )
    return "\n".join(parts)


class MinimalSiteHandler(BaseHTTPRequestHandler):
    db_path = "data/dpe_demo.db"

    def _send_html(self, html_payload: str, status: int = 200) -> None:
        payload = html_payload.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _send_json(self, obj: object, status: int = 200) -> None:
        payload = json.dumps(obj, indent=2, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _read_common_query(self) -> dict[str, object]:
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        hotel_id_raw = (query.get("hotel_id", [""])[0] or "").strip()
        stay_date = (query.get("stay_date", [""])[0] or "").strip() or None
        snapshot_date = (query.get("snapshot_date", [""])[0] or "").strip() or None
        room_type_id_raw = (query.get("room_type_id", [""])[0] or "").strip()
        limit_raw = (query.get("limit", ["50"])[0] or "").strip() or "50"
        limit = max(1, min(500, _safe_int(limit_raw, 50)))
        return {
            "parsed": parsed,
            "hotel_id_raw": hotel_id_raw,
            "room_type_id_raw": room_type_id_raw,
            "stay_date": stay_date,
            "snapshot_date": snapshot_date,
            "limit": limit,
        }

    def do_GET(self) -> None:  # noqa: N802
        ctx = self._read_common_query()
        parsed = ctx["parsed"]
        hotel_id_raw = ctx["hotel_id_raw"]
        room_type_id_raw = ctx["room_type_id_raw"]
        stay_date = ctx["stay_date"]
        snapshot_date = ctx["snapshot_date"]
        limit = ctx["limit"]

        if parsed.path == "/api/published-prices":
            rows = query_published_rows(self.db_path, hotel_id_raw or None, stay_date, limit)
            self._send_json([dict(row) for row in rows])
            return

        if parsed.path == "/api/decision-details":
            if not (hotel_id_raw and room_type_id_raw and stay_date and snapshot_date):
                self._send_json(
                    {
                        "error": "Required params: hotel_id, room_type_id, stay_date, snapshot_date",
                    },
                    status=400,
                )
                return
            detail = query_decision_detail(
                db_path=self.db_path,
                hotel_id=_safe_int(hotel_id_raw, -1),
                room_type_id=_safe_int(room_type_id_raw, -1),
                stay_date=stay_date,
                snapshot_date=snapshot_date,
            )
            if detail is None:
                self._send_json({"error": "Decision not found for provided keys."}, status=404)
                return
            self._send_json(detail)
            return

        if parsed.path == "/decision":
            if not (hotel_id_raw and room_type_id_raw and stay_date and snapshot_date):
                self._send_html(
                    "<h1>Missing params</h1>"
                    "<p>Required: hotel_id, room_type_id, stay_date, snapshot_date</p>"
                    "<p><a href='/'>Back</a></p>",
                    status=400,
                )
                return
            detail = query_decision_detail(
                db_path=self.db_path,
                hotel_id=_safe_int(hotel_id_raw, -1),
                room_type_id=_safe_int(room_type_id_raw, -1),
                stay_date=stay_date,
                snapshot_date=snapshot_date,
            )
            if detail is None:
                self._send_html(
                    "<h1>Decision not found</h1><p><a href='/'>Back</a></p>",
                    status=404,
                )
                return
            self._send_html(format_detail_html(detail))
            return

        if parsed.path == "/":
            rows = query_published_rows(self.db_path, hotel_id_raw or None, stay_date, limit)
            html_page = LIST_TEMPLATE.format(
                hotel_id=html.escape(hotel_id_raw or ""),
                stay_date=html.escape(stay_date or ""),
                limit=limit,
                row_count=len(rows),
                rows_html=format_rows_html(rows),
            )
            self._send_html(html_page)
            return

        self._send_html("<h1>Not found</h1>", status=404)


def main() -> None:
    parser = argparse.ArgumentParser(description="Minimal local site for DPE integration testing.")
    parser.add_argument("--db-path", default="data/dpe_demo.db")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    db_file = Path(args.db_path)
    if not db_file.exists():
        raise FileNotFoundError(f"DB not found: {db_file}. Run DB initialization/load scripts first.")

    MinimalSiteHandler.db_path = str(db_file)
    server = HTTPServer((args.host, args.port), MinimalSiteHandler)
    print(f"Minimal site running at http://{args.host}:{args.port}")
    print(f"Using DB: {db_file}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
