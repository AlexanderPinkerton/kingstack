import GrainGradient from "@/components/paper-design/GrainGradient";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="w-screen h-screen overflow-hidden relative">
      <GrainGradient />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
        <h1 className="text-6xl md:text-4xl font-mono font-bold">
          monkey sea lab
        </h1>
        {/*<Button
          size="lg"
          className="bg-black text-white font-mono hover:bg-gray-900 text-lg px-12 py-6"
        >
          Enter
        </Button>*/}
      </div>
    </main>
  );
}
