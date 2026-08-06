"""
parser.py — PCP file loading with multi-sheet and single-sheet stage-split support.

Two PCP structures handled:
  Structure 1 — One file, multiple sheets.
      Each sheet is a separate stage / WI.
      User selects which sheets to process via the UI.
      Entry point: get_sheet_names() + load_pcp_sheet()

  Structure 2 — One file, one sheet, multiple stages embedded.
      Stages are separated by a "Control Plan No." header row that ends with
      a stage suffix like /01, /02, /03 …
      The header block repeats before each stage's data rows.
      Entry point: load_pcp() returns a single merged DataFrame (existing behaviour)
                   split_pcp_by_stage() returns {stage_label: DataFrame}

All existing public API is preserved so nothing else in the project breaks.
"""

import os
import re
import pandas as pd


# ── Column normalisation ──────────────────────────────────────────────────────

COLUMN_ALIASES = {
    "process name":          "Process Name",
    "process":               "Process Name",
    "operation":             "Process Name",
    "machine":               "Machine",
    "machine / device":      "Machine",
    "equipment":             "Machine",
    "product characteristic":"Product Characteristic",
    "product char":          "Product Characteristic",
    "process characteristic":"Process Characteristic",
    "process char":          "Process Characteristic",
    "specification":         "Specification",
    "spec":                  "Specification",
    "tolerance":             "Specification",
    "control method":        "Control Method",
    "method":                "Control Method",
    "inspection method":     "Control Method",
    "reaction plan":         "Reaction Plan",
    "reaction":              "Reaction Plan",
    "corrective action":     "Reaction Plan",
    "sample size":           "Sample Size",
    "frequency":             "Frequency",
    "tool":                  "Tool",
    "tooling":               "Tool",
}

# Patterns that identify a "Control Plan No." cell value, e.g.:
#   "550261000106PCP/01"  "PCP/02"  "CP-001/03"  "WI/01"
_STAGE_SUFFIX_RE = re.compile(r"[/\-](\d{2})$")

# Patterns for header / separator rows we want to skip when building DataFrames
_HEADER_LIKE = re.compile(
    r"(control\s*plan|process\s*control|part\s*no|drawing\s*no|"
    r"rev(ision)?|doc\s*no|date|prepared\s*by|approved)",
    re.IGNORECASE,
)


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    rename_map = {}
    for col in df.columns:
        key = str(col).strip().lower()
        if key in COLUMN_ALIASES:
            rename_map[col] = COLUMN_ALIASES[key]
    return df.rename(columns=rename_map)


# ── Column sanitization & deduplication ───────────────────────────────────────

def _sanitize_column_name(name: str) -> str:
    """
    Remove special characters, quotes, slashes from column names.
    Preserve alphanumeric, spaces, and underscores.
    """
    # Remove leading/trailing whitespace
    name = name.strip()
    # Remove single and double quotes
    name = name.replace("'", "").replace('"', "")
    # Replace slashes, hyphens, and parentheses with space
    name = name.replace("/", " ").replace("-", " ").replace("(", " ").replace(")", " ")
    # Remove other problematic special characters (keep only alphanumeric, space, underscore)
    name = re.sub(r"[^a-zA-Z0-9\s_]", "", name)
    # Collapse multiple spaces into one
    name = " ".join(name.split())
    return name


def _deduplicate_columns(cols: list[str]) -> list[str]:
    """
    Handle duplicate column names by appending _1, _2, etc. to duplicates.
    Also sanitizes names before deduplication.
    
    Example:
        ['Process Name', 'Machine', 'Reaction Plan', 'Reaction Plan', '']
        →
        ['Process Name', 'Machine', 'Reaction Plan', 'Reaction Plan_1', '_col4']
    """
    sanitized = [_sanitize_column_name(c) if c else f"_col{i}" 
                 for i, c in enumerate(cols)]
    
    seen = {}
    result = []
    
    for i, col in enumerate(sanitized):
        if not col or col.isspace():
            col = f"_col{i}"
        
        # If we've seen this column name before, append a counter
        if col in seen:
            seen[col] += 1
            result.append(f"{col}_{seen[col]}")
        else:
            seen[col] = 0
            result.append(col)
    
    return result


# ── Low-level readers ─────────────────────────────────────────────────────────

def _read_raw_sheet(file_path: str, sheet_name=0) -> pd.DataFrame:
    """Read one Excel sheet without assuming headers — raw layout."""
    ext = os.path.splitext(file_path)[-1].lower()
    if ext in (".xlsx", ".xls"):
        return pd.read_excel(file_path, sheet_name=sheet_name,
                             header=None, dtype=str).fillna("")
    raise ValueError(f"_read_raw_sheet only supports .xlsx/.xls, got '{ext}'")


def _read_csv_raw(file_path: str) -> pd.DataFrame:
    for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
        try:
            return pd.read_csv(file_path, header=None,
                               dtype=str, encoding=enc).fillna("")
        except UnicodeDecodeError:
            continue
    raise ValueError("Could not decode CSV — try saving as UTF-8.")


