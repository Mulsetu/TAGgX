"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  sendTestEmailAction,
  toggleNotificationRuleAction,
  updateEmailTemplateAction,
} from "@/modules/email/actions";
import type {
  EmailFormState,
  EmailTemplateSummary,
  NotificationLogSummary,
  NotificationRuleSummary,
} from "@/modules/email/types";

const initialState: EmailFormState = { error: null };

function TemplateEditor({ template }: { template: EmailTemplateSummary }) {
  const router = useRouter();
  const [state, setState] = useState<EmailFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateEmailTemplateAction(template.id, initialState, formData);
      setState(result);
      if (!result.error) {
        router.refresh();
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 rounded-lg border p-4">
      <p className="font-medium">{template.eventKey.replace(/_/g, " ")}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`subject-${template.id}`}>Subject</Label>
        <Input id={`subject-${template.id}`} name="subject" defaultValue={template.subject} required maxLength={200} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`html-${template.id}`}>HTML body</Label>
        <Textarea id={`html-${template.id}`} name="htmlBody" defaultValue={template.htmlBody} rows={4} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`text-${template.id}`}>Text body</Label>
        <Textarea id={`text-${template.id}`} name="textBody" defaultValue={template.textBody} rows={3} required />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isEnabled" defaultChecked={template.isEnabled} />
        Enabled
      </label>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-muted-foreground">{state.success}</p> : null}
      <Button type="submit" disabled={isPending} size="sm" className="w-fit">
        {isPending ? "Saving..." : "Save template"}
      </Button>
    </form>
  );
}

function RulesList({ rules }: { rules: NotificationRuleSummary[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string, isEnabled: boolean) {
    startTransition(async () => {
      const result = await toggleNotificationRuleAction(id, isEnabled);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <ul className="flex flex-col gap-2">
        {rules.map((rule) => (
          <li key={rule.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span>
              {rule.eventKey.replace(/_/g, " ")} · {rule.offsetDays} day{rule.offsetDays === 1 ? "" : "s"} before
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => toggle(rule.id, !rule.isEnabled)}
            >
              {rule.isEnabled ? "On" : "Off"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NotificationsAdmin({
  templates,
  rules,
  logs,
}: {
  templates: EmailTemplateSummary[];
  rules: NotificationRuleSummary[];
  logs: NotificationLogSummary[];
}) {
  const [testState, setTestState] = useState<EmailFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  function sendTest(formData: FormData) {
    startTransition(async () => {
      setTestState(await sendTestEmailAction(initialState, formData));
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <form action={sendTest} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="eventKey">Send test</Label>
          <NativeSelect id="eventKey" name="eventKey" defaultValue={templates[0]?.eventKey ?? ""}>
            {templates.map((template) => (
              <option key={template.id} value={template.eventKey}>
                {template.eventKey.replace(/_/g, " ")}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="to">To (optional)</Label>
          <Input id="to" name="to" type="email" placeholder="you@company.com" />
        </div>
        <Button type="submit" disabled={isPending} size="sm">
          {isPending ? "Sending..." : "Send test email"}
        </Button>
        {testState.error ? <p className="w-full text-sm text-destructive">{testState.error}</p> : null}
        {testState.success ? <p className="w-full text-sm text-muted-foreground">{testState.success}</p> : null}
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Reminder rules</h2>
        <RulesList rules={rules} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Templates</h2>
        <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
          {templates.map((template) => (
            <TemplateEditor key={template.id} template={template} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Recent sends</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notification log rows yet.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {logs.map((log) => (
              <li key={log.id} className="rounded-md border px-3 py-2">
                {log.eventKey} → {log.recipientEmail} · {log.status}
                <span className="ml-2 text-xs text-muted-foreground">
                  {new Date(log.sentAt).toLocaleString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
