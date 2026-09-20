import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCompaniesForAdmin } from "@/modules/companies/actions";
import { getStorageUsageForAdmin } from "@/modules/storage/actions";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  // exponent is clamped to [0, units.length - 1] above, so this index is
  // always in range — not user-controlled key access.
  // eslint-disable-next-line security/detect-object-injection
  const unit = units[exponent];
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${unit}`;
}

export default async function AdminStoragePage() {
  const [companies, usage] = await Promise.all([listCompaniesForAdmin(), getStorageUsageForAdmin()]);
  const usageByCompanyId = new Map(usage.map((entry) => [entry.companyId, entry.totalBytes]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Storage usage</h1>
        <p className="text-sm text-muted-foreground">
          Usage is measured from objects currently in each company&apos;s
          storage bucket, so deletions show up here as soon as this page is
          refreshed.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Storage used</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No companies yet.
                </TableCell>
              </TableRow>
            ) : (
              companies.map((company) => {
                const bytes = usageByCompanyId.get(company.id);
                return (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell className="text-muted-foreground">{company.slug}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {bytes === undefined ? "Unknown" : formatBytes(bytes)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
