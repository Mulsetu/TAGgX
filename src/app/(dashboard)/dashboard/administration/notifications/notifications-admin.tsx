"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Mail, Pencil, Send } from "lucide-react";
import { LocalTime } from "@/components/layout/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  sendTestEmailAction,
  toggleNotificationRuleAction,
  updateEmailTemplateAction,
} from "@/modules/email/actions";
import {
  EMAIL_EVENT_GROUPS,
  EMAIL_EVENT_META,
  emailEventLabel,
  type EmailFormState,
  type EmailTemplateSummary,
  type NotificationLogSummary,
  type NotificationRuleSummary,
} from "@/modules/email/types";

const initialState: EmailFormState = { error: null };

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  sent: { label: "Sent", className: "bg-emerald-50 text-emerald-700" },
  skipped: { label: "Not delivered", className: "bg-amber-50 text-amber-800" },
  failed: { label: "Failed", className: "bg-red-50 text-red-700" },
  pending: { label: "Sending", className: "bg-slate-100 text-slate-600" },
};

function templateForm(template: EmailTemplateSummary, isEnabled: boolean): FormData {
  const formData = new FormData();
  formData.set("subject", template.subject);
  formData.set("htmlBody", template.htmlBody);
  formData.set("textBody", template.textBody);
  if (isEnabled) formData.set("isEnabled", "on");
  return formData;
}