def _df_from_raw(raw: pd.DataFrame) -> pd.DataFrame:
    """
    Given a raw (no-header) DataFrame, detect the header row (first row
    that contains column-like labels), set it as column names, and return
    the data rows below it, normalised.
    
    Handles:
    - Duplicate column names (appends _1, _2, etc.)
    - Malformed names (removes special chars, quotes, slashes)
    - Empty columns (filters them out after processing)
    """
    if raw.empty:
        return pd.DataFrame()

    header_row_idx = None
    for i, row in raw.iterrows():
        vals = [str(v).strip() for v in row.values if str(v).strip()]
        # A header row has ≥3 non-empty cells and at least one matches our aliases
        if len(vals) >= 3:
            matches = sum(
                1 for v in vals
                if v.lower() in COLUMN_ALIASES or
                   any(alias in v.lower() for alias in
                       ("process", "machine", "specification", "control", "reaction"))
            )
            if matches >= 1:
                header_row_idx = i
                break

    if header_row_idx is None:
        # Fall back: treat first row as header
        header_row_idx = raw.index[0]

    # Get raw column names, sanitize, and deduplicate
    raw_cols = [str(v).strip() if str(v).strip() else f"_col{i}"
                for i, v in enumerate(raw.loc[header_row_idx])]
    cols = _deduplicate_columns(raw_cols)
    
    data = raw.loc[header_row_idx + 1:].copy()
    data.columns = cols
    data = data.reset_index(drop=True)
    
    # Remove rows that are completely empty
    data = data[data.apply(lambda r: any(str(v).strip() for v in r), axis=1)]
    
    # Remove columns that are completely empty or contain only whitespace
    data = data.dropna(axis=1, how='all')
    # Keep only columns that have at least one non-empty value
    data = data.loc[:, data.apply(lambda col: (col.astype(str).str.strip() != "").any())]
    
    # Normalize remaining columns via aliases
    data = normalize_columns(data)
    return data


# ── Structure 1: multi-sheet ──────────────────────────────────────────────────

def get_sheet_names(file_path: str) -> list[str]:
    """Return all sheet names in an Excel workbook."""
    ext = os.path.splitext(file_path)[-1].lower()
    if ext not in (".xlsx", ".xls"):
        return []          # CSV has no sheets
    xl = pd.ExcelFile(file_path)
    return xl.sheet_names


def load_pcp_sheet(file_path: str, sheet_name: str) -> pd.DataFrame:
    """
    Load a single named sheet as a clean, normalised DataFrame.
    Also extracts a 'stage_label' attribute on the returned df.
    """
    raw = _read_raw_sheet(file_path, sheet_name=sheet_name)
    df  = _df_from_raw(raw)
    # Try to infer stage label from sheet name or control-plan cell
    df.attrs["stage_label"] = _infer_stage_label_from_sheet(raw, sheet_name)
    df.attrs["sheet_name"]  = sheet_name
    return df


def _infer_stage_label_from_sheet(raw: pd.DataFrame, sheet_name: str) -> str:
    """
    Look for a Control Plan No. cell in the top 10 rows of the raw sheet.
    If found return it, otherwise return the sheet name.
    """
    for i, row in raw.head(10).iterrows():
        for val in row.values:
            v = str(val).strip()
            if _STAGE_SUFFIX_RE.search(v):
                return v
    return sheet_name


# ── Structure 2: single-sheet multi-stage ────────────────────────────────────

