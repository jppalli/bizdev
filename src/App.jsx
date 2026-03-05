import { useEffect, useMemo, useState } from "react";
import {
  createContract,
  createOpportunity,
  createStudio,
  createTask,
  listContracts,
  listOpportunities,
  listStudios,
  listTasks
} from "./lib/data";
import { isSupabaseConfigured } from "./lib/supabase";

const TABS = ["Dashboard", "Studios", "Opportunities", "Contracts", "Tasks"];

const emptyStudio = {
  name: "",
  website: "",
  region: "",
  genres: "",
  reliability_score: 3
};

const emptyOpportunity = {
  title: "",
  studio_id: "",
  status: "sourced",
  fit_score: 3,
  monetization_score: 3,
  strategic_score: 3,
  next_step: "",
  owner: ""
};

const emptyContract = {
  studio_id: "",
  game_title: "",
  status: "draft",
  revenue_share_pct: 50,
  microtx_share_pct: 50,
  start_date: "",
  end_date: ""
};

const emptyTask = {
  title: "",
  status: "open",
  priority: "medium",
  due_date: "",
  owner: "",
  related_type: "opportunity"
};

function badgeClass(status) {
  const s = (status || "").toLowerCase();
  if (["signed", "launched", "done"].includes(s)) return "badge good";
  if (["rejected", "blocked", "overdue"].includes(s)) return "badge bad";
  if (["negotiation", "evaluating", "in_progress", "draft"].includes(s)) return "badge warn";
  return "badge";
}

