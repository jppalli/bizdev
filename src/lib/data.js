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
