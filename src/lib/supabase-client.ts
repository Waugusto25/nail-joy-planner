// Keep one browser auth client for the whole application. The global server-function
// middleware already imports this generated instance; creating another client here
// makes both instances compete for the same persisted session and can remount forms.
export { supabase } from "@/integrations/supabase/client";