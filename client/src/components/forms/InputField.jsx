export default function InputField({
  label, name, register, error,
  type = 'text', placeholder, required, ...rest
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={name} className="text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        id={name}
        type={type}
        placeholder={placeholder}
        className={`input-field ${error ? 'border-red-400 focus:ring-red-400' : ''}`}
        {...(register ? register(name) : {})}
        {...rest}
      />
      {error && <p className="text-xs text-red-500 mt-0.5">{error.message}</p>}
    </div>
  );
}