function TemplateDialog({
  template,
  open,
  onOpenChange,
  canEdit,
}: {
  template: EmailTemplateSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<EmailFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateEmailTemplateAction(template.id, initialState, formData);
      setState(result);
      if (!result.error) {
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{emailEventLabel(template.eventKey)} email</DialogTitle>
          <DialogDescription>
            Use placeholders like {"{{asset_name}}"}, {"{{asset_code}}"}, {"{{due_date}}"} and {"{{asset_url}}"}.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`subject-${template.id}`}>Subject</Label>
            <Input id={`subject-${template.id}`} name="subject" defaultValue={template.subject} required maxLength={200} disabled={!canEdit} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`html-${template.id}`}>Email body (HTML)</Label>
            <Textarea id={`html-${template.id}`} name="htmlBody" defaultValue={template.htmlBody} rows={6} required disabled={!canEdit} className="font-mono text-xs" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`text-${template.id}`}>Plain-text version</Label>
            <Textarea id={`text-${template.id}`} name="textBody" defaultValue={template.textBody} rows={3} required disabled={!canEdit} />
          </div>
          {template.isEnabled ? <input type="hidden" name="isEnabled" value="on" /> : null}
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {canEdit ? (
            <Button type="submit" disabled={isPending} className="self-start">
              {isPending ? "Saving..." : "Save template"}
            </Button>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EventRow({
  template,
  rules,
  canEdit,
}: {
  template: EmailTemplateSummary;
  rules: NotificationRuleSummary[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const meta = EMAIL_EVENT_META[template.eventKey];

  function toggleTemplate(next: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await updateEmailTemplateAction(template.id, initialState, templateForm(template, next));
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  function toggleRule(rule: NotificationRuleSummary) {
    setError(null);
    startTransition(async () => {
      const result = await toggleNotificationRuleAction(rule.id, !rule.isEnabled);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("text-sm font-medium", template.isEnabled ? "text-slate-900" : "text-slate-400")}>
            {emailEventLabel(template.eventKey)}
          </p>
          {meta ? <p className="text-xs text-slate-500">{meta.description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label={`Edit ${emailEventLabel(template.eventKey)} template`}>
            <Pencil className="size-3.5" />
            <span className="hidden sm:inline">{canEdit ? "Edit" : "View"}</span>
          </Button>
          <Switch
            checked={template.isEnabled}
            disabled={!canEdit || isPending}
            onCheckedChange={toggleTemplate}
            aria-label={`${template.isEnabled ? "Turn off" : "Turn on"} ${emailEventLabel(template.eventKey)} emails`}
          />
        </div>
      </div>
      {rules.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">Send</span>
          {rules
            .slice()
            .sort((a, b) => b.offsetDays - a.offsetDays)
            .map((rule) => (
              <button
                key={rule.id}
                type="button"
                disabled={!canEdit || isPending || !template.isEnabled}
                onClick={() => toggleRule(rule)}
                aria-pressed={rule.isEnabled}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 transition-colors disabled:opacity-50",
                  rule.isEnabled
                    ? "bg-primary/10 text-slate-900 ring-primary/40"
                    : "bg-white text-slate-400 ring-slate-200 line-through",
                )}
              >
                {rule.offsetDays === 0 ? "on the day" : `${rule.offsetDays}d before`}
              </button>
            ))}
        </div>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <TemplateDialog template={template} open={editing} onOpenChange={setEditing} canEdit={canEdit} />
    </li>
  );
}

export function NotificationsAdmin({
  templates,
  rules,
  logs,
  deliveryLive,
  canEdit,
}: {
  templates: EmailTemplateSummary[];
  rules: NotificationRuleSummary[];
  logs: NotificationLogSummary[];
  deliveryLive: boolean;
  canEdit: boolean;
}) {
  const [testState, setTestState] = useState<EmailFormState>(initialState);
  const [isPending, startTransition] = useTransition();
  const enabledCount = templates.filter((template) => template.isEnabled).length;

  function sendTest(formData: FormData) {
    startTransition(async () => {
      setTestState(await sendTestEmailAction(initialState, formData));
    });
  }

  const grouped = EMAIL_EVENT_GROUPS.map((group) => ({
    ...group,
    templates: templates.filter((template) => (EMAIL_EVENT_META[template.eventKey]?.group ?? "custody") === group.id),
  })).filter((group) => group.templates.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-3 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div
          className={cn(
            "flex flex-col gap-2 rounded-xl border p-4",
            deliveryLive ? "border-emerald-200 bg-emerald-50/60" : "border-amber-300 bg-amber-50",
          )}
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            {deliveryLive ? (
              <CheckCircle2 className="size-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="size-4 text-amber-600" />
            )}
            {deliveryLive ? "Email delivery is on" : "Emails are not being delivered"}
          </p>
          <p className="text-sm text-slate-600">
            {deliveryLive
              ? `${enabledCount} of ${templates.length} automatic emails are on. They go to the Company Admin and, where relevant, the person involved.`
              : "This server is in development mode, so emails are only written to the server log. Set SEND_REAL_EMAILS_IN_DEV=true (or deploy to production) to send them."}
          </p>
        </div>

        <form action={sendTest} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Send className="size-4 text-slate-500" /> Send a test email
          </p>
          <div className="grid gap-2 @md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <NativeSelect name="eventKey" defaultValue={templates[0]?.eventKey ?? ""} aria-label="Email to test">
              {templates.map((template) => (
                <option key={template.id} value={template.eventKey}>
                  {emailEventLabel(template.eventKey)}
                </option>
              ))}
            </NativeSelect>
            <Input name="to" type="email" placeholder="Your email (default)" aria-label="Send test to" />
            <Button type="submit" disabled={isPending || !canEdit}>
              {isPending ? "Sending..." : "Send"}
            </Button>
          </div>
          {testState.error ? <p className="text-sm text-destructive">{testState.error}</p> : null}
          {testState.success ? <p className="text-sm text-emerald-700">{testState.success}</p> : null}
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-slate-900">Automatic emails</h2>
        <div className="grid gap-3 @4xl:grid-cols-3">
          {grouped.map((group) => (
            <div key={group.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">{group.title}</p>
                <p className="text-xs text-slate-500">{group.description}</p>
              </div>
              <ul className="divide-y divide-slate-100">
                {group.templates.map((template) => (
                  <EventRow
                    key={template.id}
                    template={template}
                    rules={rules.filter((rule) => rule.eventKey === template.eventKey)}
                    canEdit={canEdit}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Recent emails</h2>
          <span className="text-xs text-slate-500">Last {logs.length} · times in your time zone</span>
        </div>
        {logs.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl border border-dashed bg-white p-6 text-sm text-slate-500">
            <Mail className="size-4" /> No emails have been triggered yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {logs.map((log) => {
              const style = STATUS_STYLE[log.status] ?? { label: log.status, className: "bg-slate-100 text-slate-600" };
              return (
                <li key={log.id} className="flex flex-col gap-1 px-4 py-3 @lg:flex-row @lg:items-center @lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{emailEventLabel(log.eventKey)}</p>
                    <p className="truncate text-xs text-slate-500">to {log.recipientEmail}</p>
                    {log.error && log.status !== "sent" ? (
                      <p className="mt-0.5 text-xs text-slate-500">{log.error.replace(/^attempts=\d+\|/, "")}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant="outline" className={cn("border-0", style.className)}>
                      {style.label}
                    </Badge>
                    <LocalTime iso={log.sentAt} className="text-xs text-slate-500" />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