def split_pcp_by_stage(file_path: str, sheet_name=0) -> dict[str, pd.DataFrame]:
    """
    Parse a single-sheet PCP that contains multiple stages separated by
    repeated header blocks.  A new stage starts whenever a cell in the top
    area of a block matches a Control Plan No. pattern ending in /NN.

    Returns:
        OrderedDict  {stage_label: DataFrame}  — one entry per detected stage.
        If only one stage is found the dict has a single key.
    """
    ext = os.path.splitext(file_path)[-1].lower()
    if ext in (".xlsx", ".xls"):
        raw = _read_raw_sheet(file_path, sheet_name=sheet_name)
    else:
        raw = _read_csv_raw(file_path)

    stages      = {}          # {label: [row_indices]}
    current_label  = None
    current_rows   = []
    header_cols    = None     # column names captured from first column-header row

    i = 0
    rows_list = list(raw.itertuples(index=True, name=None))

    while i < len(rows_list):
        idx_tuple = rows_list[i]
        row_idx   = idx_tuple[0]
        row_vals  = [str(v).strip() for v in idx_tuple[1:]]
        non_empty = [v for v in row_vals if v]

        # ── Detect a Control Plan No. that signals a new stage ───────────────
        cp_label = None
        for v in non_empty:
            if _STAGE_SUFFIX_RE.search(v):
                cp_label = v
                break

        if cp_label:
            # Save previous stage
            if current_label and current_rows:
                stages[current_label] = current_rows[:]

            current_label = cp_label
            current_rows  = []
            header_cols   = None   # reset — fresh header expected below
            i += 1
            continue

        # ── Detect column-header row (after a stage marker) ──────────────────
        if current_label is not None and header_cols is None:
            n_matches = sum(
                1 for v in non_empty
                if v.lower() in COLUMN_ALIASES or
                   any(k in v.lower() for k in
                       ("process", "machine", "specification", "control", "reaction", "tool"))
            )
            if n_matches >= 1 and len(non_empty) >= 2:
                header_cols = row_vals   # store as column names
                i += 1
                continue

        # ── Data row ─────────────────────────────────────────────────────────
        if current_label is not None and non_empty:
            current_rows.append(row_vals)

        i += 1

    # Flush last stage
    if current_label and current_rows:
        stages[current_label] = current_rows

    # ── Build DataFrames ──────────────────────────────────────────────────────
    if not stages:
        # No stage markers found — treat whole sheet as a single stage
        df = _df_from_raw(raw)
        label = _infer_stage_label_from_sheet(raw, str(sheet_name))
        df.attrs["stage_label"] = label
        return {label: df}

    result = {}
    for label, rows in stages.items():
        if not rows:
            continue
        # Rebuild using the last seen header_cols; fall back to positional
        max_cols = max(len(r) for r in rows)
        # Try to get a proper header by re-scanning the raw block
        df = pd.DataFrame(rows)
        df = df.fillna("").astype(str)
        df = _df_from_raw(
            pd.concat([raw.iloc[:1], df], ignore_index=True)
        ) if len(raw.columns) == df.shape[1] else _df_from_raw(df)
        df.attrs["stage_label"] = label
        result[label] = df

    return result


# ── Existing public API (unchanged) ──────────────────────────────────────────

def load_pcp(file_path: str) -> pd.DataFrame:
    """
    Original single-DataFrame loader.  Reads the first sheet / CSV.
    Still used by the training-pair uploader (example PCP).
    """
    ext = os.path.splitext(file_path)[-1].lower()
    try:
        if ext == ".csv":
            df = _read_csv_raw(file_path)
            df = _df_from_raw(df)
        elif ext in (".xlsx", ".xls"):
            raw = _read_raw_sheet(file_path, sheet_name=0)
            df  = _df_from_raw(raw)
        else:
            raise ValueError(
                f"Unsupported file type '{ext}'. Use .xlsx, .xls, or .csv."
            )
    except Exception as e:
        raise ValueError(f"Could not read file: {e}")

    df.attrs.setdefault("stage_label", "Stage 01")
    return df


def ensure_unique_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Public helper — call this on any DataFrame right before passing it to
    st.dataframe() to guarantee no duplicate column names reach PyArrow.

    Usage in app.py:
        from parser import ensure_unique_columns
        st.dataframe(ensure_unique_columns(df), use_container_width=True)
    """
    new_cols = _deduplicate_columns([str(c) for c in df.columns])
    df = df.copy()
    df.columns = new_cols
    return df


def dataframe_summary(df: pd.DataFrame) -> str:
    cols = list(df.columns)
    rows = len(df)
    return f"{rows} process steps | columns: {', '.join(str(c) for c in cols)}"


def auto_detect_all_stages(file_path: str) -> dict[str, "pd.DataFrame"]:
    """
    Smart loader that handles ALL PCP structures automatically:

      • CSV → treated as single sheet; auto-splits by stage markers if present
      • XLSX with 1 sheet → auto-splits by stage markers if present, else single stage
      • XLSX with N sheets → each sheet is auto-split; produces
          "SheetName" (single stage) or "SheetName / StageLabel" (multi-stage)

    Returns:
        OrderedDict  { label: DataFrame }  — one entry per WI to generate.
        Labels are human-friendly so the UI can display them directly.
    """
    ext = os.path.splitext(file_path)[-1].lower()
    result: dict[str, pd.DataFrame] = {}

    if ext == ".csv":
        stages = split_pcp_by_stage(file_path)
        for label, df in stages.items():
            result[label] = df
        return result

    if ext not in (".xlsx", ".xls"):
        raise ValueError(f"Unsupported file type '{ext}'. Use .xlsx, .xls, or .csv.")

    sheet_names = get_sheet_names(file_path)

    for sheet in sheet_names:
        try:
            stages = split_pcp_by_stage(file_path, sheet_name=sheet)
        except Exception:
            # Fall back to plain load if stage splitting fails
            try:
                df = load_pcp_sheet(file_path, sheet)
                result[sheet] = df
            except Exception:
                pass
            continue

        if len(stages) <= 1:
            # Single stage in this sheet — use sheet name as label
            for _, df in stages.items():
                result[sheet] = df
        else:
            # Multiple stages — prefix with sheet name for clarity
            for stage_label, df in stages.items():
                combined_label = f"{sheet} / {stage_label}"
                result[combined_label] = df

    return result