"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { SortableList } from "@/components/setup/sortable-list";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createCategoryFieldAction,
  deleteCategoryFieldAction,
  reorderCategoryFieldsAction,
  updateCategoryFieldAction,
} from "@/modules/categories/actions";
import { CATEGORY_FIELD_TYPE_LABELS, CATEGORY_FIELD_TYPES } from "@/modules/categories/types";
import type {
  CategoryField,
  CategoryFieldFormState,
  CategoryFieldType,
  CategorySummary,
} from "@/modules/categories/types";

const initialState: CategoryFieldFormState = { error: null };
const FIELDS_PATH = "/dashboard/administration/fields";

function FieldDialog({
  field,
  categoryId,
  categoryName,
  nextSortOrder,
  canEdit,
  onOpenChange,
}: {
  field: CategoryField | null;
  categoryId: string;
  categoryName: string;
  nextSortOrder: number;
  canEdit: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<CategoryFieldFormState>(initialState);
  const [fieldType, setFieldType] = useState<CategoryFieldType>(field?.fieldType ?? "text");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  function handleSave(formData: FormData) {
    startSave(async () => {
      const result = field
        ? await updateCategoryFieldAction(field.id, initialState, formData)
        : await createCategoryFieldAction(initialState, formData);
      setState(result);
      if (!result.error) {
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!field) return;
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteCategoryFieldAction(field.id);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{field ? "Edit field" : `New field on ${categoryName}`}</DialogTitle>
        </DialogHeader>
        <form action={handleSave} className="flex flex-col gap-4">
          <input type="hidden" name="categoryId" value={categoryId} />
          <input type="hidden" name="sortOrder" value={field?.sortOrder ?? nextSortOrder} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="field-label">Label</Label>
            <Input id="field-label" name="label" defaultValue={field?.label} required maxLength={200} disabled={!canEdit} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="field-type">Type</Label>
            <NativeSelect
              id="field-type"
              name="fieldType"
              value={fieldType}
              onChange={(event) => setFieldType(event.target.value as CategoryFieldType)}
              disabled={!canEdit}
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
              <Label htmlFor="field-options">Dropdown options</Label>
              <Textarea
                id="field-options"
                name="options"
                defaultValue={field?.options.join("\n") ?? ""}
                rows={4}
                placeholder={"One option per line\nSmall\nMedium\nLarge"}
                disabled={!canEdit}
              />
            </div>
          ) : (
            <input type="hidden" name="options" value="" />
          )}
          <label className="flex items-start justify-between gap-4 text-sm">
            <span>
              <span className="font-medium text-slate-900">Required</span>
              <span className="block text-xs text-slate-500">Assets in {categoryName} can&apos;t be saved without it.</span>
            </span>
            <Switch name="required" value="true" defaultChecked={field?.required ?? false} disabled={!canEdit} />
          </label>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <DialogFooter className="items-center gap-2 sm:justify-between">
            {field && canEdit ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" className="text-destructive hover:text-destructive">
                    Remove field
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {field.label}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This field will no longer show on assets in {categoryName}. Existing values are kept but hidden
                      unless you add a field with the same name later.
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
            ) : (
              <span />
            )}
            {canEdit ? (
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : field ? "Save changes" : "Add field"}
              </Button>
            ) : null}
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
  fieldCounts,
  canEdit,
}: {
  categories: CategorySummary[];
  selected: CategorySummary | null;
  fields: CategoryField[];
  fieldCounts: Record<string, number>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CategoryField | null>(null);
  const [creating, setCreating] = useState(false);
  const nextSortOrder = fields.reduce((max, field) => Math.max(max, field.sortOrder), -1) + 1;

  if (!selected) {
    return null;
  }

  const openCategory = (id: string) => router.push(`${FIELDS_PATH}?category=${id}`);

  return (
    <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <div className="lg:hidden">
        <Label htmlFor="field-category" className="sr-only">
          Category
        </Label>
        <NativeSelect id="field-category" value={selected.id} onChange={(event) => openCategory(event.target.value)}>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} ({fieldCounts[category.id] ?? 0})
            </option>
          ))}
        </NativeSelect>
      </div>
      <nav className="hidden flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 lg:flex" aria-label="Categories">
        <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Categories</p>
        {categories.map((category) => {
          const active = category.id === selected.id;
          const count = fieldCounts[category.id] ?? 0;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => openCategory(category.id)}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm",
                active ? "bg-primary/10 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50",
              )}
            >
              <span className="truncate">{category.name}</span>
              <span className={cn("text-xs", count > 0 ? "text-slate-500" : "text-slate-300")}>{count}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{selected.name}</h2>
            <p className="text-sm text-slate-500">
              {canEdit
                ? "Shown on assets in this category. Drag or use the arrows to set their order."
                : "Shown on assets in this category, in this order."}
            </p>
          </div>
          {canEdit ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New field
            </Button>
          ) : null}
        </div>

        {fields.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-white p-6 text-center text-sm text-slate-500">
            No extra fields on {selected.name} yet.
          </p>
        ) : (
          <SortableList
            items={fields}
            canEdit={canEdit}
            onReorder={(ids) => reorderCategoryFieldsAction(selected.id, ids)}
            renderItem={(field) => (
              <button type="button" onClick={() => setEditing(field)} className="flex w-full flex-wrap items-center gap-2 text-left">
                <span className="font-medium text-slate-900">{field.label}</span>
                <Badge variant="secondary" className="text-[10px]">
                  {CATEGORY_FIELD_TYPE_LABELS[field.fieldType]}
                </Badge>
                {field.required ? <span className="text-xs text-slate-500">Required</span> : null}
                {field.fieldType === "select" && field.options.length > 0 ? (
                  <span className="max-w-[16rem] truncate text-xs text-slate-400">{field.options.join(", ")}</span>
                ) : null}
                <Pencil className="ml-auto size-3.5 text-slate-300" />
              </button>
            )}
          />
        )}
      </div>

      {editing ? (
        <FieldDialog
          key={editing.id}
          field={editing}
          categoryId={selected.id}
          categoryName={selected.name}
          nextSortOrder={nextSortOrder}
          canEdit={canEdit}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}
      {creating ? (
        <FieldDialog
          field={null}
          categoryId={selected.id}
          categoryName={selected.name}
          nextSortOrder={nextSortOrder}
          canEdit={canEdit}
          onOpenChange={setCreating}
        />
      ) : null}
    </div>
  );
}
