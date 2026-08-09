import { GuestDemoGate } from "@/components/examples/guest-access/guest-demo-gate";
import { WavePool } from "@/components/examples/WavePool";

export default function WavePoolPage() {
  return (
    <GuestDemoGate>
      <WavePool />
    </GuestDemoGate>
  );
}
