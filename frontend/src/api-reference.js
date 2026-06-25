/**
 * ============================================================
 *  PCP → Work Instruction Generator — API Reference & Mock Data
 *  File: frontend/src/api-reference.js
 * ============================================================
 *
 *  PURPOSE FOR UI DEVELOPER:
 *  ─────────────────────────
 *  This file documents every backend API endpoint:
 *    • Base URL
 *    • Method (GET / POST)
 *    • What you send (request body / params)
 *    • Exact shape of the JSON response
 *    • Live example / seed data so you can build UI without the backend
 *
 *  HOW TO USE (two modes):
 *  ────────────────────────
 *  MODE 1 — Mock mode (no backend needed):
 *    Set USE_MOCK = true below.
 *    All api.* functions return the seed data instantly.
 *    Perfect for building and styling the UI.
 *
 *  MODE 2 — Real mode (backend running on localhost:8000):
 *    Set USE_MOCK = false below.
 *    All api.* functions call the real FastAPI server.
 *    Run backend: uvicorn backend.main:app --reload --port 8000
 *    (from inside pcp_wi_generator/ with venv activated)
 *
 *  BACKEND BASE URL:
 *    http://localhost:8000
 *    (Vite dev server proxies /api → http://localhost:8000 automatically)
 * ============================================================
 */

// ─── Toggle this to switch between mock and real API ─────────────────────────
export const USE_MOCK = true;

// ─── Base URL (only used when USE_MOCK = false) ───────────────────────────────
const BASE_URL = '/api';   // proxied by vite to http://localhost:8000

// =============================================================================
// SEED DATA — exact shape of every API response
// Use these to build your components without a running backend.
// =============================================================================

/**
 * SEED: GET /api/health
 * ─────────────────────
 * Simple health check. Returns { status: "ok" } when backend is live.
 */
export const SEED_HEALTH = {
  status: 'ok',
};

// -----------------------------------------------------------------------------

/**
 * SEED: GET /api/training-status
 * ────────────────────────────────
 * Tells the UI whether training data files are loaded and ready.
 *
 * Fields:
 *   ready      boolean — true if BOTH pcp and wi training files are present
 *   pcp_loaded boolean — training_pcp.xlsx found and readable
 *   wi_loaded  boolean — training_wi.xlsx / .docx / .csv found
 *   errors     string[] — list of human-readable error messages (empty if ready)
 */
export const SEED_TRAINING_STATUS = {
  ready: true,
  pcp_loaded: true,
  wi_loaded: true,
  errors: [],

  // Example when NOT ready:
  // ready: false,
  // pcp_loaded: false,
  // wi_loaded: true,
  // errors: ["training_pcp.xlsx not found — add it to the training_data/ folder."]
};

// -----------------------------------------------------------------------------

/**
 * SEED: GET /api/providers
 * ─────────────────────────
 * Returns all supported LLM providers and their models.
 *
 * Fields per provider:
 *   models   string[] — list of display model names (use as dropdown options)
 *   env_key  string   — environment variable name that holds the API key
 *   key_set  boolean  — true if the API key is configured on the server
 */
export const SEED_PROVIDERS = {
  mistral: {
    models: ['mistral-large-latest', 'mistral-small-latest'],
    env_key: 'MISTRAL_API_KEY',
    key_set: false,
  },
  groq: {
    models: ['llama-3.1-70b', 'llama-3.1-8b', 'qwen-2.5-72b'],
    env_key: 'GROQ_API_KEY',
    key_set: true,   // ← means this key is configured and active
  },
  openai: {
    models: ['gpt-4o', 'gpt-4o-mini'],
    env_key: 'OPENAI_API_KEY',
    key_set: false,
  },
  together: {
    models: ['qwen-2.5-72b', 'llama-3.1-70b', 'deepseek-r1'],
    env_key: 'TOGETHER_API_KEY',
    key_set: false,
  },
};

// -----------------------------------------------------------------------------

