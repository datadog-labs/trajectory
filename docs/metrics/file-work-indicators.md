## File-Work Indicators

File-work indicators show which files an agent read or changed, and how much
of a PR's cost went to each file. Trajectory sends two file-work metrics by
default. Both have a `file_path` tag, so they have high cardinality. Trajectory
limits the number of paths for each turn and PR.

| Metric | Type | Scope | What it measures |
|---|---|---|---|
| `trajectory.turn.file_work.weight.additive` | count | turn | File work in a turn. Tags: repository-relative `file_path`, `lens:read` or `lens:intermediate_edit`, `weight_unit`, and `evidence_status`. |
| `trajectory.pr.file_work.cost_indicator.usd.additive` | count | pr | A directional score that splits the PR-work cost across files in one lens, in proportion to their file-work weights. It is safe to correct. |

### Tags and how to query

File-work indicators carry `trajectory.cost_role:indicator`. They do not carry
`trajectory.cost_contract:v2` or `trajectory.cost_source:turn_metrics`.

Query one lens at a time. The lenses overlap, so never add them together.
Never add file-work indicators to spend totals.

### How Trajectory weighs file work

- A successful read counts the bytes of the returned payload.
- A change attempt by the model counts the bytes of the change payload.
- If the size is missing, the work counts as one operation.

The turn metric is an input for the PR indicator. It is not a cost.

After Trajectory removes duplicate events, each repeated call to a tool still
adds one operation. A PR lens might contain both byte and operation evidence.
In that case, Trajectory uses operation counts for **all** paths in the lens,
including `_other`. The lens then reports `weight_unit:operations` and
`evidence_status:partial`. A lens with only byte evidence keeps byte weights.
Turn metrics keep their own units.

### Path limits

Each turn keeps at most 25 file paths as separate series. Trajectory adds the
weight of the other paths to `_other`, separately for each lens and unit. Each
PR lens keeps its 25 paths with the highest weight in the same way. The rest
goes to `_other`, so the total for each lens stays exact.

### PR cost indicator

The PR metric has three lenses: `lens:read`, `lens:intermediate_edit`, and
`lens:final_change`. For each PR and lens, the file values add up to that PR's
PR-work cost.

Each turn that contributes keeps its completion timestamp and its local
correction ID. When later evidence changes the weights, Trajectory corrects
each contribution at its original time. Turns without a price stay
unavailable.

When stronger evidence removes a path from a turn, PR, and lens that
Trajectory rebuilt, Trajectory sends a value that reverses that path. If
coverage is missing for a whole lens or for the PR allocation, Trajectory
keeps the earlier values. The OTLP intake accepts points only up to one hour
old. A correction outside that window is not supported, and replay does not
move its timestamp forward.

The `final_change` lens uses distinct file operations from the commit
contents, which do not change after the commit. If commit contents are not
available, it falls back to successful change operations from the transcript.
Commit contents replace the fallback when they become available. Trajectory
never mixes the two sources. Both report `evidence_status:partial`, because
neither measures the size of the final diff.

Trajectory records a commit's files without their names. A committed file
takes its name from the transcript: the path of a file that one of the
session's tool calls read or changed. A committed file that no tool call
named, such as a file a script generated, counts under `_other`, so each
named file keeps its share. Files that were already changed when the session
started are left out.

### Reconciliation

Agent Console reconciliation runs at startup and once a day. Its fixed list of
metrics includes both file-work metrics. It rebuilds them only from saved
session transcripts and verified local PR attribution.

### Turn the feature off

The `file_work_indicators` feature is on by default. To stop sending new
file-work metrics, turn it off in user config or managed config, or set
`TRAJECTORY_DISABLE_FEATURES=file_work_indicators`. Turning it off does not
change cost totals.

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).
