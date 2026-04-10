interface ProgressBarProps {
  currentStep: number
  totalSteps: number
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const percent = ((currentStep - 1) / (totalSteps - 1)) * 100

  return (
    <div className="w-full h-px bg-white/10 relative">
      <div
        className="absolute top-0 left-0 h-full bg-[#c9a84c] transition-all duration-500 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