export default function App() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [studios, setStudios] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [studioForm, setStudioForm] = useState(emptyStudio);
  const [opportunityForm, setOpportunityForm] = useState(emptyOpportunity);
  const [contractForm, setContractForm] = useState(emptyContract);
  const [taskForm, setTaskForm] = useState(emptyTask);

  const dashboard = useMemo(() => {
    const openTasks = tasks.filter((t) => t.status !== "done").length;
    const activeDeals = opportunities.filter((o) =>
      ["contacted", "evaluating", "negotiation"].includes(o.status)
    ).length;
    const dueSoon = tasks.filter((t) => {
      if (!t.due_date || t.status === "done") return false;
      const due = new Date(t.due_date);
      const now = new Date();
      const in7 = new Date();
      in7.setDate(now.getDate() + 7);
      return due >= now && due <= in7;
    }).length;
    return {
      studios: studios.length,
      opportunities: opportunities.length,
      contracts: contracts.length,
      openTasks,
      activeDeals,
      dueSoon
    };
  }, [studios, opportunities, contracts, tasks]);

  async function loadAll() {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError("");
    try {
      const [studioRows, opportunityRows, contractRows, taskRows] = await Promise.all([
        listStudios(),
        listOpportunities(),
        listContracts(),
        listTasks()
      ]);
      setStudios(studioRows || []);
      setOpportunities(opportunityRows || []);
      setContracts(contractRows || []);
      setTasks(taskRows || []);
    } catch (e) {
      setError(e.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function submitStudio(e) {
    e.preventDefault();
    setError("");
    try {
      const row = await createStudio(studioForm);
      setStudios((s) => [row, ...s]);
      setStudioForm(emptyStudio);
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitOpportunity(e) {
    e.preventDefault();
    setError("");
    try {
      const row = await createOpportunity(opportunityForm);
      setOpportunities((s) => [row, ...s]);
      setOpportunityForm(emptyOpportunity);
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitContract(e) {
    e.preventDefault();
    setError("");
    try {
      const row = await createContract(contractForm);
      setContracts((s) => [row, ...s]);
      setContractForm(emptyContract);
    } catch (err) {
      setError(err.message);
    }
  }

  async function submitTask(e) {
    e.preventDefault();
    setError("");
    try {
      const row = await createTask(taskForm);
      setTasks((s) => [row, ...s]);
      setTaskForm(emptyTask);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>BizDev Hub</h1>
        <p>Arkadium publishing workflow</p>
        <nav>
          {TABS.map((tab) => (
            <button
              key={tab}
              className={tab === activeTab ? "nav-btn active" : "nav-btn"}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <h2>{activeTab}</h2>
          <button onClick={loadAll} disabled={loading || !isSupabaseConfigured}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </header>

        {!isSupabaseConfigured && (
          <div className="notice">
            Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to a `.env` file.
          </div>
        )}

        {error && <div className="error">{error}</div>}

        {activeTab === "Dashboard" && (
          <section className="cards-grid">
            <article className="card"><h3>Studios</h3><p>{dashboard.studios}</p></article>
            <article className="card"><h3>Opportunities</h3><p>{dashboard.opportunities}</p></article>
            <article className="card"><h3>Contracts</h3><p>{dashboard.contracts}</p></article>
            <article className="card"><h3>Open Tasks</h3><p>{dashboard.openTasks}</p></article>
            <article className="card"><h3>Active Deals</h3><p>{dashboard.activeDeals}</p></article>
            <article className="card"><h3>Tasks due in 7d</h3><p>{dashboard.dueSoon}</p></article>
          </section>
        )}

        {activeTab === "Studios" && (
          <section className="two-col">
            <form className="panel" onSubmit={submitStudio}>
              <h3>Add Studio</h3>
              <input required placeholder="Studio name" value={studioForm.name} onChange={(e) => setStudioForm({ ...studioForm, name: e.target.value })} />
              <input placeholder="Website" value={studioForm.website} onChange={(e) => setStudioForm({ ...studioForm, website: e.target.value })} />
              <input placeholder="Region" value={studioForm.region} onChange={(e) => setStudioForm({ ...studioForm, region: e.target.value })} />
              <input placeholder="Genres (comma-separated)" value={studioForm.genres} onChange={(e) => setStudioForm({ ...studioForm, genres: e.target.value })} />
              <label>
                Reliability (1-5)
                <input type="number" min="1" max="5" value={studioForm.reliability_score} onChange={(e) => setStudioForm({ ...studioForm, reliability_score: Number(e.target.value) })} />
              </label>
              <button disabled={!isSupabaseConfigured}>Create Studio</button>
            </form>

            <div className="panel">
              <h3>Studios</h3>
              <ul className="list">
                {studios.map((s) => (
                  <li key={s.id}>
                    <strong>{s.name}</strong>
                    <span>{s.region || "Unknown region"}</span>
                    <span>Reliability: {s.reliability_score}/5</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {activeTab === "Opportunities" && (
          <section className="two-col">
            <form className="panel" onSubmit={submitOpportunity}>
              <h3>Add Opportunity</h3>
              <input required placeholder="Game / opportunity title" value={opportunityForm.title} onChange={(e) => setOpportunityForm({ ...opportunityForm, title: e.target.value })} />
              <select required value={opportunityForm.studio_id} onChange={(e) => setOpportunityForm({ ...opportunityForm, studio_id: e.target.value })}>
                <option value="">Choose Studio</option>
                {studios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={opportunityForm.status} onChange={(e) => setOpportunityForm({ ...opportunityForm, status: e.target.value })}>
                <option value="sourced">Sourced</option>
                <option value="contacted">Contacted</option>
                <option value="evaluating">Evaluating</option>
                <option value="negotiation">Negotiation</option>
                <option value="signed">Signed</option>
                <option value="launched">Launched</option>
                <option value="rejected">Rejected</option>
              </select>
              <input placeholder="Owner" value={opportunityForm.owner} onChange={(e) => setOpportunityForm({ ...opportunityForm, owner: e.target.value })} />
              <input placeholder="Next step" value={opportunityForm.next_step} onChange={(e) => setOpportunityForm({ ...opportunityForm, next_step: e.target.value })} />
              <label>
                Fit score
                <input type="number" min="1" max="5" value={opportunityForm.fit_score} onChange={(e) => setOpportunityForm({ ...opportunityForm, fit_score: Number(e.target.value) })} />
              </label>
              <label>
                Monetization score
                <input type="number" min="1" max="5" value={opportunityForm.monetization_score} onChange={(e) => setOpportunityForm({ ...opportunityForm, monetization_score: Number(e.target.value) })} />
              </label>
              <label>
                Strategic score
                <input type="number" min="1" max="5" value={opportunityForm.strategic_score} onChange={(e) => setOpportunityForm({ ...opportunityForm, strategic_score: Number(e.target.value) })} />
              </label>
              <button disabled={!isSupabaseConfigured}>Create Opportunity</button>
            </form>

            <div className="panel">
              <h3>Pipeline</h3>
              <ul className="list">
                {opportunities.map((o) => (
                  <li key={o.id}>
                    <strong>{o.title}</strong>
                    <span>{o.studios?.name || "No studio"}</span>
                    <span className={badgeClass(o.status)}>{o.status}</span>
                    <span>Score: {o.fit_score + o.monetization_score + o.strategic_score}/15</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {activeTab === "Contracts" && (
          <section className="two-col">
            <form className="panel" onSubmit={submitContract}>
              <h3>Add Contract</h3>
              <input required placeholder="Game title" value={contractForm.game_title} onChange={(e) => setContractForm({ ...contractForm, game_title: e.target.value })} />
              <select required value={contractForm.studio_id} onChange={(e) => setContractForm({ ...contractForm, studio_id: e.target.value })}>
                <option value="">Choose Studio</option>
                {studios.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={contractForm.status} onChange={(e) => setContractForm({ ...contractForm, status: e.target.value })}>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="signed">Signed</option>
                <option value="expired">Expired</option>
              </select>
              <label>
                Revenue share %
                <input type="number" min="0" max="100" value={contractForm.revenue_share_pct} onChange={(e) => setContractForm({ ...contractForm, revenue_share_pct: Number(e.target.value) })} />
              </label>
              <label>
                Microtransaction split %
                <input type="number" min="0" max="100" value={contractForm.microtx_share_pct} onChange={(e) => setContractForm({ ...contractForm, microtx_share_pct: Number(e.target.value) })} />
              </label>
              <label>
                Start date
                <input type="date" value={contractForm.start_date} onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })} />
              </label>
              <label>
                End date
                <input type="date" value={contractForm.end_date} onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })} />
              </label>
              <button disabled={!isSupabaseConfigured}>Create Contract</button>
            </form>

            <div className="panel">
              <h3>Contracts</h3>
              <ul className="list">
                {contracts.map((c) => (
                  <li key={c.id}>
                    <strong>{c.game_title}</strong>
                    <span>{c.studios?.name || "No studio"}</span>
                    <span className={badgeClass(c.status)}>{c.status}</span>
                    <span>{c.revenue_share_pct}% rev / {c.microtx_share_pct}% microtx</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {activeTab === "Tasks" && (
          <section className="two-col">
            <form className="panel" onSubmit={submitTask}>
              <h3>Add Task</h3>
              <input required placeholder="Task title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
              <input placeholder="Owner" value={taskForm.owner} onChange={(e) => setTaskForm({ ...taskForm, owner: e.target.value })} />
              <select value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
              </select>
              <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <select value={taskForm.related_type} onChange={(e) => setTaskForm({ ...taskForm, related_type: e.target.value })}>
                <option value="opportunity">Opportunity</option>
                <option value="contract">Contract</option>
                <option value="studio">Studio</option>
                <option value="general">General</option>
              </select>
              <label>
                Due date
                <input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm({ ...taskForm, due_date: e.target.value })} />
              </label>
              <button disabled={!isSupabaseConfigured}>Create Task</button>
            </form>

            <div className="panel">
              <h3>Task List</h3>
              <ul className="list">
                {tasks.map((t) => (
                  <li key={t.id}>
                    <strong>{t.title}</strong>
                    <span className={badgeClass(t.status)}>{t.status}</span>
                    <span>{t.priority}</span>
                    <span>{t.due_date || "No due date"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
