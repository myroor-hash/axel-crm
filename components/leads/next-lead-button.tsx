type NextLeadButtonProps = {
  onClick: () => void;
};

export function NextLeadButton({ onClick }: NextLeadButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.98]"
    >
      Call Next Lead
    </button>
  );
}
