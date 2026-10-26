const SUPABASE_URL = "https://fzivqcorhlajgdopozsx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_t6xfKMuQkOFtUT7_8WdPcA_BtPDBLw1";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);