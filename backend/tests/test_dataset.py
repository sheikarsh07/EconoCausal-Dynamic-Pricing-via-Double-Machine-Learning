"""
test_dataset.py — Tests for the CSV loading and validation module.
"""
import io
import numpy as np
import pandas as pd
import pytest

from core.dataset import (
    validate_csv,
    prepare_model_data,
    REQUIRED_COLUMNS,
    MIN_ROWS,
    COVARIATE_COLUMNS,
    TREATMENT_COLUMN,
    OUTCOME_BINARY_COLUMN,
)


def df_to_bytes(df: pd.DataFrame) -> bytes:
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return buf.getvalue().encode()


class TestValidCsv:
    def test_valid_dataset_passes(self, valid_csv_bytes):
        result = validate_csv(valid_csv_bytes)
        assert result.is_valid, f"Expected valid but got errors: {result.errors}"

    def test_valid_dataset_has_no_errors(self, valid_csv_bytes):
        result = validate_csv(valid_csv_bytes)
        assert result.errors == []

    def test_summary_contains_expected_keys(self, valid_csv_bytes):
        result = validate_csv(valid_csv_bytes)
        for key in ["n_rows", "n_treated", "n_control", "treatment_rate"]:
            assert key in result.summary, f"Missing summary key: {key}"

    def test_summary_n_rows_correct(self, valid_df, valid_csv_bytes):
        result = validate_csv(valid_csv_bytes)
        assert result.summary["n_rows"] == len(valid_df)

    def test_dataframe_returned_on_success(self, valid_csv_bytes):
        result = validate_csv(valid_csv_bytes)
        assert result.dataframe is not None
        assert isinstance(result.dataframe, pd.DataFrame)


class TestMissingColumns:
    def test_missing_single_required_column(self, valid_df):
        df = valid_df.drop(columns=["discount_received"])
        result = validate_csv(df_to_bytes(df))
        assert not result.is_valid
        assert any("discount_received" in e for e in result.errors)

    def test_missing_multiple_columns(self, valid_df):
        df = valid_df.drop(columns=["purchased", "revenue", "age"])
        result = validate_csv(df_to_bytes(df))
        assert not result.is_valid
        # All missing columns should be mentioned
        joined = " ".join(result.errors)
        assert "purchased" in joined or "revenue" in joined or "age" in joined

    def test_empty_csv_is_invalid(self):
        result = validate_csv(b"")
        assert not result.is_valid


class TestRowCount:
    def test_too_few_rows_is_invalid(self, valid_df):
        df = valid_df.head(MIN_ROWS - 1)
        # Make sure both treatment groups still exist
        df = df.copy()
        df.loc[0, "discount_received"] = 1
        df.loc[1, "discount_received"] = 0
        result = validate_csv(df_to_bytes(df))
        assert not result.is_valid
        assert any(str(MIN_ROWS) in e for e in result.errors)

    def test_exactly_min_rows_is_valid(self, small_valid_df):
        # small_valid_df has exactly 50 rows (MIN_ROWS)
        result = validate_csv(df_to_bytes(small_valid_df))
        # It should be valid (50 >= 50)
        assert result.is_valid


class TestMissingValues:
    def test_missing_values_in_treatment_column(self, valid_df):
        df = valid_df.copy()
        df.loc[0, "discount_received"] = np.nan
        result = validate_csv(df_to_bytes(df))
        assert not result.is_valid
        assert any("discount_received" in e for e in result.errors)

    def test_missing_values_in_covariate(self, valid_df):
        df = valid_df.copy()
        df.loc[5, "past_spend"] = np.nan
        result = validate_csv(df_to_bytes(df))
        assert not result.is_valid
        assert any("past_spend" in e for e in result.errors)


class TestBinaryColumns:
    def test_treatment_with_invalid_value(self, valid_df):
        df = valid_df.copy()
        df.loc[0, "discount_received"] = 2   # invalid
        result = validate_csv(df_to_bytes(df))
        assert not result.is_valid
        assert any("discount_received" in e for e in result.errors)

    def test_outcome_with_invalid_value(self, valid_df):
        df = valid_df.copy()
        df.loc[0, "purchased"] = -1   # invalid
        result = validate_csv(df_to_bytes(df))
        assert not result.is_valid

    def test_valid_binary_values_pass(self, valid_df):
        # Ensure standard 0/1 values are not flagged
        result = validate_csv(df_to_bytes(valid_df))
        assert result.is_valid


class TestDuplicateCustomerIds:
    def test_duplicate_ids_produce_warning(self, valid_df):
        df = valid_df.copy()
        df.loc[1, "customer_id"] = df.loc[0, "customer_id"]  # duplicate
        result = validate_csv(df_to_bytes(df))
        # Duplicates are a warning, not an error
        assert any("duplicate" in w.lower() for w in result.warnings)


class TestTreatmentGroups:
    def test_all_treated_is_invalid(self, valid_df):
        df = valid_df.copy()
        df["discount_received"] = 1
        result = validate_csv(df_to_bytes(df))
        assert not result.is_valid
        assert any("control" in e.lower() or "0" in e for e in result.errors)

    def test_all_control_is_invalid(self, valid_df):
        df = valid_df.copy()
        df["discount_received"] = 0
        result = validate_csv(df_to_bytes(df))
        assert not result.is_valid


class TestPrepareModelData:
    def test_X_contains_only_covariates(self, valid_df):
        result = validate_csv(df_to_bytes(valid_df))
        assert result.is_valid
        data = prepare_model_data(result.dataframe)
        assert list(data.X.columns) == COVARIATE_COLUMNS

    def test_customer_id_not_in_X(self, valid_df):
        result = validate_csv(df_to_bytes(valid_df))
        data = prepare_model_data(result.dataframe)
        assert "customer_id" not in data.X.columns

    def test_T_is_treatment_column(self, valid_df):
        result = validate_csv(df_to_bytes(valid_df))
        data = prepare_model_data(result.dataframe)
        assert data.T.name == TREATMENT_COLUMN

    def test_Y_is_outcome_column(self, valid_df):
        result = validate_csv(df_to_bytes(valid_df))
        data = prepare_model_data(result.dataframe)
        assert data.Y.name == OUTCOME_BINARY_COLUMN

    def test_lengths_match(self, valid_df):
        result = validate_csv(df_to_bytes(valid_df))
        data = prepare_model_data(result.dataframe)
        n = len(valid_df)
        assert len(data.X) == n
        assert len(data.T) == n
        assert len(data.Y) == n
        assert len(data.customer_ids) == n
