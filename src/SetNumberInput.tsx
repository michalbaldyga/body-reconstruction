import { type InputHTMLAttributes } from "react";
export function SetNumberInput({
  value,
  onValueChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <input
      {...props}
      value={value === 0 ? "" : value}
      onChange={(event) => {
        const text = event.target.value;
        onValueChange(Number(text));
      }}
    />
  );
}