/**
 * SEED: POST /api/upload-pcp
 * ────────────────────────────
 * Upload a PCP Excel (.xlsx / .xls) or CSV file.
 * The backend scans all sheets, detects PCP blocks, and returns a session.
 *
 * REQUEST:
 *   Content-Type: multipart/form-data
 *   Body field:   file  (the File object from <input type="file">)
 *
 * RESPONSE FIELDS:
 *   session_id      string   — UUID to use in all subsequent calls for this file
 *   base_name       string   — filename without extension (used in output filenames)
 *   total_pcp       number   — how many PCP sheets were found
 *   total_non_pcp   number   — how many non-PCP sheets were found (hidden)
 *
 *   pcp_sheets      object[] — list of detected PCP blocks (show these as checkboxes)
 *     .key          string   — unique key for this sheet/block (use as React key & in API calls)
 *     .meta         object   — metadata about this PCP
 *       .stage_label string  — human label e.g. "Stage 01" or "Stage 1 of 3"
 *       .plan_number string  — PCP plan number extracted from header row
 *       .part_name   string  — part name (may be empty)
 *       .part_no     string  — part number (may be empty)
 *       .sheet_name  string  — original Excel sheet name
 *       .start_row   number  — first row of this PCP block (1-based)
 *       .end_row     number|null — last row (null = entire sheet)
 *     .columns      string[] — column names in this sheet's data
 *
 *   non_pcp_sheets  object[] — sheets not detected as PCP (can be added manually)
 *     .sheet_name   string   — original sheet name
 *     .info         object|null
 *       .columns    string[]
 *       .rows       number
 */
export const SEED_UPLOAD_RESPONSE = {
  session_id: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
  base_name: 'Sample_PCP_File',
  total_pcp: 3,
  total_non_pcp: 1,

  pcp_sheets: [
    {
      key: 'PCP Sheet 1',
      meta: {
        stage_label: 'Stage 01',
        plan_number: 'SI / PCP / 264747700101/01',
        part_name: 'Cover Assy Fuel Filter',
        part_no: '264747700101',
        sheet_name: 'PCP Sheet 1',
        start_row: 1,
        end_row: 45,
      },
      columns: ['Process Name', 'Machine', 'Tool', 'Specification', 'Control Method', 'Reaction Plan'],
    },
    {
      key: 'PCP Sheet 1 | Stage 02',
      meta: {
        stage_label: 'Stage 02',
        plan_number: 'SI / PCP / 264747700101/02',
        part_name: 'Cover Assy Fuel Filter',
        part_no: '264747700101',
        sheet_name: 'PCP Sheet 1',
        start_row: 46,
        end_row: 90,
      },
      columns: ['Process Name', 'Machine', 'Tool', 'Specification', 'Control Method', 'Reaction Plan'],
    },
    {
      key: 'Stage 3',
      meta: {
        stage_label: 'Stage 03',
        plan_number: 'SI / PCP / 264747700101/03',
        part_name: '',
        part_no: '',
        sheet_name: 'Stage 3',
        start_row: 1,
        end_row: null,
      },
      columns: ['Process Name', 'Machine', 'Specification', 'Frequency', 'Sample Size'],
    },
  ],

  non_pcp_sheets: [
    {
      sheet_name: 'Cover',
      info: {
        columns: ['Sr No', 'Description', 'Value'],
        rows: 12,
      },
    },
  ],
};

// -----------------------------------------------------------------------------

/**
 * SEED: GET /api/sheet-preview/{session_id}/{sheet_key}
 * ───────────────────────────────────────────────────────
 * Returns raw HTML (not JSON!) that renders the Excel sheet as a table.
 * Inject into a <div> using dangerouslySetInnerHTML={{ __html: html }}.
 *
 * URL PARAMS:
 *   session_id  string — from upload response
 *   sheet_key   string — .key from pcp_sheets array  (URL-encode it!)
 *
 * RESPONSE:
 *   Content-Type: text/html
 *   Body: HTML string — a <div> wrapping a <table> with merged cells & styling
 *
 * USAGE:
 *   const res = await fetch(`/api/sheet-preview/${sessionId}/${encodeURIComponent(sheetKey)}`);
 *   const html = await res.text();   // NOT res.json()
 *   // then: <div dangerouslySetInnerHTML={{ __html: html }} />
 */
