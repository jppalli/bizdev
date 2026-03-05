import { Fragment, useEffect, useMemo, useState } from "react";
import { read, utils } from "xlsx";
import {
  createPlanningGame,
  deletePlanningGame,
  listPlanningGames,
  updatePlanningGamePosition
} from "./lib/data";
import { isSupabaseConfigured } from "./lib/supabase";

const YEARS = [2026, 2027];
const QUARTERS = [1, 2, 3, 4];

const emptyForm = {
  game_name: "",
  studio_name: "",
  genre: "",
  plan_year: 2026,
  plan_quarter: 1
};
const CARD_CHECKS_KEY = "roadmap_card_checks_v1";
const CHECK_KEYS = ["qa", "art", "copy", "signed"];

function readCardChecks() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CARD_CHECKS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCardChecks(next) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CARD_CHECKS_KEY, JSON.stringify(next));
}

function bucketKey(year, quarter) {
  return `${year}-Q${quarter}`;
}

function normalizeHeader(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getFieldValue(row, aliases) {
  const aliasSet = new Set(aliases.map((a) => normalizeHeader(a)));
  for (const [key, value] of Object.entries(row || {})) {
    if (aliasSet.has(normalizeHeader(key))) return String(value || "").trim();
  }
  return "";
}

function parseGoLive(goLiveRaw) {
  const text = String(goLiveRaw || "").toUpperCase();
  const q = text.match(/Q([1-4])/);
  if (!q) return null;
  const y = text.match(/20(26|27)/);
  return { quarter: Number(q[1]), year: y ? Number(y[0]) : 2026 };
}

export default function App() {
  const [games, setGames] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [dragId, setDragId] = useState("");
  const [dropTarget, setDropTarget] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [cardChecks, setCardChecks] = useState(() => readCardChecks());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  const grouped = useMemo(() => {
    const map = {};
    for (const y of YEARS) {
      for (const q of QUARTERS) {
        map[bucketKey(y, q)] = [];
      }
    }
    for (const game of games) {
      const key = bucketKey(game.plan_year, game.plan_quarter);
      if (!map[key]) map[key] = [];
      map[key].push(game);
    }
    Object.keys(map).forEach((k) => map[k].sort((a, b) => a.sort_order - b.sort_order));
    return map;
  }, [games]);

  async function loadGames() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");
    try {
      const rows = await listPlanningGames();
      setGames(rows || []);
    } catch (e) {
      setError(e.message || "Failed loading roadmap.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGames();
  }, []);

  async function addManualCard(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    try {
      const key = bucketKey(form.plan_year, form.plan_quarter);
      const sortOrder = (grouped[key] || []).length;
      const row = await createPlanningGame({ ...form, sort_order: sortOrder, source: "manual" });
      setGames((prev) => [...prev, row]);
      setForm(emptyForm);
      setShowAddForm(false);
      setInfo("Game added.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function importSpreadsheet(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setInfo("Importing...");
    try {
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const headerIndex = matrix.findIndex((row) =>
        row.some((cell) => String(cell || "").toUpperCase().includes("GO LIVE"))
      );
      if (headerIndex < 0) throw new Error("No header row with GO LIVE found.");
      const headers = matrix[headerIndex].map((h) => String(h || "").trim());
      const rows = matrix.slice(headerIndex + 1).map((r) => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = r[i] ?? "";
        });
        return obj;
      });

      const seen = new Set(
        games.map((g) => `${String(g.game_name).toLowerCase()}|${g.plan_year}|${g.plan_quarter}`)
      );
      const nextOrder = {};
      for (const y of YEARS) {
        for (const q of QUARTERS) {
          nextOrder[bucketKey(y, q)] = (grouped[bucketKey(y, q)] || []).length;
        }
      }

      let added = 0;
      let skipped = 0;
      const inserted = [];

      for (const row of rows) {
        const goLive = getFieldValue(row, ["GO LIVE", "GoLive", "Launch Quarter", "Launch"]);
        const parsed = parseGoLive(goLive);
        if (!parsed) {
          skipped += 1;
          continue;
        }

        const gameName = getFieldValue(row, ["Game", "Game Name", "Title", "Name"]);
        if (!gameName) {
          skipped += 1;
          continue;
        }

        const key = `${gameName.toLowerCase()}|${parsed.year}|${parsed.quarter}`;
        if (seen.has(key)) {
          skipped += 1;
          continue;
        }

        const colKey = bucketKey(parsed.year, parsed.quarter);
        const rowToInsert = {
          game_name: gameName,
          studio_name: getFieldValue(row, ["Source", "Developer/Studio", "Studio", "Developer"]) || null,
          genre: getFieldValue(row, ["Genre"]) || null,
          platform: null,
          go_live_raw: goLive || null,
          plan_year: parsed.year,
          plan_quarter: parsed.quarter,
          sort_order: nextOrder[colKey] || 0,
          source: "spreadsheet"
        };

        const created = await createPlanningGame(rowToInsert);
        inserted.push(created);
        nextOrder[colKey] += 1;
        seen.add(key);
        added += 1;
      }

      if (inserted.length > 0) setGames((prev) => [...prev, ...inserted]);
      setInfo(`Import complete: ${added} added, ${skipped} skipped.`);
    } catch (err) {
      setError(err.message || "Import failed.");
      setInfo("");
    } finally {
      e.target.value = "";
    }
  }

  async function moveCard(cardId, targetYear, targetQuarter, targetIndex) {
    const moving = games.find((g) => g.id === cardId);
    if (!moving) return;

    const sourceKey = bucketKey(moving.plan_year, moving.plan_quarter);
    const targetKey = bucketKey(targetYear, targetQuarter);

    const sourceList = (grouped[sourceKey] || []).filter((g) => g.id !== cardId);
    const targetBase = sourceKey === targetKey ? sourceList : [...(grouped[targetKey] || [])];
    const insertAt = Math.max(0, Math.min(targetIndex, targetBase.length));
    const targetList = [...targetBase];
    targetList.splice(insertAt, 0, { ...moving, plan_year: targetYear, plan_quarter: targetQuarter });

    const sourceUpdates = sourceList.map((g, idx) => ({
      id: g.id,
      plan_year: g.plan_year,
      plan_quarter: g.plan_quarter,
      sort_order: idx
    }));
    const targetUpdates = targetList.map((g, idx) => ({
      id: g.id,
      plan_year: targetYear,
      plan_quarter: targetQuarter,
      sort_order: idx
    }));

    const merged = sourceKey === targetKey ? targetUpdates : [...sourceUpdates, ...targetUpdates];
    const prev = games;

    setGames((old) =>
      old.map((g) => {
        const match = merged.find((m) => m.id === g.id);
        return match
          ? { ...g, plan_year: match.plan_year, plan_quarter: match.plan_quarter, sort_order: match.sort_order }
          : g;
      })
    );

    try {
      await Promise.all(
        merged.map((u) =>
          updatePlanningGamePosition(u.id, {
            plan_year: u.plan_year,
            plan_quarter: u.plan_quarter,
            sort_order: u.sort_order
          })
        )
      );
    } catch (err) {
      setGames(prev);
      setError(err.message || "Could not move card.");
    } finally {
      setDropTarget(null);
    }
  }

  function handleCardDragOver(e, year, quarter, index) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const insertBefore = e.clientY < rect.top + rect.height / 2;
    setDropTarget({
      year,
      quarter,
      index: insertBefore ? index : index + 1
    });
  }

  function handleColumnDragOver(e, year, quarter, cardsLength) {
    e.preventDefault();
    setDropTarget({ year, quarter, index: cardsLength });
  }

  async function removeCard(cardId) {
    const prev = games;
    setGames((old) => old.filter((g) => g.id !== cardId));
    setError("");
    setInfo("");
    try {
      await deletePlanningGame(cardId);
      setCardChecks((prevChecks) => {
        const next = { ...prevChecks };
        delete next[cardId];
        writeCardChecks(next);
        return next;
      });
      setInfo("Card deleted.");
    } catch (err) {
      setGames(prev);
      setError(err.message || "Could not delete card.");
    }
  }

  function askDelete(card) {
    setDeleteCandidate({ id: card.id, game_name: card.game_name });
  }

  async function confirmDelete() {
    if (!deleteCandidate?.id) return;
    await removeCard(deleteCandidate.id);
    setDeleteCandidate(null);
  }

  function toggleCheck(cardId, checkKey) {
    setCardChecks((prev) => {
      const current = prev[cardId] || {};
      const nextForCard = {
        ...current,
        [checkKey]: !Boolean(current[checkKey])
      };
      const next = {
        ...prev,
        [cardId]: nextForCard
      };
      writeCardChecks(next);
      return next;
    });
  }

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Game Roadmap Planner</h1>
          <p>Import Excel and drag cards across 2026 and 2027 quarters.</p>
        </div>
        <div className="top-actions">
          <button type="button" onClick={() => setShowAddForm((v) => !v)}>
            {showAddForm ? "Close Add Game" : "+ Add Game"}
          </button>
          <label className="file top-file">
            Import Spreadsheet
            <input type="file" accept=".xlsx,.xls,.csv" onChange={importSpreadsheet} />
          </label>
          <button onClick={loadGames} disabled={loading || !isSupabaseConfigured}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      {showAddForm && (
        <section className="panel add-panel">
          <form className="inline-form" onSubmit={addManualCard}>
            <input required placeholder="Game name" value={form.game_name} onChange={(e) => setForm({ ...form, game_name: e.target.value })} />
            <input placeholder="Studio (optional)" value={form.studio_name} onChange={(e) => setForm({ ...form, studio_name: e.target.value })} />
            <input placeholder="Genre (optional)" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} />
            <select value={form.plan_year} onChange={(e) => setForm({ ...form, plan_year: Number(e.target.value) })}>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={form.plan_quarter} onChange={(e) => setForm({ ...form, plan_quarter: Number(e.target.value) })}>
              {QUARTERS.map((q) => <option key={q} value={q}>Q{q}</option>)}
            </select>
            <button disabled={!isSupabaseConfigured}>Create Card</button>
          </form>
        </section>
      )}

      {!isSupabaseConfigured && (
        <div className="notice">Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.</div>
      )}
      {error && <div className="error">{error}</div>}
      {info && <div className="notice">{info}</div>}

      <div className="board">
          {YEARS.map((year) => (
            <section key={year} className="year">
              <h2>{year}</h2>
              <div className="quarters">
                {QUARTERS.map((quarter) => {
                  const key = bucketKey(year, quarter);
                  const cards = grouped[key] || [];
                  return (
                    <div
                      key={key}
                      className="quarter"
                      onDragOver={(e) => handleColumnDragOver(e, year, quarter, cards.length)}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (!dragId) return;
                        const targetIndex =
                          dropTarget &&
                          dropTarget.year === year &&
                          dropTarget.quarter === quarter
                            ? dropTarget.index
                            : cards.length;
                        moveCard(dragId, year, quarter, targetIndex);
                        setDragId("");
                      }}
                    >
                      <div className="quarterHead">
                        <strong>Q{quarter}</strong>
                        <span>{cards.length} games</span>
                      </div>
                      <ul>
                        {cards.map((card, index) => (
                          <Fragment key={card.id}>
                            {dragId &&
                              dropTarget &&
                              dropTarget.year === year &&
                              dropTarget.quarter === quarter &&
                              dropTarget.index === index && <li className="drop-line" aria-hidden="true" />}
                            <li
                              draggable
                              onDragStart={() => setDragId(card.id)}
                              onDragEnd={() => {
                                setDragId("");
                                setDropTarget(null);
                              }}
                              onDragOver={(e) => handleCardDragOver(e, year, quarter, index)}
                              className={dragId === card.id ? "is-dragging" : ""}
                            >
                              <strong>{card.game_name}</strong>
                              <span>{card.studio_name || "Studio: blank"}</span>
                              <span>{card.genre || "Genre: blank"}</span>
                              <div className="card-actions">
                                {CHECK_KEYS.map((key) => {
                                  const active = Boolean(cardChecks[card.id]?.[key]);
                                  return (
                                    <button
                                      key={`${card.id}-${key}`}
                                      type="button"
                                      className={active ? "toggle-btn active" : "toggle-btn"}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleCheck(card.id, key);
                                      }}
                                    >
                                      {key.toUpperCase()}
                                    </button>
                                  );
                                })}
                                <button
                                  type="button"
                                  className="icon-btn danger-btn"
                                  title="Delete card"
                                  aria-label="Delete card"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    askDelete(card);
                                  }}
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path
                                      d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </li>
                          </Fragment>
                        ))}
                        {dragId &&
                          dropTarget &&
                          dropTarget.year === year &&
                          dropTarget.quarter === quarter &&
                          dropTarget.index === cards.length && <li className="drop-line" aria-hidden="true" />}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
      </div>
      {deleteCandidate && (
        <div className="modal-backdrop" onClick={() => setDeleteCandidate(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete card?</h3>
            <p>{deleteCandidate.game_name}</p>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setDeleteCandidate(null)}>
                Cancel
              </button>
              <button type="button" className="danger-btn" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
