import { getLocationsForAdmin } from "@/modules/locations/actions";
import { LocationList } from "./location-list";

export default async function LocationsPage() {
  const locations = await getLocationsForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
        <p className="text-sm text-muted-foreground">
          Company → Site → Building → Floor → Room / Zone. Click a row to edit.
        </p>
      </div>

      <LocationList locations={locations} />
    </div>
  );
}