export const SEED_SHEET_PREVIEW_HTML = `
<div style="overflow:auto;max-height:500px;border:1px solid #ccc;padding:4px;background:#fff;">
  <table style="border-collapse:collapse;font-size:12px;font-family:Calibri,Arial,sans-serif;">
    <tr>
      <td colspan="6" style="border:1px solid #d0d0d0;padding:3px 5px;font-weight:bold;background:#FFF3E8;">
        PROCESS CONTROL PLAN
      </td>
    </tr>
    <tr>
      <td style="border:1px solid #d0d0d0;padding:3px 5px;font-weight:bold;">Process Control Plan Number</td>
      <td colspan="5" style="border:1px solid #d0d0d0;padding:3px 5px;">SI / PCP / 264747700101/01</td>
    </tr>
    <tr>
      <td style="border:1px solid #d0d0d0;padding:3px 5px;font-weight:bold;">Process Name</td>
      <td style="border:1px solid #d0d0d0;padding:3px 5px;font-weight:bold;">Machine</td>
      <td style="border:1px solid #d0d0d0;padding:3px 5px;font-weight:bold;">Tool</td>
      <td style="border:1px solid #d0d0d0;padding:3px 5px;font-weight:bold;">Specification</td>
      <td style="border:1px solid #d0d0d0;padding:3px 5px;font-weight:bold;">Control Method</td>
      <td style="border:1px solid #d0d0d0;padding:3px 5px;font-weight:bold;">Reaction Plan</td>
    </tr>
    <tr>
      <td style="border:1px solid #d0d0d0;padding:3px 5px;">Cover Assy - Spot Welding</td>
      <td style="border:1px solid #d0d0d0;padding:3px 5px;">Spot Welding Machine</td>
      <td style="border:1px solid #d0d0d0;padding:3px 5px;">Welding Gun #90</td>
      <td style="border:1px solid #d0d0d0;padding:3px 5px;">12 spots ± 0</td>
      <td style="border:1px solid #d0d0d0;padding:3px 5px;">Visual + Count</td>
      <td style="border:1px solid #d0d0d0;padding:3px 5px;">Rework / Scrap</td>
    </tr>
  </table>
</div>
`;

// -----------------------------------------------------------------------------

/**
 * SEED: POST /api/generate
 * ──────────────────────────
 * The main endpoint — sends selected PCP sheets to the LLM and gets WI JSON back.
 * This is a SLOW call (5–60 seconds depending on LLM). Show a progress spinner.
 *
 * REQUEST BODY (JSON):
 * {
 *   session_id:      string,    // from upload response — REQUIRED
 *   selected_sheets: string[],  // array of sheet .key values to generate WIs for — REQUIRED
 *   language:        string,    // "english" | "hindi" | "marathi" — default "english"
 *   model:           string,    // optional — auto-detected from .env if not given
 *   temperature:     number,    // optional — default 0.2 (0.0–1.0, lower = more consistent)
 *   max_tokens:      number,    // optional — default 4000
 * }
 *
 * RESPONSE FIELDS:
 *   completed  number   — how many WIs were successfully generated
 *   errors     string[] — any per-stage errors (non-fatal; completed WIs still returned)
 *
 *   results    object   — keyed by stage_label
 *     [stage_label]:
 *       wi_data      object   — the full WI JSON (see WI_DATA structure below)
 *       csv_b64      string   — base64-encoded CSV file bytes
 *       xlsx_b64     string|null — base64-encoded Excel file bytes (null if Excel generation failed)
 *       xlsx_error   string|null — error message if xlsx_b64 is null
 *       file_prefix  string   — suggested filename prefix e.g. "WI_20240622_SampleFile_Stage_01"
 *
 * HOW TO DOWNLOAD FILES:
 *   const blob = new Blob([Uint8Array.from(atob(result.csv_b64), c => c.charCodeAt(0))], { type: 'text/csv' });
 *   const url  = URL.createObjectURL(blob);
 *   // Then <a href={url} download="filename.csv">Download</a>
 */
