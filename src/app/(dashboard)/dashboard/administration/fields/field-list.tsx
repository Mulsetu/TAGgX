"use client";

import { useState, useTransition } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  createCategoryFieldAction,
  deleteCategoryFieldAction,
  updateCategoryFieldAction,
} from "@/modules/categories/actions";
import {
  CATEGORY_FIELD_TYPE_LABELS,
  CATEGORY_FIELD_TYPES,
} from "@/modules/categories/types";
import type {
  CategoryField,
  CategoryFieldFormState,
  CategoryFieldType,
  CategorySummary,
} from "@/modules/categories/types";

const initialState: CategoryFieldFormState = { error: null };

function FieldFormFields({
  field,
  categoryId,
  nextSortOrder,
}: {
  field?: CategoryField;
  categoryId: string;
  nextSortOrder: number;
}) {
  const [fieldType, setFieldType] = useState<CategoryFieldType>(field?.fieldType ?? "text");

  return (
    <>
      <input type="hidden" name="categoryId" value={categoryId} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="label">Label</Label>
        <Input id="label" name="label" defaultValue={field?.label} required maxLength={200} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fieldType">Type</Label>
        <NativeSelect
          id="fieldType"
          name="fieldType"
          value={fieldType}
          onChange={(event) => setFieldType(event.target.value as CategoryFieldType)}
        >
          {CATEGORY_FIELD_TYPES.map((type) => (
            <option key={type} value={type}>
              {CATEGORY_FIELD_TYPE_LABELS[type]}
            </option>
          ))}
        </NativeSelect>
      </div>
      {fieldType === "select" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="options">Dropdown options</Label>
          <Textarea
            id="options"
            name="options"
            defaultValue={field?.options.join("\n") ?? ""}
            rows={4}
            placeholder={"One option per line\nSmall\nMedium\nLarge"}
          />
        </div>
      ) : (
        <input type="hidden" name="options" value="" />
      )}
      <div className="flex items-center gap-2">
        <input
          id="required"
          name="required"
          type="checkbox"
          value="true"
          defaultChecked={field?.required}
          className="size-4 rounded border"
        />
        <Label htmlFor="required" className="font-normal">
          Required
        </Label>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sortOrder">Sort order</Label>
        <Input
          id="sortOrder"
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={field?.sortOrder ?? nextSortOrder}
          required
        />
      </div>
    </>
  );
}

function CreateFieldDialog({ categoryId, nextSortOrder }: { categoryId: string; nextSortOrder: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CategoryFieldFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createCategoryFieldAction(initialState, formData);
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
        <Button>Add field</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New field</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <FieldFormFields key={open ? "new" : "closed"} categoryId={categoryId} nextSortOrder={nextSortOrder} />
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding..." : "Add field"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditFieldDialog({
  field,
  categoryId,
  open,
  onOpenChange,
}: {
  field: CategoryField | null;
  categoryId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<CategoryFieldFormState>(initialState);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  if (!field) return null;

  function handleSave(formData: FormData) {
    startSave(async () => {
      const result = await updateCategoryFieldAction(field!.id, initialState, formData);
      setState(result);
      if (!result.error) {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteCategoryFieldAction(field!.id);
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
          <DialogTitle>{field.label}</DialogTitle>
        </DialogHeader>
        <form action={handleSave} className="flex flex-col gap-4">
          <FieldFormFields key={field.id} field={field} categoryId={categoryId} nextSortOrder={field.sortOrder} />
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <DialogFooter className="items-center sm:justify-between">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" size="sm">
                  Remove
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove {field.label}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This field will no longer show on assets in this category. Existing values are kept
                    but hidden unless you add a field with the same name later.
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
                    {isDeleting ? "Removing..." : "Remove"}
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

export function CategoryFieldList({
  categories,
  selected,
  fields,
}: {
  categories: CategorySummary[];
  selected: CategorySummary | null;
  fields: CategoryField[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CategoryField | null>(null);
  const [open, setOpen] = useState(false);
  const nextSortOrder = fields.reduce((max, field) => Math.max(max, field.sortOrder), -1) + 1;

  if (!selected) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex max-w-sm flex-col gap-1.5">
          <Label htmlFor="category">Category</Label>
          <NativeSelect
            id="category"
            value={selected.id}
            onChange={(event) => router.push(`/dashboard/administration/fields?category=${event.target.value}`)}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <CreateFieldDialog categoryId={selected.id} nextSortOrder={nextSortOrder} />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Required</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No extra fields on {selected.name} yet.
                </TableCell>
              </TableRow>
            ) : (
              fields.map((field) => (
                <TableRow
                  key={field.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setEditing(field);
                    setOpen(true);
                  }}
                >
                  <TableCell className="font-medium">{field.label}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {CATEGORY_FIELD_TYPE_LABELS[field.fieldType]}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{field.required ? "Yes" : "No"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EditFieldDialog field={editing} categoryId={selected.id} open={open} onOpenChange={setOpen} />
    </div>
  );
}
