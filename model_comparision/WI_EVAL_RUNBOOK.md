# WI Model Evaluation Runbook

How to compare each model's generated Work Instructions (WIs) for one part number against the golden WI, write one judge-result JSON per model per stage, and produce a summary PDF.

**Start a new chat with:**

> Follow `model_comparision/WI_EVAL_RUNBOOK.md` for part `<part folder>`.

The folder name is enough, for example ` 290058600101 ` or `511830100101`. Many folder names have leading or trailing spaces or a leading `_`, so copy the name exactly from `ls model_comparision` and always quote paths.

Worked example: ` 289661208202 ` has already been through every step. When in doubt about granularity, wording or format, open its files:
- `eval_work/golden_facts_Stage_01.json`
- `eval_work/verdicts/*.json`
- `eval_work/report_notes.json`
- `Generated/*/judge_result_*_Stage_01.json`
- `MODEL_COMPARISON_289661208202.pdf`

---

## 0. What you produce

For part folder `P`:

| Output | Path | Written by |
|---|---|---|
| Text dumps, manifest | `P/eval_work/text/*.txt`, `P/eval_work/manifest.json` | `prepare.py` |
| Golden facts, one file per stage | `P/eval_work/golden_facts_Stage_NN.json` | **you** |
| Verdicts, one file per model per stage | `P/eval_work/verdicts/<Model>_Stage_NN.json` | **you** |
| **Judge result JSON**, one per model per stage | `P/Generated/<Model>/judge_result_<Model>_Stage_NN.json` | `score.py` |
| Report narrative | `P/eval_work/report_notes.json` | **you** |
| **Summary PDF** | `P/MODEL_COMPARISON_<partno>.pdf` | `build_report.py` |

You do the judging. The scripts do extraction, validation, arithmetic and layout. Never hand-compute scores or hand-edit `judge_result_*.json`: change the verdicts file and run `score.py` again.

## 1. Directory layout (inputs)

```
model_comparision/
  WI_EVAL_RUNBOOK.md              <- this file
  eval_tools/prepare.py | score.py | build_report.py
  <part folder>/
    <PPAP source>.xlsx or .xls     <- what the generator read; used to check extra content
    Hindi/WI_..._Stage_01.xlsx     <- golden WI, one file per stage (_Stage_NN in the name)
    Generated/
      <Model>/WI_..._Stage_NN.xlsx <- generated WI per stage (a "(1)" suffix in the name is normal)
      <Model>/COST_*.docx          <- generator's cost report (model id, cost, tokens)
      <Model>/eval_report_*.docx   <- older automatic evaluation; NOT used here
```

The judge prompt is `../wi_judge_single_prompt.md`, at the repo root. **Read it in full before Step 2.** This runbook adds conventions on top of it and never replaces it.

The model folders currently are `Gpt4o-mini`, `Luna-5.6`, `Luna-6`, `mistral-small-latest` and `Nano-5`. Use whatever `prepare.py` finds.

Tools needed: `python3` with `openpyxl` (and optionally Pillow), `google-chrome` or `chromium`, `pdftoppm`, and `libreoffice`, which is only needed for `.xls` files.

## 2. Steps

Run every command from `model_comparision/`. `P` below means the quoted part folder, e.g. `" 290058600101 "`.

### Step 1: Prepare

```bash
python3 eval_tools/prepare.py "P"
```

Read the printed summary and any `WARNING:` lines: missing stages, duplicate WI files, an unreadable PPAP. Tell the user about real problems before going on. An openpyxl "DrawingML" warning is harmless. Converting a `.xls` PPAP can take about 30 seconds.

### Step 2: Golden facts (once per stage, shared by all models)

1. Read `P/eval_work/text/golden_Stage_NN.txt`.
2. Write `P/eval_work/golden_facts_Stage_NN.json`, following judge prompt Step 1 and the conventions in §3.1.
3. Check coverage:
   ```bash
   python3 eval_tools/score.py check-facts "P" --stage NN
   ```
   It validates the schema and lists every number in the golden that no fact quotes. Add facts for real values until the list is empty or holds only non-facts (for example a sheet title number). Write the reason for any number you leave out into your notes.

Write the facts **before** you open any generated WI, so the fact list isn't biased towards one model.

### Step 3: Verdicts (each model × each stage)

For each model and stage:
1. Read `P/eval_work/text/<Model>_Stage_NN.txt` in full.
2. Give every golden fact exactly one verdict (judge prompt Step 2 and §3.2).
3. List the extra content (judge prompt Step 3 and §3.3). Set `in_ppap` for each item by searching `P/eval_work/text/ppap.txt` (§3.3).
4. Fill in sequence issues (Step 4), language (Step 5) and a 2–3 sentence `summary` of what an operator would get wrong.
5. Write `P/eval_work/verdicts/<Model>_Stage_NN.json` (schema in §4.2).