export const SEED_GENERATE_RESPONSE = {
  completed: 2,
  errors: [],   // e.g. ["LLM error on Stage 03: API key not set"]

  results: {
    'Stage 01': {
      file_prefix: 'WI_20240622_Sample_PCP_File_Stage_01',
      csv_b64:  '<base64 string of CSV file bytes>',
      xlsx_b64: '<base64 string of XLSX file bytes>',
      xlsx_error: null,

      // ── wi_data: the full Work Instruction JSON ──────────────────────
      wi_data: {

        /**
         * document — header metadata for the WI
         * Shown in the top info grid of the work instruction sheet.
         */
        document: {
          wi_number:         'WI-PRD-9',       // Document / WI number
          revision_no:       '01',             // Revision number
          revision_date:     '11/11/17',       // Revision date string
          factory_line_area: 'UNIT-3 / COVER ASSY FUEL FILTER', // Factory line / area
          stage_no:          '1',              // Stage number (string)
          stage_name:        'COVER ASSY FUEL FILTER', // Stage name
          machine_equipment: 'Spot Welding Guns',      // Machine / equipment
          part_no:           '264747700101',   // Part number
          drawing_no:        '264747700101',   // Drawing number
          drawing_mod:       'D/27.01.2025',   // Drawing modification
          cycle_time:        '45 sec',         // Cycle time
          part_name:         'COVER ASSY FUEL FILTER', // Part name
        },

        /**
         * detailed_work_instructions — flat array of step strings
         * Render as a numbered list.
         * Each string is one operator action.
         */
        detailed_work_instructions: [
          'Collect all loose parts and place them together.',
          'Verify all assembly parts are loaded on fixture (Fixture No. 264747700101).',
          'Clamp the fixture.',
          'Perform 12 spots as per control plan.',
          'Unclamp the fixture.',
          'Inspect the completed assembly.',
          'Verify total 12 spots are complete on both sub-assemblies and pass to Stage 2.',
        ],

        /**
         * vehicle_models — array of strings
         * List of vehicle models this WI applies to.
         */
        vehicle_models: ['SFC 712 4SP RDE'],

        /**
         * tooling_equipments — array of strings
         * Render as a numbered list in "Tooling / Equipment" section.
         */
        tooling_equipments: [
          'Stage 1 Welding Fixture (Fixture No. 264747700101)',
          'Spot Welding Gun - 1 no. (Gun No. 90)',
        ],

        /**
         * quality_parameters — object with two sub-arrays
         * incoming: checks done BEFORE processing (render with prefix A1, A2 …)
         * finished: checks done AFTER processing (render with prefix B1, B2 …)
         */
        quality_parameters: {
          incoming: [
            'Assembly must have no cracks, damage, or rust anywhere.',
            'No wrinkles on pressed parts.',
          ],
          finished: [
            'Total 12 spots as per control plan and spot plan.',
            'No deep spots allowed.',
            'No burrs at spot locations.',
            'Weld nuts and studs must not be missing.',
            'No loose parts missing.',
          ],
        },

        /**
         * rework_instructions — array of objects
         * Each object has:
         *   defect  string — name of the defect (show in a colored badge)
         *   rework  string — corrective action to take
         * Render as a two-column table: Defect | Corrective Action
         */
        rework_instructions: [
          { defect: 'Spot Missing',    rework: 'Missing spots must be done properly (ref: control plan and drawing).' },
          { defect: 'Welding Missing', rework: 'Welding must be done properly (ref: control plan and drawing).' },
          { defect: 'Part Missing',    rework: 'All parts must be welded properly (ref: control plan and drawing).' },
          { defect: 'Nut Missing',     rework: 'All nuts must be welded properly (ref: control plan and drawing).' },
          { defect: 'Dent or Damage',  rework: 'Use plastic mallet to rework dents or damage.' },
          { defect: 'Rust',            rework: 'Clean rusted area with rust remover and apply anti-rust coating.' },
          { defect: 'Part Shift',      rework: 'Remove misplaced part using spot cutter and chisel, reposition correctly.' },
        ],

        /**
         * logistics — array of strings
         * Items needed for material handling. Show as bullet list.
         */
        logistics: ['Bin', 'Trolley', 'Crane'],

        /**
         * part_details — array of objects
         * Render as a table: Sr. | Part No. | Part Description | Qty
         * May be empty [].
         */
        part_details: [
          { sr_no: 1, part_no: '264747708201', part_description: 'COVER',       qty: 1 },
          { sr_no: 2, part_no: '264747708202', part_description: 'COVER PLATE', qty: 1 },
        ],

        /**
         * process_note — string (optional, may be absent)
         * A single process-level note. Show as an info callout if present.
         */
        process_note: 'Ensure PPE (gloves, safety glasses) is worn at all times during welding.',
      },
    },

    'Stage 02': {
      file_prefix: 'WI_20240622_Sample_PCP_File_Stage_02',
      csv_b64:  '<base64 string>',
      xlsx_b64: '<base64 string>',
      xlsx_error: null,
      wi_data: {
        document: {
          wi_number: 'WI-PRD-10', revision_no: '01', revision_date: '11/11/17',
          factory_line_area: 'UNIT-3 / COVER ASSY', stage_no: '2',
          stage_name: 'STUD WELDING', machine_equipment: 'Stud Welding Machine',
          part_no: '264747700101', drawing_no: '264747700101', drawing_mod: '',
          cycle_time: '30 sec', part_name: 'COVER ASSY FUEL FILTER',
        },
        detailed_work_instructions: [
          'Take sub-assembly from Stage 1.',
          'Load on stud welding fixture.',
          'Weld 4 studs as per drawing.',
          'Check all studs for proper projection and alignment.',
          'Pass to Stage 3.',
        ],
        vehicle_models: ['SFC 712 4SP RDE'],
        tooling_equipments: ['Stud Welding Fixture', 'Stud Welding Machine'],
        quality_parameters: {
          incoming: ['Check Stage 1 output — all 12 spots complete.'],
          finished: ['All 4 studs welded.', 'Stud projection 8 ± 0.5 mm.', 'No cracks at weld base.'],
        },
        rework_instructions: [
          { defect: 'Stud Missing',    rework: 'Weld missing stud as per drawing.' },
          { defect: 'Stud Projection', rework: 'Adjust machine settings and re-weld.' },
        ],
        logistics: ['Bin', 'Trolley'],
        part_details: [],
        process_note: '',
      },
    },
  },
};

