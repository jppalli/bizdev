import { Fragment, useEffect, useMemo, useState } from "react";
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
  const [editCandidate, setEditCandidate] = useState(null);

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

  // import/migration tools removed by request; manual add/edit only

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

  function askEdit(card) {
    setEditCandidate({
      id: card.id,
      game_name: card.game_name || "",
      studio_name: card.studio_name || "",
      genre: card.genre || "",
      plan_year: card.plan_year,
      plan_quarter: card.plan_quarter
    });
  }

  async function confirmEditSave() {
    if (!editCandidate?.id) return;
    setError("");
    setInfo("");
    try {
      const payload = {
        game_name: editCandidate.game_name,
        studio_name: editCandidate.studio_name || null,
        genre: editCandidate.genre || null,
        plan_year: Number(editCandidate.plan_year),
        plan_quarter: Number(editCandidate.plan_quarter)
      };
      await updatePlanningGamePosition(editCandidate.id, payload);
      setGames((prev) =>
        prev.map((g) =>
          g.id === editCandidate.id
            ? { ...g, ...payload }
            : g
        )
      );
      setInfo("Card updated.");
      setEditCandidate(null);
    } catch (err) {
      setError(err.message || "Could not update card.");
    }
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
                                  className="icon-btn edit-btn"
                                  title="Edit card"
                                  aria-label="Edit card"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    askEdit(card);
                                  }}
                                >
                                  <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path
                                      d="M3 17.25V21h3.75L19.81 7.94l-3.75-3.75L3 17.25zm17.71-10.04a1.003 1.003 0 000-1.42l-2.5-2.5a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 2-2.08z"
                                      fill="currentColor"
                                    />
                                  </svg>
                                </button>
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
      {editCandidate && (
        <div className="modal-backdrop" onClick={() => setEditCandidate(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit card</h3>
            <div className="modal-form">
              <input
                value={editCandidate.game_name}
                onChange={(e) => setEditCandidate({ ...editCandidate, game_name: e.target.value })}
                placeholder="Game name"
              />
              <input
                value={editCandidate.studio_name}
                onChange={(e) => setEditCandidate({ ...editCandidate, studio_name: e.target.value })}
                placeholder="Studio"
              />
              <input
                value={editCandidate.genre}
                onChange={(e) => setEditCandidate({ ...editCandidate, genre: e.target.value })}
                placeholder="Genre"
              />
              <select
                value={editCandidate.plan_year}
                onChange={(e) => setEditCandidate({ ...editCandidate, plan_year: Number(e.target.value) })}
              >
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <select
                value={editCandidate.plan_quarter}
                onChange={(e) => setEditCandidate({ ...editCandidate, plan_quarter: Number(e.target.value) })}
              >
                {QUARTERS.map((q) => <option key={q} value={q}>Q{q}</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setEditCandidate(null)}>
                Cancel
              </button>
              <button type="button" onClick={confirmEditSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
