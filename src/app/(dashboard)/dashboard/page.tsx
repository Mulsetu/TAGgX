import { SimpleBarChart } from "@/components/charts/simple-bar-chart";
import { requireModule } from "@/lib/permissions/features";
import { requirePermission } from "@/lib/permissions/has-permission";
import { getDashboardHome } from "@/modules/reports/actions";
import { getVendorScope } from "@/modules/users/actions";
import Link from "next/link";
import { redirect } from "next/navigation";

function widgetSpan(size: "sm" | "md" | "lg"): string {
  if (size === "lg") {
    return "col-span-2 @lg:col-span-4";
  }
  if (size === "md") {
    return "col-span-2";
  }
  return "col-span-1";
}

export default async function DashboardPage() {
  const vendorId = await getVendorScope();
  if (vendorId) {
    if ((await requireModule("maintenance")) && (await requirePermission("maintenance", "view"))) {
      redirect("/dashboard/administration/maintenance");
    }
    if (await requirePermission("assets", "view")) {
      redirect("/assets");
    }
  }

  const widgets = await getDashboardHome();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Company overview for the widgets you can access.</p>
      </div>
      {widgets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No dashboard widgets are available for your role.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 @lg:grid-cols-4">
          {widgets.map((widget) =>
            widget.kind === "chart" ? (
              <div key={widget.id} className={`rounded-lg border p-4 ${widgetSpan(widget.size)}`}>
                <p className="mb-2 text-sm font-medium">{widget.label}</p>
                {widget.chart.length === 0 ? (
                  <p className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
                    No data yet
                  </p>
                ) : (
                  <SimpleBarChart data={widget.chart} />
                )}
              </div>
            ) : (
              <Link
                key={widget.id}
                href={widget.href}
                className={`rounded-lg border p-4 hover:bg-muted/40 ${widgetSpan(widget.size)}`}
              >
                <p className="text-xs text-muted-foreground">{widget.label}</p>
                <p className="text-2xl font-semibold tracking-tight">{widget.value}</p>
              </Link>
            ),
          )}
        </div>
      )}
    </div>
  );
}