// -----------------------------------------------------------------------------

/**
 * SEED: POST /api/add-non-pcp-as-wi/{session_id}/{sheet_name}
 * ─────────────────────────────────────────────────────────────
 * Moves a non-PCP sheet into the PCP list so it can be included in generation.
 * Use this when the user clicks "➕ Add as WI" in the hidden sheets expander.
 *
 * URL PARAMS:
 *   session_id   string — from upload response
 *   sheet_name   string — from non_pcp_sheets[].sheet_name  (URL-encode it!)
 *
 * REQUEST:
 *   Method: POST
 *   No body needed.
 *
 * RESPONSE:
 *   status       string — "ok" on success
 *   added_sheet  string — the sheet_name that was added
 *   meta         object — same shape as pcp_sheets[].meta
 */
export const SEED_ADD_NON_PCP_RESPONSE = {
  status: 'ok',
  added_sheet: 'Cover',
  meta: {
    stage_label: 'Cover',
    plan_number: '',
    part_name: '',
    part_no: '',
    sheet_name: 'Cover',
    start_row: 1,
    end_row: null,
  },
};

// =============================================================================
// API FUNCTIONS — call real backend OR return seed data based on USE_MOCK flag
// =============================================================================

/** GET /api/health */
export async function apiHealth() {
  if (USE_MOCK) return SEED_HEALTH;
  const res = await fetch(`${BASE_URL}/health`);
  return res.json();
}

