/** Red asterisk after a required field's label; screen readers hear "required" instead of "star". */
export function RequiredMark() {
  return (
    <>
      <span aria-hidden="true" className="ml-0.5 text-destructive">
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  );
}
