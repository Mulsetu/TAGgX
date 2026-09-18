"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createLocationAction,
  deleteLocationAction,
  updateLocationAction,
} from "@/modules/locations/actions";
import {
  LOCATION_KIND_LABELS,
  LOCATION_KIND_PARENT,
  LOCATION_KINDS,
  isLocationKind,
  type LocationFormState,
  type LocationKind,
  type LocationSummary,
} from "@/modules/locations/types";

const initialState: LocationFormState = { error: null };

function LocationFormFields({
  location,
  locations,
}: {
  location?: LocationSummary;
  locations: LocationSummary[];
}) {
  const [kind, setKind] = useState<LocationKind>(location?.kind ?? "site");
  const requiredParent = LOCATION_KIND_PARENT[kind];
  const parentOptions = useMemo(
    () =>
      locations.filter(
        (entry) => entry.kind === requiredParent && entry.id !== location?.id,
      ),
    [locations, requiredParent, location?.id],
  );
  const showAddress = kind === "site" || kind === "building";

  return (
    <>
      <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kind">Level</Label>
          <NativeSelect
            id="kind"
            name="kind"
            value={kind}
            onChange={(event) => {
              if (isLocationKind(event.target.value)) {
                setKind(event.target.value);
              }
            }}
          >
            {LOCATION_KINDS.map((entry) => (
              <option key={entry} value={entry}>
                {LOCATION_KIND_LABELS[entry]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={location?.name} required maxLength={200} />
        </div>
      </div>
      {requiredParent ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="parentLocationId">Parent {LOCATION_KIND_LABELS[requiredParent].toLowerCase()}</Label>
          <NativeSelect
            key={kind}
            id="parentLocationId"
            name="parentLocationId"
            defaultValue={location?.parentLocationId ?? ""}
            required
          >
            <option value="">Select {LOCATION_KIND_LABELS[requiredParent].toLowerCase()}</option>
            {parentOptions.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.path}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : (
        <input type="hidden" name="parentLocationId" value="" />
      )}
      {showAddress ? (
        <>
          <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="addressLine1">Address line 1</Label>
              <Input
                id="addressLine1"
                name="addressLine1"
                defaultValue={location?.addressLine1 ?? ""}
                maxLength={200}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="addressLine2">Address line 2</Label>
              <Input
                id="addressLine2"
                name="addressLine2"
                defaultValue={location?.addressLine2 ?? ""}
                maxLength={200}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={location?.city ?? ""} maxLength={100} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" defaultValue={location?.state ?? ""} maxLength={100} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" name="postalCode" defaultValue={location?.postalCode ?? ""} maxLength={20} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" defaultValue={location?.country ?? ""} maxLength={100} />
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function CreateLocationDialog({ locations }: { locations: LocationSummary[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LocationFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createLocationAction(initialState, formData);
      setState(result);
      if (!result.error) {
        setOpen(false);
        setState(initialState);
        router.refresh();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setState(initialState);
      }}
    >
      <DialogTrigger asChild>
        <Button>New location</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New location</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <LocationFormFields locations={locations} />
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditLocationDialog({
  location,
  locations,
  open,
  onOpenChange,
}: {
  location: LocationSummary | null;
  locations: LocationSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<LocationFormState>(initialState);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  if (!location) return null;

  function handleSave(formData: FormData) {
    startSave(async () => {
      const result = await updateLocationAction(location!.id, initialState, formData);
      setState(result);
      if (!result.error) {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteLocationAction(location!.id);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{location.path}</DialogTitle>
        </DialogHeader>
        <form action={handleSave} className="flex flex-col gap-4">
          <LocationFormFields key={location.id} location={location} locations={locations} />
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <DialogFooter className="items-center sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm">
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {location.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Nested locations must be removed first. Assets here become unassigned. Past
                    movement history keeps this name.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {deleteError}
                  </p>
                ) : null}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(event) => {
                      event.preventDefault();
                      handleDelete();
                    }}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function LocationList({ locations }: { locations: LocationSummary[] }) {
  const [selected, setSelected] = useState<LocationSummary | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <CreateLocationDialog locations={locations} />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Location</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>City</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No locations yet. Start with a site, then add buildings, floors, and rooms.
                </TableCell>
              </TableRow>
            ) : (
              locations.map((location) => (
                <TableRow
                  key={location.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelected(location);
                    setOpen(true);
                  }}
                >
                  <TableCell>
                    <span style={{ paddingLeft: location.depth * 16 }} className="font-medium">
                      {location.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{LOCATION_KIND_LABELS[location.kind]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{location.city ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EditLocationDialog location={selected} locations={locations} open={open} onOpenChange={setOpen} />
    </div>
  );
}