/** GET /api/training-status */
export async function apiTrainingStatus() {
  if (USE_MOCK) return SEED_TRAINING_STATUS;
  const res = await fetch(`${BASE_URL}/training-status`);
  return res.json();
}

/** GET /api/providers */
export async function apiProviders() {
  if (USE_MOCK) return SEED_PROVIDERS;
  const res = await fetch(`${BASE_URL}/providers`);
  return res.json();
}

/**
 * POST /api/upload-pcp
 * @param {File} file - The PCP Excel/CSV file
 * @returns {Promise<typeof SEED_UPLOAD_RESPONSE>}
 */
export async function apiUploadPcp(file) {
  if (USE_MOCK) {
    // Simulate a small delay like a real network call
    await new Promise((r) => setTimeout(r, 800));
    return { ...SEED_UPLOAD_RESPONSE, base_name: file.name.replace(/\.[^.]+$/, '') };
  }
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE_URL}/upload-pcp`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

/**
 * GET /api/sheet-preview/{session_id}/{sheet_key}
 * @returns {Promise<string>} Raw HTML string — use dangerouslySetInnerHTML
 */
export async function apiSheetPreview(sessionId, sheetKey) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    return SEED_SHEET_PREVIEW_HTML;
  }
  const res = await fetch(`${BASE_URL}/sheet-preview/${sessionId}/${encodeURIComponent(sheetKey)}`);
  return res.text();   // ← text(), NOT json()
}

/**
 * POST /api/generate
 * @param {object} payload
 * @param {string}   payload.session_id
 * @param {string[]} payload.selected_sheets
 * @param {string}   payload.language        - "english"|"hindi"|"marathi"
 * @param {string}   [payload.model]         - optional LLM model key
 * @param {number}   [payload.temperature]   - optional 0.0–1.0
 * @param {number}   [payload.max_tokens]    - optional
 * @returns {Promise<typeof SEED_GENERATE_RESPONSE>}
 */
export async function apiGenerate(payload) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 2000)); // simulate LLM latency
    return SEED_GENERATE_RESPONSE;
  }
  const res = await fetch(`${BASE_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Generation failed');
  }
  return res.json();
}

/**
 * POST /api/add-non-pcp-as-wi/{session_id}/{sheet_name}
 * @param {string} sessionId
 * @param {string} sheetName
 * @returns {Promise<typeof SEED_ADD_NON_PCP_RESPONSE>}
 */
export async function apiAddNonPcpAsWi(sessionId, sheetName) {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 300));
    return { ...SEED_ADD_NON_PCP_RESPONSE, added_sheet: sheetName };
  }
  const res = await fetch(
    `${BASE_URL}/add-non-pcp-as-wi/${sessionId}/${encodeURIComponent(sheetName)}`,
    { method: 'POST' }
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to add sheet');
  }
  return res.json();
}

// =============================================================================
// HELPER — convert base64 download to a browser Blob download
// =============================================================================

/**
 * Trigger a file download from a base64 string.
 *
 * @param {string} b64      - base64-encoded file content
 * @param {string} mime     - MIME type e.g. "text/csv"
 * @param {string} filename - suggested filename e.g. "WI_Stage01.csv"
 *
 * @example
 * downloadB64(result.csv_b64,  'text/csv',  `${result.file_prefix}.csv`);
 * downloadB64(result.xlsx_b64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `${result.file_prefix}.xlsx`);
 */
export function downloadB64(b64, mime, filename) {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
