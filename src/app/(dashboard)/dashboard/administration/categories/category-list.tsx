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
        <Input id="codePrefix" name="codePrefix" defaultValue={category?.codePrefix ?? ""} maxLength={12} placeholder="LAP" />
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
}: {
  category: CategorySummary | null;
  categories: CategorySummary[];
  documentTypes: DocumentTypeOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<CategoryFormState>(initialState);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();

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

  function handleDelete() {
    setDeleteError(null);
    startDelete(async () => {
      const result = await deleteCategoryAction(category!.id);
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
          <DialogTitle>{category.name}</DialogTitle>
        </DialogHeader>
        <form action={handleSave} className="flex flex-col gap-4">
          <CategoryFormFields category={category} otherCategories={categories} documentTypes={documentTypes} />
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
                  <AlertDialogTitle>Delete {category.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Assets in this category will become uncategorized. This can&apos;t be undone.
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
                    onClick={(e) => {
                      e.preventDefault();
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

export function CategoryList({
  categories,
  documentTypes,
}: {
  categories: CategorySummary[];
  documentTypes: DocumentTypeOption[];
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
              <TableHead>Parent</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
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
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-muted-foreground">{category.parentCategoryName ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{category.description ?? "—"}</TableCell>
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
      />
    </div>
  );
}