Judge each model against the golden facts only. Don't compare models with each other while judging, and apply §3 identically to all of them. A multi-stage part means many judgements; 4 stages × 5 models is 20. Work stage by stage. If you hand a stage to a subagent, give it this runbook, the judge prompt, that stage's facts file and the text dumps. Then spot-check its verdicts against §3 before scoring.

### Step 4: Score

```bash
python3 eval_tools/score.py score "P"                # all models, all stages
python3 eval_tools/score.py score "P" --model Luna-6 --stage 02   # just one
```

This validates every verdicts file: one verdict per fact, valid enums, MISSING always with `evidence: null`. It then computes section scores, overall score, critical recall and pass/fail exactly as judge prompt Step 6 defines, and writes the judge-result JSON (the prompt's output schema plus a `meta` block and `critical_hallucinations_in_ppap`). Fix any validation error in the verdicts file and run it again.

### Step 5: Report

1. Write `P/eval_work/report_notes.json` (schema in §4.3, guidance in §5).
2. Build the PDF:
   ```bash
   python3 eval_tools/build_report.py "P"
   ```
3. **Look at** `P/eval_work/preview/contact.png`, or the individual `page-N.png` files, with the Read tool. Check for overlapping labels, orphaned headings and tables split badly. Fix the notes, or the CSS in `build_report.py` if needed, and rebuild.

### Step 6: Hand over

Tell the user:
- the PDF path
- a short ranking table: model, overall, critical recall, pass/fail
- the 3–5 findings that matter most
- any judgement calls or data problems they should know about

Link the files with paths relative to the repo root, and URL-encode the spaces as `%20`.

## 3. Conventions

These are the decisions made on 289661208202. Apply them identically so that results are comparable across parts.

### 3.1 Golden fact extraction

- **IDs.** Use `H1…` for the header, `S<step>` or `S<step>a/b/c` for steps, `T<n>` or `T<n>a/b/c` for tooling, `QI<n>`, `QF<n>` or `QF<n>a…`, `R<n>` and `L<n>`.
- **S facts** carry `order` (the golden step number, an integer). Every other fact has `order: null`.
- **`area`** (used for the PDF's coverage table): give every fact a process-area label.
  - Use `Header & part list`, `Incoming material`, one label per operation (e.g. `Shearing`, `Draw (800 T)`, `Trim & piercing (500 T)`, `Restrike (800 T)`, `Spot welding`), then `Panel check, storage, packing`, `Rework` and `Legend`.
  - Put T and QF facts in the area of the operation they belong to.
  - Use the same labels for every model; they are defined once, in the facts file.
- **Header.** Make one fact each for:
  - company name (MINOR) and address (MINOR)
  - Doc No., document revision and document date (CRITICAL)
  - factory/line area (MINOR) and stage name (MINOR)
  - Stage No. (CRITICAL)
  - each machine in the machine list: CRITICAL if it has a tonnage, otherwise MAJOR
  - Part No. (CRITICAL)
  - cycle time (CRITICAL; expected value **BLANK** if blank)
  - part name (MINOR)
  - drawing no., drawing revision and revision date (CRITICAL)
  - modification (MINOR; BLANK if "—")
  - each part-list row: part no. (CRITICAL), description (MINOR), qty (CRITICAL)
- **Steps.**
  - Make one CRITICAL fact per numeric value. Put the operation, machine and instrument in the fact text, e.g. "Draw press shut height is 1285 mm, set with measuring tape".
  - "Operation X runs on machine Y (tonnage)" is its own CRITICAL fact.
  - A step without numbers is one MAJOR fact. Split it if it contains two distinct actions, e.g. S1a "bring raw material together" and S1b "check surface: rust, scale, crack…".
  - A dimension list such as "129, 120, 93, CD 35…" becomes one fact per dimension.
- **Tooling.** Each line becomes: the press↔tool binding (CRITICAL when it has a tonnage), the tool item (MAJOR), and the tool size (CRITICAL).
- **QI/QF.** Each numeric value is CRITICAL; each non-numeric criterion is MAJOR. A value repeated from the steps still gets its own fact (judge prompt rule 5).
- **Rework.** One MAJOR fact per row, defect → action.
- **Legend.** One MINOR fact per item.
- `golden_quote` is the verbatim golden text (Hindi is fine). `fact` is an English paraphrase.

### 3.2 Verdicts

| Situation | Verdict |
|---|---|
| Same value and unit, same operation or machine. Paraphrase, translation, renumbering, merged steps, `22.02.20` vs `22.02.2020`, `2` vs `2.00` | MATCH |
| Value appears only in another section but is bound to the same thing (e.g. incoming thickness 1.5 mm stated only in QI satisfies the incoming-thickness step) | MATCH (note where it was found) |
| Check named without its value ("Measure stroke length"), unit dropped ("350"), document reference truncated ("SI/RMQP/1"), some listed defects or conditions dropped, part of an instruction dropped (pack but no dispatch) | PARTIAL |
| Right value and operation but **wrong instrument** (e.g. "hardness gauge" for a height-gauge check) | PARTIAL, *and* list the instrument as a CRITICAL_HALLUCINATION |
| Machine listed but the operation is never named, so the binding can't be confirmed | PARTIAL for the machine→operation fact |
| One generic block of settings without operation names | Credit it once, to the operation it most plausibly maps to (usually the first). The other operations' settings are MISSING |
| Generic "all dimensions as per spec" in finished QC | PARTIAL for every QF dimension fact |
| A step's dimensions where that operation doesn't exist in the generated WI | MISSING (not PARTIAL) |
| Different value, a suffix added (`289661208202/01` as Drawing No.), operation codes as Stage No. (`PP-030`), wrong unit (UNIT-3 vs UNIT-II), wrong date or revision | CONTRADICTED |
| Rework: same defect, **different action** (reject or re-pierce instead of repair; "rework the sheet" instead of replace) | CONTRADICTED |
| Rework: action matches but the defect list is narrowed (only "rust" of rust/scale/crack), or the action is vague ("necessary correction") | PARTIAL |
| Rework: defect generalised so it still covers the golden defect, and the action matches | MATCH |
| Golden field BLANK and generated also blank | MATCH (evidence null) |
| Golden field BLANK and generated filled in | CONTRADICTED |
| Empty part-list table | MISSING for each part-list fact |
| Not present anywhere | MISSING, with evidence null |

Further rules:
- Evidence is a short verbatim quote from the **generated** WI, at most about 20 words. Put a word or two of context in `note`.
- Language does not change fact verdicts: English text with the right value is still a MATCH. Language is judged separately.
- The same generated sentence can support more than one golden fact (for example a step fact and a QF fact).
- Don't use engineering judgement to excuse or penalise. Any "correction" of the golden is CONTRADICTED.

### 3.3 Extra content

- **CRITICAL_HALLUCINATION:**
  - any new number, tolerance (e.g. "±0.05 mm"), min/max limit, frequency ("hourly", "one per lot"), least count, or material spec
  - a document or form reference
  - a machine, instrument, fixture or gun
  - a new process step, new rework row, or new part-list entry
  - a different process altogether (e.g. welding steps in a press stage)
- **MINOR_HALLUCINATION:** extra non-numeric acceptance criteria, sign-offs, ID suffixes, descriptive text.
- **BENIGN_ADDITION:** generic handling (locate on pins/dowels, feed the sheet), preventive maintenance, instruments that the golden steps already name.
- Make one entry per distinct addition. Group repeats of the same addition (e.g. "hourly" in three steps) into one entry and say where else it appears in `note`.
- Don't list content that is already scored as a CONTRADICTED or PARTIAL fact. The same goes for paraphrases of golden facts.
- **`in_ppap`**: search `eval_work/text/ppap.txt` for the distinctive token (e.g. `grep -c "F-PRD-17"`, `795`, `D 513`). Set `true` if present, `false` if not, `null` if you couldn't check. This is for the report only and **never changes the type**: the judge prompt scores against the golden alone.

### 3.4 Language, sequence, gates

- **Language:** COMPLIANT means Hindi Devanagari body text, English headers, and technical terms in English or transliterated. Arabic numerals and "mm" are fine. MIXED means noticeable switching in the body text. NON_COMPLIANT means the body text is English.
- **Sequence:** list only golden operations that are present but out of order. Missing operations are not sequence issues.
- **Gates and arithmetic:** `score.py` handles them. Don't restate them by hand.

## 4. File schemas

### 4.1 `eval_work/golden_facts_Stage_NN.json`

```json
[
  {"id": "S8b", "section": "S", "order": 8, "criticality": "CRITICAL",
   "fact": "Draw press shut height is 1285 mm, set with measuring tape",
   "golden_quote": "शट हाइट १२८५ मिमी", "area": "Draw (800 T)"},
  {"id": "H13", "section": "H", "order": null, "criticality": "CRITICAL",
   "fact": "Cycle time is BLANK", "golden_quote": "(blank)", "area": "Header & part list"}
]
```

`section` is one of `H S T QI QF R L`, and `criticality` is one of `CRITICAL MAJOR MINOR`.

### 4.2 `eval_work/verdicts/<Model>_Stage_NN.json`

```json
{
  "model": "Luna-6", "stage": "01",
  "verdicts": {
    "S8b": {"verdict": "MATCH", "evidence": "शट हाइट 1285 mm", "note": "Measuring tape not mentioned."},
    "S9b": {"verdict": "MISSING", "evidence": null, "note": ""}
  },
  "extra_content": [
    {"type": "CRITICAL_HALLUCINATION", "evidence": "न्यूनतम शट हाइट 795 mm",
     "note": "New min shut height.", "in_ppap": true}
  ],
  "sequence_issues": [{"operation": "Piercing", "golden_order": 12, "issue": "done before draw"}],
  "language": {"verdict": "COMPLIANT", "note": ""},
  "summary": "2-3 sentences: the most serious problems an operator would hit."
}
```

`<Model>` must match the folder name exactly, e.g. `mistral-small-latest` or `Gpt4o-mini`.

### 4.3 `eval_work/report_notes.json`

All values may contain simple HTML: `<b>`, `<i>`, `<code>`, `<table>`.

```json
{
  "part_name": "CROSSMEMBER LH 2DR XENON CAB",
  "summary_bullets": ["<b>No model passes the judge.</b> ...", "..."],
  "models": {
    "Luna-6": {"right": "One or two sentences on what it got right.",
               "wrong": ["Most serious problem first ...", "..."]}
  },
  "root_causes": [{"title": "The prompt's filled-in example leaks into the output", "html": "<p>...</p>"}],
  "recommendations": ["<b>Replace the filled-in example</b> in <code>prompt_builder.py</code> ...", "..."],
  "judgement_calls": ["optional; the defaults in build_report.py are used if omitted"],
  "limits": "optional; one sentence"
}
```

## 5. Writing the report notes

- Every number in the notes must come from the judge results, the text dumps or the COST reports. Quote values exactly. The PDF's tables are generated, so don't repeat them in prose.
- `summary_bullets` holds 4–6 bullets in this order: whether any model passed; the leader and runner-up with overall score and recall; cost versus quality; the biggest cause of failures; any caveat about the judge.
- In each model card, `wrong` lists the operator-relevant problems in order of severity: contradicted critical facts first, then missing operations, then invented specs.
- **Check for the known patterns from 289661208202** and report them if they recur:
  1. **Prompt-example leakage.** `pcp_wi_generator/prompt_builder.py` (lines ~48–104) contains a filled-in *welding* WI. Search the generated dumps for its values: `grep -l -e "UNIT-3" -e "11/11/17" -e "Collect all loose parts" -e "Gun No. 90" -e "Clamp the fixture" "P"/eval_work/text/*.txt`. Values found in a generated WI but not in the PPAP point to the example.
     - Caution: if the part really is a welded assembly, welding steps may be correct. Judge against the golden, not against this pattern.
  2. **Header revision confusion.** A PPAP holds both the part revision and date and each form's own revision and date (PCP/PFD, e.g. "00 / 11/11/17"). Note which one the golden uses and which ones models took.
  3. **PPAP-backed extras.** Count critical hallucinations with `in_ppap: true` against those with `false`. Models that copy real PPAP detail the golden leaves out are penalised by the judge; say so.
  4. **Golden content missing from the PPAP.** Golden items such as "plastic mallet" or "rust remover" may not exist in the PPAP; check with grep. Rework scores then reward copying the example, not reading the source.
  5. **Run-setting differences.** Compare `max_tokens`, `completion_tokens` and language in `manifest.json` → `models.*.cost`. Only call a token limit a cause if the completion tokens are near the limit.
- `recommendations` should be concrete actions (prompt changes, judge changes, which model to keep testing), and should state the sample-size limit.

## 6. Troubleshooting

- *"Not a directory"*: the folder name has a leading or trailing space. Copy it from `ls`.
- *Golden or generated WI without `_Stage_NN`*: rename it or tell the user. `prepare.py` relies on that token.
- *`check-facts` lists step numbers*: cells that hold only a counter ("6", "13)", "4.") are ignored automatically. Other leftovers are usually inside sentences, so look for them in the golden text.
- *A model has no WI for a stage*: `prepare.py` warns. Score the stages it has; the PDF marks the missing stage. Tell the user.
- *Chrome not found*: `build_report.py` falls back to `wkhtmltopdf`. Hindi shaping may be worse there, but the report is mostly English.
- *Re-running*: every step can be repeated safely. `prepare.py` rewrites the text dumps and manifest but leaves your facts, verdicts and notes alone.
