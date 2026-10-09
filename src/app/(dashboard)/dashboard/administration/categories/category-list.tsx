"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SafeDeleteDialog } from "@/components/setup/safe-delete-dialog";
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
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/modules/categories/actions";
import type { CategoryFormState, CategorySummary } from "@/modules/categories/types";
import type { DocumentTypeOption } from "@/modules/assets/types";

const initialState: CategoryFormState = { error: null };

function CategoryFormFields({
  category,
  otherCategories,
  documentTypes,
}: {
  category?: CategorySummary;
  otherCategories: CategorySummary[];
  documentTypes: DocumentTypeOption[];
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={category?.name} required maxLength={200} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" defaultValue={category?.description ?? ""} maxLength={1000} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="parentCategoryId">Parent category</Label>
        <NativeSelect id="parentCategoryId" name="parentCategoryId" defaultValue={category?.parentCategoryId ?? ""}>
          <option value="">None</option>
          {otherCategories
            .filter((c) => c.id !== category?.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="codePrefix">Asset code prefix</Label>
        <Input id="codePrefix" name="codePrefix" defaultValue={category?.codePrefix ?? ""} required maxLength={12} placeholder="LAP" />
        <p className="text-xs text-slate-500">New assets in this category are numbered from this, such as LAP-00001.</p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked={category?.isActive ?? true} />
        Active
      </label>
      {documentTypes.length > 0 ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium">Required documents</legend>
          {documentTypes.map((type) => (
            <label key={type.key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="requiredDoc"
                value={type.key}
                defaultChecked={category?.requiredDocumentKeys.includes(type.key) ?? false}
              />
              {type.name}
            </label>
          ))}
        </fieldset>
      ) : null}
    </>
  );
}

function CreateCategoryDialog({
  categories,
  documentTypes,
}: {
  categories: CategorySummary[];
  documentTypes: DocumentTypeOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CategoryFormState>(initialState);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createCategoryAction(initialState, formData);
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
        <Button>New category</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <CategoryFormFields otherCategories={categories} documentTypes={documentTypes} />
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating..." : "Create category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCategoryDialog({
  category,
  categories,
  documentTypes,
  open,
  onOpenChange,
  usageCount,
}: {
  category: CategorySummary | null;
  categories: CategorySummary[];
  documentTypes: DocumentTypeOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  usageCount: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<CategoryFormState>(initialState);
  const [isSaving, startSave] = useTransition();

  if (!category) return null;

  function handleSave(formData: FormData) {
    startSave(async () => {
      const result = await updateCategoryAction(category!.id, initialState, formData);
      setState(result);
      if (!result.error) {
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category.name}</DialogTitle>
        </DialogHeader>
        <form action={handleSave} className="flex flex-col gap-4">
          <CategoryFormFields category={category} otherCategories={categories} documentTypes={documentTypes} />
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <DialogFooter className="items-center gap-2 sm:justify-between">
            <SafeDeleteDialog
              itemName={category.name}
              kind="category"
              usageCount={usageCount}
              options={categories.filter((other) => other.id !== category.id).map((other) => ({ id: other.id, name: other.name }))}
              noneLabel="Leave them uncategorized"
              onDelete={(replacementId) => deleteCategoryAction(category.id, replacementId)}
              onDeleted={() => {
                onOpenChange(false);
                router.refresh();
              }}
            />
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CategoryList({
  categories,
  documentTypes,
  usage,
}: {
  categories: CategorySummary[];
  documentTypes: DocumentTypeOption[];
  usage: Record<string, number>;
}) {
  const [selected, setSelected] = useState<CategorySummary | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <CreateCategoryDialog categories={categories} documentTypes={documentTypes} />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code prefix</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead className="text-right">Assets</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No categories yet.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((category) => (
                <TableRow
                  key={category.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelected(category);
                    setOpen(true);
                  }}
                >
                  <TableCell>
                    <span className="font-medium">{category.name}</span>
                    {category.description ? (
                      <span className="block max-w-xs truncate text-xs text-muted-foreground">{category.description}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {category.codePrefix ? `${category.codePrefix}-00001` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{category.parentCategoryName ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {(usage[category.id] ?? 0).toLocaleString("en-IN")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EditCategoryDialog
        category={selected}
        categories={categories}
        documentTypes={documentTypes}
        open={open}
        onOpenChange={setOpen}
        usageCount={selected ? (usage[selected.id] ?? 0) : 0}
      />
    </div>
  );
}
