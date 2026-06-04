

export function CustomToggle({ isOn, onToggle }: { isOn: boolean, onToggle: () => void }) {
  return (
    <button 
      role="switch"
      aria-checked={isOn}
      onClick={onToggle}
      className={`w-[44px] h-[24px] rounded-[12px] relative transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:outline-none focus:outline-none focus:ring-2 focus:ring-navy/50 ${isOn ? 'bg-[#0F1E3C] dark:bg-[#4A7FA5]' : 'bg-[#E5E0D5] dark:bg-[#3A3F4B]'}`}
      aria-label="Toggle setting"
    >
      <div className={`w-[20px] h-[20px] bg-white rounded-full absolute top-[2px] transition-all duration-200 shadow-sm border border-black/15 ${isOn ? 'left-[22px]' : 'left-[2px]'}`} />
    </button>
  );
}
