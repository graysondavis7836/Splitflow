// BillSplice API — secure backend server
// All sensitive operations (payments, utility connections, account deletion)
// run here instead of in the browser, where secret keys would be exposed.
//
// HOW TO ADD A NEW OPERATION:
// 1. Add a new case to the switch statement below
// 2. Implement the logic (or swap in a real provider)
// 3. Deploy with: supabase functions deploy billsplice-api
//
// CURRENT OPERATIONS:
//   ping           → health check, confirms server is running
//   delete-account → permanently deletes a user from Supabase Auth + users table
//   charge-card    → SWAP LATER: real Stripe payment charge
//   connect-utility → SWAP LATER: real Arcadia/UtilityAPI connection
 
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
// Required for browser requests — every response needs these headers
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
 
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
 
serve(async (req) => {
  // Handle CORS preflight (browser sends this before every real request)
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
 
  try {
    const { action, data } = await req.json();
 
    switch (action) {
 
      // ── Health check — confirms the server is alive ────────────────
      case "ping":
        return json({ ok: true, message: "BillSplice server is running ✓" });
 
      // ── Account deletion — permanently wipes user from Auth + DB ───
      // This MUST run on the server because deleting from Supabase Auth
      // requires the service_role key, which must never go in the browser.
      case "delete-account": {
        const { userId } = data;
        if (!userId) return json({ ok: false, error: "userId is required" }, 400);
 
        // Create an admin client using the service role key
        // This key is stored as a secure secret — never in your app code
        const adminClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SERVICE_ROLE_KEY") ?? "",
          { auth: { autoRefreshToken: false, persistSession: false } }
        );
 
        // Step 1: Delete the user's profile from the users table
        const { error: profileError } = await adminClient
          .from("users")
          .delete()
          .eq("id", userId);
 
        if (profileError) {
          return json({ ok: false, error: "Failed to delete profile: " + profileError.message }, 500);
        }
 
        // Step 2: Delete the user from Supabase Auth
        // This frees up their email so they (or someone else) can sign up again
        const { error: authError } = await adminClient.auth.admin.deleteUser(userId);
 
        if (authError) {
          return json({ ok: false, error: "Failed to delete auth record: " + authError.message }, 500);
        }
 
        return json({ ok: true, message: "Account permanently deleted." });
      }
 
      // ── SWAP LATER: real card charge via Stripe ────────────────────
      // case "charge-card": {
      //   const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
      //   const intent = await stripe.paymentIntents.create({
      //     amount: Math.round(data.amount * 100), // Stripe uses cents
      //     currency: "usd",
      //     payment_method: data.paymentMethodId,
      //     confirm: true,
      //     return_url: data.returnUrl,
      //   });
      //   return json({ ok: true, id: intent.id, status: intent.status });
      // }
 
      // ── SWAP LATER: real utility connection via Arcadia ───────────
      // case "connect-utility": {
      //   const res = await fetch("https://api.arcadia.com/v1/connect", {
      //     method: "POST",
      //     headers: {
      //       "Authorization": "Bearer " + Deno.env.get("ARCADIA_API_KEY"),
      //       "Content-Type": "application/json",
      //     },
      //     body: JSON.stringify({
      //       utility: data.utilityName,
      //       username: data.username,
      //       password: data.password,
      //     }),
      //   });
      //   const result = await res.json();
      //   return json(result.accountId
      //     ? { ok: true, accountId: result.accountId }
      //     : { ok: false, error: result.message }
      //   );
      // }
 
      // ── SWAP LATER: fetch latest bill from utility ─────────────────
      // case "fetch-bill": {
      //   const res = await fetch(
      //     "https://api.arcadia.com/v1/accounts/" + data.accountId + "/bills/latest",
      //     { headers: { "Authorization": "Bearer " + Deno.env.get("ARCADIA_API_KEY") } }
      //   );
      //   const result = await res.json();
      //   return json(result.amount
      //     ? { ok: true, amount: result.amount, dueDate: result.dueDate }
      //     : { ok: false, error: result.message }
      //   );
      // }
 
      default:
        return json({ ok: false, error: "Unknown action: " + action }, 400);
    }
 
  } catch (err) {
    return json({ ok: false, error: (err as Error).message }, 500);
  }
});
 