import { supabase, isSupabaseConfigured } from "./supabase";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase environment variables are missing.");
  }
}

export async function listStudios() {
  requireSupabase();
  const { data, error } = await supabase
    .from("studios")
    .select("id,name,website,region,genres,reliability_score,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createStudio(payload) {
  requireSupabase();
  const { data, error } = await supabase
    .from("studios")
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listOpportunities() {
  requireSupabase();
  const { data, error } = await supabase
    .from("opportunities")
    .select(
      "id,title,status,fit_score,monetization_score,strategic_score,next_step,owner,created_at,studio_id,studios(name)"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createOpportunity(payload) {
  requireSupabase();
  const { data, error } = await supabase
    .from("opportunities")
    .insert([payload])
    .select("*, studios(name)")
    .single();
  if (error) throw error;
  return data;
}

export async function listContracts() {
  requireSupabase();
  const { data, error } = await supabase
    .from("contracts")
    .select(
      "id,game_title,status,revenue_share_pct,microtx_share_pct,start_date,end_date,created_at,studio_id,studios(name)"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createContract(payload) {
  requireSupabase();
  const { data, error } = await supabase
    .from("contracts")
    .insert([payload])
    .select("*, studios(name)")
    .single();
  if (error) throw error;
  return data;
}

export async function listTasks() {
  requireSupabase();
  const { data, error } = await supabase
    .from("tasks")
    .select("id,title,status,priority,due_date,owner,related_type,created_at")
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data;
}

export async function createTask(payload) {
  requireSupabase();
  const { data, error } = await supabase
    .from("tasks")
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listGameEvaluations() {
  requireSupabase();
  const { data, error } = await supabase
    .from("game_evaluations")
    .select(
      "id,game_name,developer_studio,genre,platform,evaluator,evaluation_date,notes,total_score,created_at,game_evaluation_scores(category,weight,score,weighted_score,notes)"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createGameEvaluation(payload) {
  requireSupabase();
  const { scoreRows, ...evaluationPayload } = payload;

  const { data: evalData, error: evalError } = await supabase
    .from("game_evaluations")
    .insert([evaluationPayload])
    .select()
    .single();
  if (evalError) throw evalError;

  const rowsToInsert = (scoreRows || []).map((row) => ({
    evaluation_id: evalData.id,
    category: row.category,
    weight: row.weight,
    score: row.score,
    weighted_score: row.weighted_score,
    notes: row.notes || null
  }));

  if (rowsToInsert.length > 0) {
    const { error: rowsError } = await supabase
      .from("game_evaluation_scores")
      .insert(rowsToInsert);
    if (rowsError) throw rowsError;
  }

  const { data, error } = await supabase
    .from("game_evaluations")
    .select(
      "id,game_name,developer_studio,genre,platform,evaluator,evaluation_date,notes,total_score,created_at,game_evaluation_scores(category,weight,score,weighted_score,notes)"
    )
    .eq("id", evalData.id)
    .single();
  if (error) throw error;
  return data;
}

const ROADMAP_STORAGE_KEY = "roadmap_planning_games_v1";

function hasLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readLocalPlanningGames() {
  if (!hasLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(ROADMAP_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalPlanningGames(rows) {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem(ROADMAP_STORAGE_KEY, JSON.stringify(rows));
}

function isPlanningTableMissing(error) {
  if (!error) return false;
  if (error.code === "PGRST205") return true;
  return String(error.message || "").includes("planning_games");
}

export async function listPlanningGames() {
  if (!isSupabaseConfigured || !supabase) {
    return readLocalPlanningGames();
  }
  const { data, error } = await supabase
    .from("planning_games")
    .select(
      "id,game_name,studio_name,genre,platform,go_live_raw,plan_year,plan_quarter,sort_order,source,notes,created_at,updated_at"
    )
    .order("plan_year", { ascending: true })
    .order("plan_quarter", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    if (isPlanningTableMissing(error)) return readLocalPlanningGames();
    throw error;
  }
  return data;
}

export async function createPlanningGame(payload) {
  const createLocal = () => {
    const rows = readLocalPlanningGames();
    const now = new Date().toISOString();
    const row = {
      id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      ...payload,
      created_at: now,
      updated_at: now
    };
    rows.push(row);
    writeLocalPlanningGames(rows);
    return row;
  };

  if (!isSupabaseConfigured || !supabase) {
    return createLocal();
  }

  const { data, error } = await supabase
    .from("planning_games")
    .insert([payload])
    .select()
    .single();
  if (error) {
    if (isPlanningTableMissing(error)) return createLocal();
    throw error;
  }
  return data;
}

export async function updatePlanningGamePosition(id, payload) {
  const updateLocal = () => {
    const rows = readLocalPlanningGames();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    const updated = {
      ...rows[idx],
      ...payload,
      updated_at: new Date().toISOString()
    };
    rows[idx] = updated;
    writeLocalPlanningGames(rows);
    return updated;
  };

  if (!isSupabaseConfigured || !supabase) {
    return updateLocal();
  }

  const { data, error } = await supabase
    .from("planning_games")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    if (isPlanningTableMissing(error)) return updateLocal();
    throw error;
  }
  return data;
}

export async function deletePlanningGame(id) {
  const deleteLocal = () => {
    const rows = readLocalPlanningGames();
    const next = rows.filter((r) => r.id !== id);
    writeLocalPlanningGames(next);
    return true;
  };

  if (!isSupabaseConfigured || !supabase) {
    return deleteLocal();
  }

  const { error } = await supabase
    .from("planning_games")
    .delete()
    .eq("id", id);

  if (error) {
    if (isPlanningTableMissing(error)) return deleteLocal();
    throw error;
  }
  return true;
}
