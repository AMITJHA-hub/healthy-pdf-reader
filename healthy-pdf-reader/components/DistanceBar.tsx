'use client';

interface DistanceBarProps {
    distance: number; // in cm
    status: 'OK' | 'TOO_CLOSE' | 'TOO_FAR';
}

export default function DistanceBar({ distance, status }: DistanceBarProps) {
    // Normalize distance for display (assuming range 30cm to 80cm)
    // 40-60 is green zone.
    const percentage = Math.max(0, Math.min(100, ((distance - 30) / (80 - 30)) * 100));

    let colorClass = 'bg-blue-500';
    let message = 'Perfect Distance';

    if (status === 'TOO_CLOSE') {
        colorClass = 'bg-red-500';
        message = 'Too Close!';
    } else if (status === 'TOO_FAR') {
        colorClass = 'bg-yellow-500';
        message = 'Too Far';
    } else {
        colorClass = 'bg-green-500';
    }

    return (
        <div className="w-full max-w-md mx-auto p-4 bg-background/50 backdrop-blur-sm rounded-xl border border-white/10 shadow-sm transition-all">
            <div className="flex justify-between items-center mb-2">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${status === 'OK' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {message}
                </span>
                <span className="text-xs text-muted-foreground font-mono">{distance} cm</span>
            </div>

            <div className="relative h-4 bg-secondary/30 rounded-full overflow-hidden w-full">
                {/* Safe Zone Marker (40cm to 60cm) map to % */}
                <div className="absolute top-0 bottom-0 bg-green-500/10 border-x border-green-500/30"
                    style={{ left: '20%', right: '40%' }} // approx 40-60 in 30-80 range
                />

                {/* Indicator */}
                <div
                    className={`absolute top-0 bottom-0 w-2 rounded-full shadow-[0_0_10px_currentColor] transition-all duration-300 ${colorClass}`}
                    style={{ left: `${percentage}%` }}
                />
            </div>

            <p className="text-[10px] text-center text-muted-foreground mt-2">
                Maintain a distance of 40-60cm
            </p>
        </div>
    );
}
