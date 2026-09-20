"use client";

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/assets/image-upload-field";
import { createAssetAction, updateAssetAction } from "@/modules/assets/actions";
import { ASSET_CONDITIONS } from "@/modules/assets/types";
import type { Asset, AssetFormOptions, AssetFormState, OwnershipType } from "@/modules/assets/types";
import type { CategoryField, CustomFieldValue } from "@/modules/categories/types";

const initialState: AssetFormState = { error: null };

function formatEnumLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function FormSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
      <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left text-sm font-medium">
        {title}
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 border-t p-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function storedFieldValue(value: CustomFieldValue | undefined): string {
  if (value === undefined) {
    return "";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

function CategoryCheckboxField({
  field,
  defaultChecked,
}: {
  field: CategoryField;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name={`customField.${field.key}`} value={checked ? "true" : "false"} />
      <input
        id={`custom_${field.key}`}
        type="checkbox"
        checked={checked}
        onChange={(event) => setChecked(event.target.checked)}
        className="size-4 rounded border"
      />
      <Label htmlFor={`custom_${field.key}`} className="font-normal">
        {field.label}
        {field.required ? " *" : ""}
      </Label>
    </div>
  );
}

function CategoryFieldsSection({
  fields,
  values,
  fieldErrors,
}: {
  fields: CategoryField[];
  values: Record<string, CustomFieldValue>;
  fieldErrors: Record<string, string>;
}) {
  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <p className="text-sm font-medium">Category fields</p>
      {fields.map((field) => {
        const errorKey = `custom_${field.key}`;
        const error = fieldErrors[errorKey];
        const defaultValue = storedFieldValue(values[field.key]);

        if (field.fieldType === "checkbox") {
          return (
            <div key={field.id} className="flex flex-col gap-1">
              <CategoryCheckboxField field={field} defaultChecked={values[field.key] === true} />
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>
          );
        }

        return (
          <Field
            key={field.id}
            label={`${field.label}${field.required ? " *" : ""}`}
            htmlFor={`custom_${field.key}`}
            error={error}
          >
            {field.fieldType === "select" ? (
              <NativeSelect
                id={`custom_${field.key}`}
                name={`customField.${field.key}`}
                defaultValue={defaultValue}
                required={field.required}
              >
                <option value="">{field.required ? "Select…" : "Not set"}</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </NativeSelect>
            ) : field.fieldType === "number" ? (
              <Input
                id={`custom_${field.key}`}
                name={`customField.${field.key}`}
                type="number"
                step="any"
                defaultValue={defaultValue}
                required={field.required}
              />
            ) : field.fieldType === "date" ? (
              <Input
                id={`custom_${field.key}`}
                name={`customField.${field.key}`}
                type="date"
                defaultValue={defaultValue}
                required={field.required}
              />
            ) : (
              <Input
                id={`custom_${field.key}`}
                name={`customField.${field.key}`}
                defaultValue={defaultValue}
                required={field.required}
                maxLength={2000}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}

interface AssetFormProps {
  mode: "create" | "edit";
  asset?: Asset;
  options: AssetFormOptions;
}

export function AssetForm({ mode, asset, options }: AssetFormProps) {
  const [state, setState] = useState<AssetFormState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [autoGenerateCode, setAutoGenerateCode] = useState(mode === "create");
  const [ownershipType, setOwnershipType] = useState<OwnershipType>(asset?.ownershipType ?? "owned");
  const [categoryId, setCategoryId] = useState(asset?.categoryId ?? "");

  const fieldErrors = state?.fieldErrors ?? {};
  const categoryFields = options.categoryFields.filter((field) => field.categoryId === categoryId);

  function handleSubmit(formData: FormData) {
    formData.set("ownershipType", ownershipType);

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createAssetAction(initialState, formData)
          : await updateAssetAction(asset!.id, initialState, formData);
      // On success both actions call redirect(), which throws to trigger
      // navigation rather than returning — result is undefined in that
      // case (navigation is already underway), so only update state when
      // there's actually an error to show.
      if (result) {
        setState(result);
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex max-w-2xl flex-col gap-6">
      {/* Basic Info — always expanded */}
      <div className="flex flex-col gap-4 rounded-lg border p-4">
        <p className="text-sm font-medium">Basic Info</p>

        <Field label="Name *" htmlFor="name" error={fieldErrors.name}>
          <Input id="name" name="name" defaultValue={asset?.name} required maxLength={200} />
        </Field>

        <ImageUploadField defaultValue={asset?.imageUrl} />

        {mode === "create" ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="autoGenerateCode"
                checked={autoGenerateCode}
                onCheckedChange={(checked) => setAutoGenerateCode(checked === true)}
              />
              <Label htmlFor="autoGenerateCode" className="font-normal">
                Auto-generate code
              </Label>
            </div>
            {!autoGenerateCode ? (
              <Field label="Code *" htmlFor="assetCode" error={fieldErrors.assetCode}>
                <Input id="assetCode" name="assetCode" required maxLength={100} placeholder="e.g. AST-00001" />
              </Field>
            ) : null}
          </div>
        ) : (
          <Field label="Code *" htmlFor="assetCode" error={fieldErrors.assetCode}>
            <Input id="assetCode" name="assetCode" defaultValue={asset?.assetCode} required maxLength={100} />
          </Field>
        )}

        <Field label="Category *" htmlFor="categoryId" error={fieldErrors.categoryId}>
          <NativeSelect
            id="categoryId"
            name="categoryId"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            required
          >
            <option value="" disabled>
              Select a category
            </option>
            {options.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="Location *" htmlFor="locationId" error={fieldErrors.locationId}>
          <NativeSelect id="locationId" name="locationId" defaultValue={asset?.locationId ?? ""} required>
            <option value="" disabled>
              Select a location
            </option>
            {options.locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="CWIP Invoice ID" htmlFor="cwipInvoiceId">
          <Input id="cwipInvoiceId" name="cwipInvoiceId" defaultValue={asset?.cwipInvoiceId ?? ""} maxLength={100} />
        </Field>

        <Field label="Status *" htmlFor="statusId" error={fieldErrors.statusId}>
          <NativeSelect
            id="statusId"
            name="statusId"
            defaultValue={asset?.statusId ?? options.statuses[0]?.id ?? ""}
            required
          >
            <option value="" disabled>
              Select a status
            </option>
            {options.statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <CategoryFieldsSection
        key={categoryId}
        fields={categoryFields}
        values={asset?.customFields ?? {}}
        fieldErrors={fieldErrors}
      />

      {/* Additional Info — collapsed by default */}
      <FormSection title="Additional Info" defaultOpen={false}>
        <Field label="Condition" htmlFor="condition">
          <NativeSelect id="condition" name="condition" defaultValue={asset?.condition ?? ""}>
            <option value="">Not set</option>
            {ASSET_CONDITIONS.map((condition) => (
              <option key={condition} value={condition}>
                {formatEnumLabel(condition)}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="Brand" htmlFor="brand">
          <Input id="brand" name="brand" defaultValue={asset?.brand ?? ""} maxLength={200} />
        </Field>

        <Field label="Model" htmlFor="model">
          <Input id="model" name="model" defaultValue={asset?.model ?? ""} maxLength={200} />
        </Field>

        <Field label="Linked Asset" htmlFor="linkedAssetId" error={fieldErrors.linkedAssetId}>
          <NativeSelect id="linkedAssetId" name="linkedAssetId" defaultValue={asset?.linkedAssetId ?? ""}>
            <option value="">None</option>
            {options.linkableAssets.map((linkable) => (
              <option key={linkable.id} value={linkable.id}>
                {linkable.name}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="Description" htmlFor="description">
          <Textarea
            id="description"
            name="description"
            defaultValue={asset?.description ?? ""}
            maxLength={2000}
            rows={3}
          />
        </Field>

        <Field label="Serial No." htmlFor="serialNumber">
          <Input id="serialNumber" name="serialNumber" defaultValue={asset?.serialNumber ?? ""} maxLength={200} />
        </Field>

        {mode === "create" ? (
          <p className="text-xs text-muted-foreground">
            Attachments can be added once this asset is saved — see the Attachments section
            below after creating it.
          </p>
        ) : null}
      </FormSection>

      {/* Purchase Info — collapsed by default */}
      <FormSection title="Purchase Info" defaultOpen={false}>
        <Field label="Vendor" htmlFor="vendor">
          <Input id="vendor" name="vendor" defaultValue={asset?.vendor ?? ""} maxLength={200} />
        </Field>

        <Field label="PO Number" htmlFor="poNumber">
          <Input id="poNumber" name="poNumber" defaultValue={asset?.poNumber ?? ""} maxLength={100} />
        </Field>

        <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2">
          <Field label="Invoice Date" htmlFor="invoiceDate">
            <Input id="invoiceDate" name="invoiceDate" type="date" defaultValue={asset?.invoiceDate ?? ""} />
          </Field>
          <Field label="Invoice Number" htmlFor="invoiceNumber">
            <Input
              id="invoiceNumber"
              name="invoiceNumber"
              defaultValue={asset?.invoiceNumber ?? ""}
              maxLength={100}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2">
          <Field label="Purchase Date" htmlFor="purchaseDate">
            <Input id="purchaseDate" name="purchaseDate" type="date" defaultValue={asset?.purchaseDate ?? ""} />
          </Field>
          <Field label="Purchase Price" htmlFor="purchasePrice">
            <Input
              id="purchasePrice"
              name="purchasePrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={asset?.purchasePrice ?? ""}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Switch
              id="ownershipTypeToggle"
              checked={ownershipType === "partner"}
              onCheckedChange={(checked) => setOwnershipType(checked ? "partner" : "owned")}
            />
            <Label htmlFor="ownershipTypeToggle" className="font-normal">
              {ownershipType === "partner" ? "Partner-owned" : "Owned"}
            </Label>
          </div>
          {ownershipType === "partner" ? (
            <Field label="Partner Name *" htmlFor="partnerName" error={fieldErrors.partnerName}>
              <Input
                id="partnerName"
                name="partnerName"
                defaultValue={asset?.partnerName ?? ""}
                maxLength={200}
                required
              />
            </Field>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 rounded-md border p-3">
          <p className="text-xs font-medium text-muted-foreground">Allotment</p>
          <Field label="Allotted To" htmlFor="allottedTo" error={fieldErrors.allottedTo}>
            <NativeSelect id="allottedTo" name="allottedTo" defaultValue={asset?.allottedTo ?? ""}>
              <option value="">Unassigned</option>
              {options.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Allotment Date" htmlFor="allotmentDate">
            <Input id="allotmentDate" name="allotmentDate" type="date" defaultValue={asset?.allotmentDate ?? ""} />
          </Field>
        </div>

        <div className="flex flex-col gap-4 rounded-md border p-3">
          <p className="text-xs font-medium text-muted-foreground">Warranty / AMC / Insurance</p>
          <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2">
            <Field label="Warranty Start" htmlFor="warrantyStartDate">
              <Input
                id="warrantyStartDate"
                name="warrantyStartDate"
                type="date"
                defaultValue={asset?.warrantyStartDate ?? ""}
              />
            </Field>
            <Field label="Warranty End" htmlFor="warrantyEndDate">
              <Input
                id="warrantyEndDate"
                name="warrantyEndDate"
                type="date"
                defaultValue={asset?.warrantyEndDate ?? ""}
              />
            </Field>
          </div>
          <Field label="AMC Provider" htmlFor="amcProvider">
            <Input id="amcProvider" name="amcProvider" defaultValue={asset?.amcProvider ?? ""} maxLength={200} />
          </Field>
          <div className="grid grid-cols-1 gap-4 @sm:grid-cols-2">
            <Field label="AMC Start" htmlFor="amcStartDate">
              <Input id="amcStartDate" name="amcStartDate" type="date" defaultValue={asset?.amcStartDate ?? ""} />
            </Field>
            <Field label="AMC End" htmlFor="amcEndDate">
              <Input id="amcEndDate" name="amcEndDate" type="date" defaultValue={asset?.amcEndDate ?? ""} />
            </Field>
          </div>
          <Field label="Insurance Provider" htmlFor="insuranceProvider">
            <Input
              id="insuranceProvider"
              name="insuranceProvider"
              defaultValue={asset?.insuranceProvider ?? ""}
              maxLength={200}
            />
          </Field>
          <Field label="Insurance Policy Number" htmlFor="insurancePolicyNumber">
            <Input
              id="insurancePolicyNumber"
              name="insurancePolicyNumber"
              defaultValue={asset?.insurancePolicyNumber ?? ""}
              maxLength={200}
            />
          </Field>
          <Field label="Insurance Expiry" htmlFor="insuranceExpiryDate">
            <Input
              id="insuranceExpiryDate"
              name="insuranceExpiryDate"
              type="date"
              defaultValue={asset?.insuranceExpiryDate ?? ""}
            />
          </Field>
        </div>
      </FormSection>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? "Saving..." : mode === "create" ? "Create asset" : "Save changes"}
      </Button>
    </form>
  );
}
