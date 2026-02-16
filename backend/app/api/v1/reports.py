from typing import Any, Optional

from app.db.session import SessionLocal
from app.models.user import User as UserModel
from app.security.auth import get_user_company_scope, require_roles
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

router = APIRouter(tags=["reports"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class ReportOverviewResponse(BaseModel):
    companyCode: Optional[str]
    days: int
    kpis: dict[str, float]
    revparTrend: list[dict[str, Any]]
    roomTypeRevenue: list[dict[str, Any]]
    tasksTrend: list[dict[str, Any]]
    loyalty: list[dict[str, Any]]


@router.get("/reports/overview", response_model=ReportOverviewResponse)
def get_reports_overview(
    company_code: Optional[str] = Query(default=None, alias="companyCode"),
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_roles("OWNER", "STAFF")),
):
    scoped_company = get_user_company_scope(current_user)
    # OWNER/STAFF can only access their own company data.
    if company_code and company_code != scoped_company:
        company_code = scoped_company
    elif not company_code:
        company_code = scoped_company

    filter_sql = "AND company_code = :company_code" if company_code else ""
    params: dict[str, Any] = {"days": days}
    if company_code:
        params["company_code"] = company_code

    kpi_query = text(
        f"""
        SELECT
          COALESCE(SUM(total_revenue), 0)::float AS total_revenue,
          COALESCE(SUM(bookings_count), 0)::int AS bookings_count,
          COALESCE(AVG(occupancy_rate), 0)::float AS avg_occupancy_rate,
          COALESCE(AVG(adr), 0)::float AS avg_adr,
          COALESCE(AVG(revpar), 0)::float AS avg_revpar
        FROM mart.bookings_daily
        WHERE date_day >= current_date - CAST(:days AS int)
          {filter_sql}
        """
    )
    kpis = dict(db.execute(kpi_query, params).mappings().first() or {})

    revpar_query = text(
        f"""
        SELECT
          company_code,
          date_day,
          total_revenue::float AS total_revenue,
          revpar::float AS revpar,
          occupancy_rate::float AS occupancy_rate
        FROM mart.bookings_daily
        WHERE date_day >= current_date - CAST(:days AS int)
          {filter_sql}
        ORDER BY date_day ASC
        """
    )
    revpar_trend = [dict(row) for row in db.execute(revpar_query, params).mappings().all()]

    room_type_query = text(
        f"""
        SELECT
          company_code,
          room_type,
          COALESCE(SUM(total_revenue), 0)::float AS total_revenue,
          COALESCE(SUM(bookings_count), 0)::int AS bookings_count,
          COALESCE(AVG(adr), 0)::float AS avg_adr
        FROM mart.revenue_by_room_type_daily
        WHERE date_day >= current_date - CAST(:days AS int)
          {filter_sql}
        GROUP BY company_code, room_type
        ORDER BY total_revenue DESC
        """
    )
    room_type_revenue = [dict(row) for row in db.execute(room_type_query, params).mappings().all()]

    tasks_query = text(
        f"""
        SELECT
          company_code,
          date_day,
          tasks_created,
          tasks_completed,
          completion_rate::float AS completion_rate
        FROM mart.tasks_daily
        WHERE date_day >= current_date - CAST(:days AS int)
          {filter_sql}
        ORDER BY date_day ASC
        """
    )
    tasks_trend = [dict(row) for row in db.execute(tasks_query, params).mappings().all()]

    loyalty_query = text(
        f"""
        SELECT
          company_code,
          loyalty_tier,
          COUNT(*)::int AS customers
        FROM mart.customer_loyalty
        WHERE 1=1
          {filter_sql}
        GROUP BY company_code, loyalty_tier
        ORDER BY customers DESC
        """
    )
    loyalty = [dict(row) for row in db.execute(loyalty_query, params).mappings().all()]

    return ReportOverviewResponse(
        companyCode=company_code,
        days=days,
        kpis={
            "totalRevenue": float(kpis.get("total_revenue", 0.0)),
            "bookingsCount": float(kpis.get("bookings_count", 0.0)),
            "avgOccupancyRate": float(kpis.get("avg_occupancy_rate", 0.0)),
            "avgAdr": float(kpis.get("avg_adr", 0.0)),
            "avgRevpar": float(kpis.get("avg_revpar", 0.0)),
        },
        revparTrend=revpar_trend,
        roomTypeRevenue=room_type_revenue,
        tasksTrend=tasks_trend,
        loyalty=loyalty,
    )
