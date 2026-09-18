import Link from "next/link";
import { LeadList } from "./lead-list";
import { NativeSelect } from "@/components/ui/native-select";
import { getLeadsForAdmin, getNewLeadCountForAdmin } from "@/modules/crm/actions";
import { LEAD_SOURCES, LEAD_STATUSES } from "@/modules/crm/types";

interface LeadsPageProps {
  searchParams: { source?: string; status?: string; page?: string };
}

export default async function AdminLeadsPage({ searchParams }: LeadsPageProps) {
  const source =
    searchParams.source === "demo" || searchParams.source === "inquire" ? searchParams.source : undefined;
  const status = LEAD_STATUSES.find((item) => item === searchParams.status);
  const page = Number.parseInt(searchParams.page ?? "1", 10);

  const [list, newCount] = await Promise.all([
    getLeadsForAdmin({
      source,
      status,
      page: Number.isFinite(page) && page > 0 ? page : 1,
    }),
    getNewLeadCountForAdmin(),
  ]);

  const totalPages = Math.max(1, Math.ceil(list.total / list.pageSize));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
        <p className="text-sm text-muted-foreground">
          {newCount} new · {list.total} total from demo bookings and inquiries
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-sm">
          Source
          <NativeSelect name="source" defaultValue={source ?? ""} className="w-40">
            <option value="">All</option>
            {LEAD_SOURCES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Status
          <NativeSelect name="status" defaultValue={status ?? ""} className="w-40">
            <option value="">All</option>
            {LEAD_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </NativeSelect>
        </label>
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-accent"
        >
          Filter
        </button>
      </form>

      <LeadList leads={list.leads} />

      {totalPages > 1 ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {list.page > 1 ? (
            <Link
              href={`/admin/leads?${new URLSearchParams({
                ...(source ? { source } : {}),
                ...(status ? { status } : {}),
                page: String(list.page - 1),
              }).toString()}`}
              className="underline-offset-4 hover:underline"
            >
              Previous
            </Link>
          ) : null}
          <span>
            Page {list.page} of {totalPages}
          </span>
          {list.page < totalPages ? (
            <Link
              href={`/admin/leads?${new URLSearchParams({
                ...(source ? { source } : {}),
                ...(status ? { status } : {}),
                page: String(list.page + 1),
              }).toString()}`}
              className="underline-offset-4 hover:underline"
            >
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
