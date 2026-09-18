import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function updateEmailTemplate(
  id: string,
  input: { subject: string; htmlBody: string; textBody: string; isEnabled: boolean },
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("email_templates")
    .update({
      subject: input.subject,
      html_body: input.htmlBody,
      text_body: input.textBody,
      is_enabled: input.isEnabled,
    })
    .eq("id", id);
  return { error: error ? "Could not save the template." : null };
}

export async function setNotificationRuleEnabled(id: string, isEnabled: boolean): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("notification_rules").update({ is_enabled: isEnabled }).eq("id", id);
  return { error: error ? "Could not update the rule." : null };
}
