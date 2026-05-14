from typing import Any

from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def get_preprocessor_feature_groups(schema: dict[str, Any]) -> tuple[list[str], list[str]]:
    """
    Return the feature groups used in the shared preprocessing pipeline.
    Categorical fields use one-hot encoding, numerics use median imputation.
    """
    categorical_features = schema["categorical_feature_columns"]
    optional = schema["optional_feature_columns"]
    missing_flags = [f"{column}_missing_flag" for column in optional]

    numeric_features = schema["numeric_feature_columns"] + optional + missing_flags
    return categorical_features, numeric_features


def build_preprocessor(schema: dict[str, Any]) -> ColumnTransformer:
    categorical_features, numeric_features = get_preprocessor_feature_groups(schema)

    categorical_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("encoder", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )

    return ColumnTransformer(
        transformers=[
            ("categorical", categorical_pipeline, categorical_features),
            ("numeric", numeric_pipeline, numeric_features),
        ],
        remainder="drop",
    )
