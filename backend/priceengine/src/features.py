import json
from pathlib import Path
from typing import Any

import pandas as pd


def load_schema(schema_path: str | Path) -> dict[str, Any]:
    """Load the feature contract used by both training and inference."""
    with open(schema_path, encoding="utf-8") as handle:
        return json.load(handle)


def get_required_raw_columns(schema: dict[str, Any], include_target: bool = True) -> list[str]:
    columns = schema["required_identifier_columns"] + schema["date_columns"] + schema["required_feature_columns"]
    if include_target:
        columns = columns + [schema["target_column"]]
    return columns


def ensure_required_columns(df: pd.DataFrame, schema: dict[str, Any], include_target: bool = True) -> None:
    required = set(get_required_raw_columns(schema, include_target=include_target))
    missing = sorted(required - set(df.columns))
    if missing:
        missing_str = ", ".join(missing)
        raise ValueError(f"Input dataset is missing required columns: {missing_str}")


def add_optional_features_and_missing_flags(df: pd.DataFrame, optional_feature_columns: list[str]) -> pd.DataFrame:
    """
    Ensure optional features always exist and add *_missing_flag columns.
    This keeps one stable feature interface across hotels.
    """
    out = df.copy()
    for column in optional_feature_columns:
        if column not in out.columns:
            out[column] = pd.NA
        out[f"{column}_missing_flag"] = out[column].isna().astype(int)
    return out


def parse_dates(df: pd.DataFrame, date_columns: list[str]) -> pd.DataFrame:
    out = df.copy()
    for column in date_columns:
        out[column] = pd.to_datetime(out[column], errors="coerce")
    return out


def prepare_model_dataframe(
    df: pd.DataFrame,
    schema: dict[str, Any],
    include_target: bool = True,
) -> pd.DataFrame:
    """
    Create a model-ready dataframe with a fixed schema.
    Steps:
    1) validate required columns
    2) parse dates
    3) attach optional columns + missing flags
    """
    ensure_required_columns(df, schema, include_target=include_target)
    prepared = parse_dates(df, schema["date_columns"])
    prepared = add_optional_features_and_missing_flags(prepared, schema["optional_feature_columns"])
    return prepared


def get_model_feature_columns(schema: dict[str, Any]) -> list[str]:
    optional = schema["optional_feature_columns"]
    missing_flags = [f"{column}_missing_flag" for column in optional]
    return schema["categorical_feature_columns"] + schema["numeric_feature_columns"] + optional + missing_flags
