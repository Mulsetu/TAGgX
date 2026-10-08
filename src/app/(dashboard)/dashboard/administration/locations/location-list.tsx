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
  childKindFor,
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
        <details className="rounded-lg border border-slate-200 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Address</summary>
          <div className="mt-3 flex flex-col gap-3">
            <Input name="addressLine1" defaultValue={location?.addressLine1 ?? ""} maxLength={200} placeholder="Address line 1" aria-label="Address line 1" />
            <Input name="addressLine2" defaultValue={location?.addressLine2 ?? ""} maxLength={200} placeholder="Address line 2" aria-label="Address line 2" />
            <div className="grid grid-cols-2 gap-3">
              <Input name="city" defaultValue={location?.city ?? ""} maxLength={100} placeholder="City" aria-label="City" />
              <Input name="state" defaultValue={location?.state ?? ""} maxLength={100} placeholder="State" aria-label="State" />
              <Input name="postalCode" defaultValue={location?.postalCode ?? ""} maxLength={20} placeholder="Postal code" aria-label="Postal code" />
              <Input name="country" defaultValue={location?.country ?? ""} maxLength={100} placeholder="Country" aria-label="Country" />
            </div>
          </div>
        </details>
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

function LocationDialog({
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
  const [childState, setChildState] = useState<LocationFormState>(initialState);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [isSaving, startSave] = useTransition();
  const [isAdding, startAdd] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  if (!location) return null;

  const current = locations.find((entry) => entry.id === location.id) ?? location;
  const children = locations.filter((entry) => entry.parentLocationId === current.id);
  const nextKind = childKindFor(current.kind);
  const address = [current.addressLine1, current.city, current.state].filter(Boolean).join(", ");

  function handleSave(formData: FormData) {
    startSave(async () => {
      const result = await updateLocationAction(current.id, initialState, formData);
      setState(result);
      if (!result.error) {
        router.refresh();
      }
    });
  }

  function handleAddChild(formData: FormData) {
    startAdd(async () => {
      const result = await createLocationAction(initialState, formData);
      setChildState(result);
      if (!result.error) {
        setAdding(false);
        setChildState(initialState);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteLocationAction(current.id);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setAdding(false);
          setState(initialState);
          setChildState(initialState);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="bg-white text-slate-900">
        <DialogHeader>
          <DialogTitle>{current.name}</DialogTitle>
          <p className="text-sm text-slate-500">
            {LOCATION_KIND_LABELS[current.kind]}
            {current.parentLocationName ? ` · inside ${current.parentLocationName}` : ""}
          </p>
        </DialogHeader>

        <div className="rounded-xl border border-slate-200 p-3">
          <p className="text-sm font-medium text-slate-800">
            {children.length === 0 ? "No child locations" : `${children.length} child location${children.length === 1 ? "" : "s"}`}
          </p>
          {children.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1 text-sm text-slate-600">
              {children.map((child) => (
                <li key={child.id}>
                  {child.name}
                  <span className="text-slate-400"> · {LOCATION_KIND_LABELS[child.kind]}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {nextKind ? (
            adding ? (
              <form action={handleAddChild} className="mt-3 flex flex-col gap-2">
                <input type="hidden" name="kind" value={nextKind} />
                <input type="hidden" name="parentLocationId" value={current.id} />
                <Input name="name" required maxLength={200} placeholder={`${LOCATION_KIND_LABELS[nextKind]} name`} autoFocus />
                {childState.error ? <p className="text-sm text-destructive">{childState.error}</p> : null}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={isAdding}>
                    {isAdding ? "Adding..." : `Add ${LOCATION_KIND_LABELS[nextKind].toLowerCase()}`}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button type="button" size="sm" className="mt-3" onClick={() => setAdding(true)}>
                Add {LOCATION_KIND_LABELS[nextKind].toLowerCase()}
              </Button>
            )
          ) : (
            <p className="mt-1 text-xs text-slate-500">This is the last level. Nothing nests under a room.</p>
          )}
        </div>

        <form action={handleSave} className="flex flex-col gap-3">
          <input type="hidden" name="kind" value={current.kind} />
          <input type="hidden" name="parentLocationId" value={current.parentLocationId ?? ""} />
          <input type="hidden" name="addressLine1" value={current.addressLine1 ?? ""} />
          <input type="hidden" name="addressLine2" value={current.addressLine2 ?? ""} />
          <input type="hidden" name="city" value={current.city ?? ""} />
          <input type="hidden" name="state" value={current.state ?? ""} />
          <input type="hidden" name="postalCode" value={current.postalCode ?? ""} />
          <input type="hidden" name="country" value={current.country ?? ""} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="location-name">Name</Label>
            <Input id="location-name" name="name" required maxLength={200} defaultValue={current.name} />
          </div>
          {address ? <p className="text-xs text-slate-500">{address}</p> : null}
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter className="items-center sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm">
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-white text-slate-900">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {current.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {children.length > 0
                      ? "Remove its child locations first."
                      : "Assets here become unassigned. Past movement history keeps this name."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(event) => {
                      event.preventDefault();
                      handleDelete();
                    }}
                    disabled={isDeleting || children.length > 0}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save name"}
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
              <TableHead>Children</TableHead>
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
                  <TableCell className="text-slate-500">
                    {location.childCount === 0 ? "None" : location.childCount}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <LocationDialog location={selected} locations={locations} open={open} onOpenChange={setOpen} />
    </div>
  );
}
